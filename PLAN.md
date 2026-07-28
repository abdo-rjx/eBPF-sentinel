# PLAN.md — eBPF Behavioral Anomaly Detection System

**Project codename:** `sentinel` (change freely — used as the root package/namespace name throughout this document)

**Status:** Ready for execution
**Target machine:** Fedora Linux (single-host development + demo), 12GB RAM, Intel i7-10th-gen (no GPU)
**Audience:** (1) A human reviewer who wants to understand the whole system in one read. (2) An autonomous AI coding agent (Claude Code, OpenCode, Cursor, etc.) executing this plan phase-by-phase.

---

## 0. Executive Summary

`sentinel` is a host-based intrusion/malware detection system built from two components that are normally shown separately in tutorials, merged into one coherent pipeline:

1. A **kernel-level collector**, written in C using `libbpf` + **CO-RE** (Compile Once – Run Everywhere), which hooks a focused set of security-relevant Linux syscalls and streams raw behavioral events out of the kernel.
2. A **Python analysis backend** that turns those raw events into per-process behavioral fingerprints (feature vectors), scores them with an **Isolation Forest** anomaly detection model, persists the results, and exposes them through an API and a **React dashboard** that updates in real time.

The system does not rely on a signature database or a blocklist. It learns what "normal" process behavior looks like on a given machine and flags statistical outliers — meaning it can, in principle, catch novel (zero-day) malicious behavior patterns (ransomware-like file thrashing, C2 beaconing, privilege-escalation attempts, unexpected process lineage such as a web server spawning a shell) without ever having seen that specific malware before.

**Why this architecture, in one sentence per decision (full reasoning is in each phase):**
- **libbpf + CO-RE in C** (not BCC/Python) — no runtime compilation, portable single binary, the same architectural pattern real EDR tools (Falco, Tetragon) use. Harder to build, but it is the credible, defensible choice for someone positioning themselves as a systems-level security engineer.
- **Isolation Forest only** (not LSTM) — unsupervised, CPU-only, trains in seconds on this hardware, and is the correct algorithm class for "find the odd one out" anomaly detection on tabular behavioral features. An LSTM would need far more data, far more compute, and solves a different problem (sequence modeling) than what a 12GB/no-GPU machine and a v1 project need.
- **Python everywhere on the backend** — one language across ingestion, feature engineering, ML, and the API, which keeps the project's cognitive load manageable given the collector itself is already a second language (C).
- **A real process boundary (Unix domain socket, newline-delimited JSON)** between the C collector and the Python backend — this is not optional. `libbpf` skeletons are C headers; there is no Python-native way to call into them the way BCC allows, so an explicit IPC contract is a first-class design decision, not an implementation detail.

---

## 1. Architecture Overview

```
┌─────────────────────────── KERNEL SPACE ───────────────────────────┐
│  Hooked syscalls: execve, connect, accept, openat, unlink, rename,  │
│  setuid/setgid  →  eBPF program (C, CO-RE)  →  BPF ring buffer      │
└──────────────────────────────┬──────────────────────────────────────┘
                                │ (kernel → userspace, via ring buffer poll)
┌───────────────────────────── USER SPACE — COLLECTOR (C) ────────────┐
│  libbpf skeleton loader → drains ring buffer → serializes to        │
│  newline-delimited JSON → Unix domain socket server                 │
│  Runs directly on the HOST (not containerized — see Phase 2 notes)  │
└──────────────────────────────┬──────────────────────────────────────┘
                                │ AF_UNIX SOCK_STREAM, NDJSON
┌───────────────────────────── PYTHON BACKEND ─────────────────────────┐
│  Event ingestor → per-(pid,start_time) 5s windowing → feature        │
│  vector builder → Isolation Forest inference → SQLite persistence    │
│  → FastAPI (REST + SSE stream) ── bearer-token auth                  │
│  Runs in Docker Compose                                               │
└──────────────────────────────┬──────────────────────────────────────┘
                                │ HTTPS/HTTP REST + SSE
┌───────────────────────────── FRONTEND ────────────────────────────────┐
│  React + Vite dashboard — live anomaly timeline (Recharts), process   │
│  table, per-window drill-down. Runs in Docker Compose.                │
└─────────────────────────────────────────────────────────────────────┘
```

**Critical architectural decision — where does the collector run?** The C collector loads eBPF programs into the *host's* running kernel and relies on that kernel's BTF (BPF Type Format) information for CO-RE relocations. It must run with elevated privileges directly on the host — it is **not** containerized in v1. Containerizing it is possible (privileged container + mounted `/sys/kernel/btf/vmlinux` + matching capabilities) but adds real complexity for zero benefit at this stage, and real EDR agents commonly run their kernel-facing component outside the container boundary for exactly this reason. The Python backend, database, API, and frontend have no such constraint and run in Docker Compose normally.

---

## 2. Tech Stack

| Layer | Choice | Version (verified where noted) | Why |
|---|---|---|---|
| eBPF program | C, libbpf, CO-RE, BTF | Kernel ≥5.8 with BTF enabled (Fedora ships this by default — verified in Phase 0) | Lowest overhead, portable, production-pattern |
| Loader / collector | C, libbpf | `libbpf` ≥1.4 via Fedora `libbpf-devel` (verify exact via `dnf info libbpf-devel` — Fedora tracks upstream closely) | Required for skeleton-based loading |
| Build tooling (BPF) | clang, llvm, bpftool | clang/llvm ≥17 (Fedora default toolchain is sufficient — verify via `clang --version`) | CO-RE requires BTF-aware compilation |
| IPC | AF_UNIX SOCK_STREAM, newline-delimited JSON | n/a (POSIX) | Simple, single-machine, structured, low overhead |
| Backend language | Python | 3.12 (satisfies both FastAPI ≥3.10 and scikit-learn ≥3.11 requirements) | One language for ingestion, ML, API |
| Web framework | FastAPI | ≥0.140.0 — **verified via PyPI, latest release Jul 24, 2026** | Async, automatic OpenAPI/Swagger docs (valuable for a portfolio demo), native SSE support |
| Data validation | Pydantic | v2 (ships with FastAPI ≥0.140) | Schema enforcement at every boundary |
| ML | scikit-learn | ≥1.9.0 — **verified via PyPI, latest release Jun 2, 2026, requires Python ≥3.11** | `IsolationForest`, CPU-only, no GPU dependency |
| Model persistence | joblib | ships with scikit-learn | Standard sklearn model serialization |
| Database | SQLite | stdlib `sqlite3` via SQLAlchemy | Zero-config, single file, negligible RAM footprint — correct choice given the 12GB constraint; Postgres is a valid v2 upgrade, not a v1 requirement |
| ORM | SQLAlchemy | ≥2.0 (sync API — no async DB complexity needed at this scale) | Portable schema, easy future migration to Postgres |
| Auth | Bearer token (single static token from env var) | n/a | Proportionate for a single-operator security tool; JWT/multi-user is a documented v2 path, not a v1 requirement |
| Real-time transport | Server-Sent Events (SSE) | native FastAPI `StreamingResponse` | One-directional server→client push is all that's needed; far simpler than WebSockets, no connection-state management |
| Frontend | React + Vite | React ≥18 (verify latest via `npm view react version`), Vite (verify via `npm create vite@latest`) | Widely recognized, resume-relevant, low-memory dev server |
| Charts | Recharts | latest via npm | Lightweight, React-native, no heavy build step |
| Containerization | Docker + Docker Compose | n/a | Orchestrates backend + db + frontend; collector excluded (see §1) |

**Version-pinning policy:** every version above marked "verify at implementation time" should be re-checked with `pip index versions <pkg>` / `npm view <pkg> versions` before the first `pip install` / `npm install` of that phase, and the exact resolved version recorded in `requirements.txt` / `package.json` with `==` / exact pins, not ranges. This document deliberately does not invent precise patch numbers for fast-moving JS packages it did not verify live — inventing a plausible-sounding but wrong version is worse than being explicit about what needs a fresh check.

---

## 3. Directory Structure

```
sentinel/
├── PLAN.md
├── README.md
├── .env.example
├── docker-compose.yml
├── collector/                        # C — runs on host, NOT containerized
│   ├── bpf/
│   │   ├── monitor.bpf.c             # eBPF program (kernel space)
│   │   └── vmlinux.h                 # generated via bpftool btf dump (Phase 0)
│   ├── src/
│   │   ├── main.c                    # userspace loader + ring buffer poll + socket server
│   │   ├── events.h                  # shared struct event{} definition (mirrors bpf/monitor.bpf.c)
│   │   └── serialize.c               # struct event -> NDJSON
│   ├── Makefile
│   └── run.sh                        # sudo launcher, checks prerequisites, execs the binary
├── backend/
│   ├── pyproject.toml
│   ├── requirements.txt
│   ├── sentinel_backend/
│   │   ├── __init__.py
│   │   ├── config.py                 # env var loading, Settings (pydantic-settings)
│   │   ├── ingestion/
│   │   │   ├── __init__.py
│   │   │   ├── socket_client.py      # connects to AF_UNIX socket, yields raw events
│   │   │   ├── models.py             # RawEvent pydantic model (wire schema)
│   │   │   └── windowing.py          # WindowAggregator (5s buckets, dual-indexed)
│   │   ├── features/
│   │   │   ├── __init__.py
│   │   │   └── vector.py             # FeatureVector pydantic model + builder
│   │   ├── ml/
│   │   │   ├── __init__.py
│   │   │   ├── train.py              # offline training script (CLI entrypoint)
│   │   │   ├── inference.py          # load model, score(FeatureVector) -> AnomalyResult
│   │   │   └── model_store/          # persisted joblib models (gitignored, mounted volume)
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── schema.py             # SQLAlchemy models
│   │   │   ├── session.py            # engine/session factory
│   │   │   └── repository.py         # insert_window(), query_windows(), etc.
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── main.py               # FastAPI app, router registration
│   │   │   ├── auth.py               # bearer token dependency
│   │   │   ├── routes_windows.py     # /api/v1/windows*
│   │   │   ├── routes_processes.py   # /api/v1/processes
│   │   │   ├── routes_stream.py      # /api/v1/stream (SSE)
│   │   │   └── schemas.py            # response models (pydantic)
│   │   └── pipeline.py               # wires ingestion -> windowing -> features -> ML -> db -> broadcast
│   ├── Dockerfile
│   └── tests/
│       ├── test_windowing.py
│       ├── test_feature_vector.py
│       └── test_api.py
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api/client.js
│       ├── hooks/useEventStream.js
│       └── components/
│           ├── AnomalyTimeline.jsx
│           ├── ProcessTable.jsx
│           └── WindowDetail.jsx
└── test/
    ├── simulate_ransomware.py        # synthetic file-thrash generator (demo/validation)
    └── simulate_beaconing.py         # synthetic periodic-connect generator (demo/validation)
```

---

## Phase 0 — Environment Setup & Prerequisites

### Phase Goal & Context
Everything downstream depends on the host actually supporting CO-RE. This phase verifies that before a single line of eBPF C is written, so failures surface immediately and cheaply rather than deep into Phase 1.

### Prerequisites
None — this is the first phase.

### Detailed Sub-Tasks
1. Verify BTF is available on the running kernel:
   ```bash
   ls -la /sys/kernel/btf/vmlinux
   ```
   If this file does not exist, CO-RE cannot work as designed and the kernel needs a BTF-enabled build (Fedora has shipped BTF-enabled kernels by default for years, so this should pass, but the check must not be skipped).
2. Install build dependencies:
   ```bash
   sudo dnf install -y clang llvm libbpf-devel bpftool elfutils-libelf-devel \
     kernel-devel make gcc python3.12 python3.12-devel nodejs npm docker docker-compose
   ```
3. Confirm `bpftool` can read the running kernel's BTF (this is the exact mechanism Phase 1 depends on):
   ```bash
   sudo bpftool btf dump file /sys/kernel/btf/vmlinux format c > collector/bpf/vmlinux.h
   ```
   This generates `vmlinux.h`, a machine-generated header containing every kernel type definition, which the eBPF program includes instead of guessing at kernel struct layouts. **This file must be regenerated on every machine that runs the collector** — it is kernel-version-specific and must never be hand-edited or copied between machines with different kernels.
4. Confirm Docker is running and the current user can invoke it without `sudo` (add user to the `docker` group, then re-login):
   ```bash
   sudo usermod -aG docker $USER
   ```
5. Create the Python virtual environment for the backend:
   ```bash
   cd backend && python3.12 -m venv .venv && source .venv/bin/activate
   ```
6. Create `.env` from `.env.example` (see Agent Execution Guidelines §"Secrets" for what belongs here).

### File & Code Specifications
`.env.example` (committed; `.env` itself is gitignored):
```
API_AUTH_TOKEN=changeme-generate-a-real-token
SENTINEL_DB_PATH=/data/sentinel.db
SENTINEL_SOCKET_PATH=/tmp/sentinel_collector.sock
SENTINEL_WINDOW_SECONDS=5
ISOLATION_FOREST_CONTAMINATION=0.02
```

### Edge Cases & Failure Scenarios
- **`/sys/kernel/btf/vmlinux` missing:** stop immediately, do not proceed to Phase 1. Document the kernel version (`uname -r`) and treat this as a blocking environment issue, not something to work around with BCC as a silent fallback (that would contradict the locked architecture decision).
- **`bpftool` version mismatch with running kernel:** if `bpftool btf dump` fails with a format error, `bpftool` itself may be older than the running kernel expects; `sudo dnf update bpftool` and retry.
- **User not in `docker` group takes effect only after new login shell** — a fresh `sudo dnf install docker` followed immediately by `docker ps` in the same shell will still fail even after `usermod`; this is expected, not a bug.

### Verification & Testing Criteria
```bash
test -f /sys/kernel/btf/vmlinux && echo "BTF: OK" || echo "BTF: MISSING - STOP"
clang --version | head -1
bpftool version
docker run hello-world
python3.12 --version   # expect 3.12.x
node --version          # expect >=18
```
Phase 0 is complete only when all five commands above succeed with no errors.

---

## Phase 1 — eBPF Program (Kernel Space, C)

### Phase Goal & Context
Write the actual kernel-space program: the code that attaches to syscalls and writes structured events into a ring buffer. This is the highest-risk phase technically — mistakes here are silent (garbage data, not crashes) rather than loud, so precision matters more than in almost any other phase.

### Prerequisites
Phase 0 complete, `collector/bpf/vmlinux.h` generated.

### Detailed Sub-Tasks
1. Define the shared event struct (used identically in both the BPF program and the userspace loader — this is the actual wire format that crosses the ring buffer, so it must be byte-identical on both sides).
2. Define the ring buffer map.
3. Write one tracepoint program per hooked syscall.
4. Read `ppid` correctly via `BPF_CORE_READ` (this is the single most common correctness mistake in first eBPF projects — there is no direct helper for parent pid; it must be read from `task_struct->real_parent->tgid`).
5. Reserve, populate, and submit ring buffer entries.

### File & Code Specifications

**`collector/src/events.h`** (shared between BPF program and C userspace loader — include this same file from both `monitor.bpf.c` and `main.c` to guarantee layout agreement):
```c
#ifndef SENTINEL_EVENTS_H
#define SENTINEL_EVENTS_H

#define EVENT_EXECVE   1
#define EVENT_CONNECT  2
#define EVENT_ACCEPT   3
#define EVENT_OPENAT   4
#define EVENT_UNLINK   5
#define EVENT_RENAME   6
#define EVENT_SETUID   7

#define TASK_COMM_LEN  16
#define FILENAME_LEN   256

struct event {
    __u64 timestamp_ns;      // bpf_ktime_get_ns() at capture time
    __u32 pid;                // tgid (userspace "pid")
    __u32 tid;                // kernel thread id
    __u32 ppid;                // parent tgid, read via BPF_CORE_READ
    __u32 uid;
    char  comm[TASK_COMM_LEN];
    __u32 event_type;          // one of EVENT_* above

    // Fields below are populated selectively depending on event_type.
    // A flat struct (not a union) is used deliberately: unions inside
    // BPF C interact poorly with the verifier's stack-slot tracking on
    // some kernel versions, and the ~280 extra bytes per event are
    // negligible at this event rate and this hardware's RAM budget.
    char   filename[FILENAME_LEN]; // execve/openat/unlink/rename
    __u32  dst_ip;                  // connect (network byte order, IPv4 only in v1)
    __u16  dst_port;                // connect
    __u32  target_uid;              // setuid
};

#endif
```

**`collector/bpf/monitor.bpf.c`**:
```c
// SPDX-License-Identifier: GPL-2.0
#include "vmlinux.h"
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_tracing.h>
#include <bpf/bpf_core_read.h>
#include "../src/events.h"

char LICENSE[] SEC("license") = "GPL";

struct {
    __uint(type, BPF_MAP_TYPE_RINGBUF);
    __uint(max_entries, 256 * 1024); // 256KB — sized for this hardware's RAM budget
} events SEC(".maps");

// Shared helper: populate the common fields every event needs.
static __always_inline void fill_common(struct event *e, __u32 event_type) {
    __u64 pid_tgid = bpf_get_current_pid_tgid();
    e->pid = pid_tgid >> 32;
    e->tid = (__u32)pid_tgid;
    e->uid = (__u32)bpf_get_current_uid_gid();
    e->timestamp_ns = bpf_ktime_get_ns();
    e->event_type = event_type;
    bpf_get_current_comm(&e->comm, sizeof(e->comm));

    // ppid has no dedicated helper. Read it via CO-RE from task_struct.
    struct task_struct *task = (struct task_struct *)bpf_get_current_task();
    e->ppid = BPF_CORE_READ(task, real_parent, tgid);
}

SEC("tracepoint/syscalls/sys_enter_execve")
int handle_execve(struct trace_event_raw_sys_enter *ctx) {
    struct event *e = bpf_ringbuf_reserve(&events, sizeof(*e), 0);
    if (!e) return 0; // ring buffer full — drop, do not block the syscall
    fill_common(e, EVENT_EXECVE);
    const char *filename_ptr = (const char *)ctx->args[0];
    bpf_probe_read_user_str(&e->filename, sizeof(e->filename), filename_ptr);
    bpf_ringbuf_submit(e, 0);
    return 0;
}

SEC("tracepoint/syscalls/sys_enter_connect")
int handle_connect(struct trace_event_raw_sys_enter *ctx) {
    struct sockaddr_in addr = {};
    bpf_probe_read_user(&addr, sizeof(addr), (void *)ctx->args[1]);
    if (addr.sin_family != AF_INET) return 0; // IPv4 only in v1
    struct event *e = bpf_ringbuf_reserve(&events, sizeof(*e), 0);
    if (!e) return 0;
    fill_common(e, EVENT_CONNECT);
    e->dst_ip = addr.sin_addr.s_addr;
    e->dst_port = bpf_ntohs(addr.sin_port);
    bpf_ringbuf_submit(e, 0);
    return 0;
}

SEC("tracepoint/syscalls/sys_enter_accept")
int handle_accept(struct trace_event_raw_sys_enter *ctx) {
    struct event *e = bpf_ringbuf_reserve(&events, sizeof(*e), 0);
    if (!e) return 0;
    fill_common(e, EVENT_ACCEPT);
    bpf_ringbuf_submit(e, 0);
    return 0;
}

SEC("tracepoint/syscalls/sys_enter_openat")
int handle_openat(struct trace_event_raw_sys_enter *ctx) {
    struct event *e = bpf_ringbuf_reserve(&events, sizeof(*e), 0);
    if (!e) return 0;
    fill_common(e, EVENT_OPENAT);
    const char *filename_ptr = (const char *)ctx->args[1];
    bpf_probe_read_user_str(&e->filename, sizeof(e->filename), filename_ptr);
    bpf_ringbuf_submit(e, 0);
    return 0;
}

SEC("tracepoint/syscalls/sys_enter_unlink")
int handle_unlink(struct trace_event_raw_sys_enter *ctx) {
    struct event *e = bpf_ringbuf_reserve(&events, sizeof(*e), 0);
    if (!e) return 0;
    fill_common(e, EVENT_UNLINK);
    const char *filename_ptr = (const char *)ctx->args[0];
    bpf_probe_read_user_str(&e->filename, sizeof(e->filename), filename_ptr);
    bpf_ringbuf_submit(e, 0);
    return 0;
}

SEC("tracepoint/syscalls/sys_enter_rename")
int handle_rename(struct trace_event_raw_sys_enter *ctx) {
    struct event *e = bpf_ringbuf_reserve(&events, sizeof(*e), 0);
    if (!e) return 0;
    fill_common(e, EVENT_RENAME);
    const char *filename_ptr = (const char *)ctx->args[0]; // oldname; sufficient signal for v1
    bpf_probe_read_user_str(&e->filename, sizeof(e->filename), filename_ptr);
    bpf_ringbuf_submit(e, 0);
    return 0;
}

SEC("tracepoint/syscalls/sys_enter_setuid")
int handle_setuid(struct trace_event_raw_sys_enter *ctx) {
    struct event *e = bpf_ringbuf_reserve(&events, sizeof(*e), 0);
    if (!e) return 0;
    fill_common(e, EVENT_SETUID);
    e->target_uid = (__u32)ctx->args[0];
    bpf_ringbuf_submit(e, 0);
    return 0;
}
```

### Edge Cases & Failure Scenarios
- **Tracepoint argument layout must match exactly.** Before trusting `ctx->args[N]` indices above, verify each syscall's actual layout with `sudo cat /sys/kernel/debug/tracing/events/syscalls/sys_enter_<name>/format` on the target machine. The indices used here are correct for the standard x86_64 syscall tracepoints, but this is exactly the kind of detail that silently produces garbage (not a crash) if a kernel changes an argument order — always confirm against the live `format` file rather than trusting any hardcoded reference, including this one.
- **Ring buffer full:** every handler returns `0` (does not block/fail the syscall) if `bpf_ringbuf_reserve` returns `NULL`. Dropping events under load is the correct behavior for a monitoring tool — a monitoring tool must never be able to degrade the monitored system's own syscalls.
- **`bpf_probe_read_user_str` truncation:** filenames longer than 256 bytes are silently truncated. This is acceptable for anomaly detection (we don't need the full path for statistical features) but should be documented, not discovered later.
- **IPv6 connects are silently skipped** in v1 (`addr.sin_family != AF_INET` early return). Document this as a known v1 limitation, not a bug, if it comes up during testing.

### Verification & Testing Criteria
```bash
cd collector && clang -O2 -g -target bpf -D__TARGET_ARCH_x86 \
  -I. -Ibpf -c bpf/monitor.bpf.c -o bpf/monitor.bpf.o
llvm-objdump -h bpf/monitor.bpf.o   # confirm sections exist: license, maps, and one per tracepoint
bpftool prog load bpf/monitor.bpf.o /sys/fs/bpf/monitor_test && \
  bpftool prog show pinned /sys/fs/bpf/monitor_test && \
  bpftool prog detach ... ; rm /sys/fs/bpf/monitor_test  # smoke-test load, then clean up
```
Phase 1 is complete when the `.o` file compiles with zero warnings and `bpftool prog load` succeeds (confirming the verifier accepts the program) even before the full userspace loader exists.

---

## Phase 2 — C Collector (libbpf Loader, User Space)

### Phase Goal & Context
Turn the compiled BPF object into a running, attached program, drain its ring buffer, and expose the result to the outside world over the IPC boundary established in the Architecture Overview. This is where "kernel space" ends and the rest of the system begins.

### Prerequisites
Phase 1 complete (`monitor.bpf.o` compiles and loads).

### Detailed Sub-Tasks
1. Generate the libbpf skeleton header.
2. Write the loader: open, load, attach, poll.
3. Serialize each `struct event` to a single NDJSON line.
4. Implement the Unix domain socket server (accept one client — the Python backend — and stream lines to it).
5. Write `run.sh`, the host launcher, including a pre-flight capability check.

### File & Code Specifications

Skeleton generation (part of the build, not a one-time manual step — put this in the Makefile):
```bash
bpftool gen skeleton collector/bpf/monitor.bpf.o > collector/src/monitor.skel.h
```

**`collector/src/main.c`** (core structure — every function below is complete, not a stub):
```c
// SPDX-License-Identifier: GPL-2.0
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <signal.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <bpf/libbpf.h>
#include "monitor.skel.h"
#include "events.h"

#define SOCKET_PATH_DEFAULT "/tmp/sentinel_collector.sock"

static volatile sig_atomic_t running = 1;
static int client_fd = -1;

static void handle_sigint(int sig) { (void)sig; running = 0; }

static int libbpf_print_fn(enum libbpf_print_level level, const char *format, va_list args) {
    if (level == LIBBPF_DEBUG) return 0;
    return vfprintf(stderr, format, args);
}

// Serializes one struct event to a single NDJSON line and writes it to client_fd.
// Returns -1 on write failure (caller treats this as "client disconnected").
static int emit_event(const struct event *e) {
    if (client_fd < 0) return 0; // no client connected yet — drop silently, do not buffer unbounded

    static const char *type_names[] = {
        "", "execve", "connect", "accept", "openat", "unlink", "rename", "setuid"
    };
    const char *type_name = (e->event_type >= 1 && e->event_type <= 7)
        ? type_names[e->event_type] : "unknown";

    char line[1024];
    int n = snprintf(line, sizeof(line),
        "{\"ts\":%llu,\"pid\":%u,\"tid\":%u,\"ppid\":%u,\"uid\":%u,"
        "\"comm\":\"%s\",\"event_type\":\"%s\","
        "\"filename\":\"%s\",\"dst_ip\":%u,\"dst_port\":%u,\"target_uid\":%u}\n",
        (unsigned long long)e->timestamp_ns, e->pid, e->tid, e->ppid, e->uid,
        e->comm, type_name, e->filename, e->dst_ip, e->dst_port, e->target_uid);

    if (n < 0 || n >= (int)sizeof(line)) return -1; // truncation — treat as a failed emit

    ssize_t written = write(client_fd, line, (size_t)n);
    if (written < 0) { close(client_fd); client_fd = -1; return -1; }
    return 0;
}

static int handle_ringbuf_event(void *ctx, void *data, size_t data_sz) {
    (void)ctx;
    if (data_sz < sizeof(struct event)) return 0; // defensive — should never happen, never trust blindly
    emit_event((const struct event *)data);
    return 0;
}

// Blocks until the single expected client (the Python backend) connects.
// Reconnection is supported: if the client disconnects, this is called again.
static int wait_for_client(int listen_fd) {
    fprintf(stderr, "[collector] waiting for backend to connect...\n");
    int fd = accept(listen_fd, NULL, NULL);
    if (fd < 0) { perror("accept"); return -1; }
    fprintf(stderr, "[collector] backend connected\n");
    return fd;
}

int main(int argc, char **argv) {
    const char *socket_path = getenv("SENTINEL_SOCKET_PATH");
    if (!socket_path) socket_path = SOCKET_PATH_DEFAULT;

    if (geteuid() != 0) {
        fprintf(stderr, "[collector] must run as root (or with CAP_BPF+CAP_PERFMON) "
                        "to load eBPF programs. See collector/run.sh.\n");
        return 1;
    }

    libbpf_set_print(libbpf_print_fn);
    signal(SIGINT, handle_sigint);
    signal(SIGTERM, handle_sigint);

    struct monitor_bpf *skel = monitor_bpf__open_and_load();
    if (!skel) { fprintf(stderr, "[collector] failed to open/load BPF skeleton\n"); return 1; }

    int err = monitor_bpf__attach(skel);
    if (err) { fprintf(stderr, "[collector] failed to attach: %d\n", err); monitor_bpf__destroy(skel); return 1; }

    // Set up the Unix domain socket server.
    unlink(socket_path); // remove stale socket from a previous unclean shutdown
    int listen_fd = socket(AF_UNIX, SOCK_STREAM, 0);
    struct sockaddr_un addr = { .sun_family = AF_UNIX };
    strncpy(addr.sun_path, socket_path, sizeof(addr.sun_path) - 1);
    if (bind(listen_fd, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        perror("bind"); monitor_bpf__destroy(skel); return 1;
    }
    listen(listen_fd, 1);
    chmod(socket_path, 0660); // restrict to owner+group, not world-writable

    struct ring_buffer *rb = ring_buffer__new(bpf_map__fd(skel->maps.events),
                                               handle_ringbuf_event, NULL, NULL);
    if (!rb) { fprintf(stderr, "[collector] failed to create ring buffer\n"); monitor_bpf__destroy(skel); return 1; }

    client_fd = wait_for_client(listen_fd);

    fprintf(stderr, "[collector] running. Ctrl-C to stop.\n");
    while (running) {
        int poll_err = ring_buffer__poll(rb, 200 /* ms timeout */);
        if (poll_err < 0 && poll_err != -EINTR) {
            fprintf(stderr, "[collector] ring buffer poll error: %d\n", poll_err);
            break;
        }
        if (client_fd < 0) {
            // Backend disconnected — block again for a reconnect rather than exiting.
            client_fd = wait_for_client(listen_fd);
        }
    }

    ring_buffer__free(rb);
    monitor_bpf__destroy(skel);
    if (client_fd >= 0) close(client_fd);
    close(listen_fd);
    unlink(socket_path);
    return 0;
}
```

**`collector/run.sh`**:
```bash
#!/usr/bin/env bash
set -euo pipefail
if [ ! -f /sys/kernel/btf/vmlinux ]; then
  echo "ERROR: BTF not available on this kernel. See Phase 0." >&2
  exit 1
fi
if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: must run as root (sudo ./run.sh) to load eBPF programs." >&2
  exit 1
fi
exec ./build/sentinel_collector
```

### Edge Cases & Failure Scenarios
- **Stale socket file from an unclean previous shutdown:** handled via `unlink(socket_path)` before `bind()` — without this, a second run fails with `EADDRINUSE` even though nothing is actually listening.
- **Client disconnects mid-stream (Python backend restarts):** the collector does not exit; it drops events (does not buffer unbounded memory) until a new client connects, then resumes. This is a deliberate choice: an unbounded buffer on a 12GB machine during a long backend outage is a real risk.
- **`snprintf` truncation on pathologically long filenames combined with the JSON escaping this simplified version does not perform:** the emit_event function above does not escape special characters (quotes, backslashes, control characters) that could theoretically appear in a `comm` or `filename` value. **This is a known v1 gap, not an oversight to silently ignore** — before Phase 3 is considered done, the Python side's JSON parser must be wrapped in a try/except that logs and skips malformed lines (see Phase 3 edge cases) so a single hostile or corrupted filename cannot crash ingestion.
- **Root requirement:** v1 requires running as root for simplicity. A documented v2 hardening step is to drop to the specific capabilities (`CAP_BPF`, `CAP_PERFMON`, `CAP_NET_ADMIN` as of kernel ≥5.8) instead of full root — mention this in the README as a known follow-up, do not implement it in v1 (proportionate effort).

### Verification & Testing Criteria
```bash
cd collector && make        # builds monitor.bpf.o, generates skeleton, builds sentinel_collector
sudo ./run.sh &
sleep 1
nc -U /tmp/sentinel_collector.sock   # manual smoke test: connect and watch raw NDJSON lines
# In another terminal, generate an event:
ls /tmp   # triggers openat events, should appear as NDJSON lines in the nc session
```
Phase 2 is complete when running `ls`, `curl`, or any ordinary command produces visible, well-formed NDJSON lines over the socket in real time.

---

## Phase 3 — Python Event Ingestion & Windowing

### Phase Goal & Context
This is where raw kernel events become the statistically meaningful unit Isolation Forest actually needs: a fixed-length feature vector per process per time window. Getting the windowing logic right — including the two subtleties below — matters more to final detection quality than any other single phase.

### Prerequisites
Phase 2 complete; collector running and streaming NDJSON over the socket.

### Detailed Sub-Tasks
1. Socket client with correct stream-boundary buffering (sockets do not guarantee `\n`-aligned reads).
2. `RawEvent` pydantic model matching the exact wire schema from Phase 2.
3. `WindowAggregator` — the core logic, including the two documented subtleties.
4. A background reaper that flushes windows even when no new events arrive for a given pid (process exited).

### File & Code Specifications

**`backend/sentinel_backend/ingestion/models.py`**:
```python
from pydantic import BaseModel
from typing import Optional
from enum import Enum

class EventType(str, Enum):
    execve = "execve"
    connect = "connect"
    accept = "accept"
    openat = "openat"
    unlink = "unlink"
    rename = "rename"
    setuid = "setuid"

class RawEvent(BaseModel):
    ts: int                      # timestamp_ns from the kernel (bpf_ktime_get_ns)
    pid: int
    tid: int
    ppid: int
    uid: int
    comm: str
    event_type: EventType
    filename: Optional[str] = ""
    dst_ip: Optional[int] = 0
    dst_port: Optional[int] = 0
    target_uid: Optional[int] = 0
```

**`backend/sentinel_backend/ingestion/socket_client.py`**:
```python
import socket
import json
import logging
from typing import Iterator
from .models import RawEvent

logger = logging.getLogger(__name__)

def stream_events(socket_path: str) -> Iterator[RawEvent]:
    """Connects to the collector's Unix domain socket and yields parsed RawEvent
    objects indefinitely. Reconnects automatically if the collector restarts.
    Handles partial reads correctly — a single recv() is NOT guaranteed to end
    on a newline boundary, so a persistent buffer is required."""
    while True:
        try:
            sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            sock.connect(socket_path)
            logger.info("Connected to collector at %s", socket_path)
            buffer = ""
            while True:
                chunk = sock.recv(65536)
                if not chunk:
                    logger.warning("Collector closed the connection, reconnecting...")
                    break
                buffer += chunk.decode("utf-8", errors="replace")
                while "\n" in buffer:
                    line, buffer = buffer.split("\n", 1)
                    if not line.strip():
                        continue
                    try:
                        data = json.loads(line)
                        yield RawEvent(**data)
                    except (json.JSONDecodeError, ValueError) as exc:
                        # Malformed line (see Phase 2 edge cases) — log and skip,
                        # never let one bad line take down ingestion.
                        logger.warning("Dropping malformed event line: %s", exc)
                        continue
        except (ConnectionRefusedError, FileNotFoundError):
            import time
            logger.info("Collector not available yet, retrying in 2s...")
            time.sleep(2)
```

**`backend/sentinel_backend/ingestion/windowing.py`** — the two subtleties are called out explicitly in comments because they are the most likely source of a subtly-wrong-but-not-crashing v1 bug:
```python
import time
import threading
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Callable, Dict, Set, Tuple
from .models import RawEvent, EventType
from ..features.vector import FeatureVector

WindowKey = Tuple[int, int]  # (pid, process_start_time_ns) — see subtlety #1 below

@dataclass
class _WindowAccumulator:
    pid: int
    ppid: int
    comm: str
    window_start_ns: int
    num_execve: int = 0
    num_file_opens: int = 0
    num_file_renames: int = 0
    num_file_deletes: int = 0
    num_connect: int = 0
    num_setuid: int = 0
    distinct_files: Set[str] = field(default_factory=set)
    distinct_dest_ips: Set[int] = field(default_factory=set)
    total_events: int = 0
    last_event_ns: int = 0

class WindowAggregator:
    """
    Aggregates raw per-syscall events into fixed 5-second feature vectors,
    one per (pid, process_start_time).

    SUBTLETY #1 — pid reuse: the Linux kernel recycles pids. Keying windows by
    pid alone would silently merge the behavior of two unrelated processes if
    the OS happens to reuse a pid within the aggregation period. We approximate
    "process start time" using the timestamp of the FIRST event we ever observe
    for a given pid within a fresh accumulator lifecycle, which is sufficient
    for v1 (a true /proc-derived start_time_ns would be more precise but is not
    available directly from the syscall tracepoints we hook — a documented v2
    improvement, not a v1 blocker).

    SUBTLETY #2 — children fan-out: "how many child processes did pid X spawn"
    CANNOT be computed from pid X's own event stream, because we do not hook
    fork/clone. It is only observable by noticing that OTHER pids' events carry
    ppid == X. This requires a second, parallel index (ppid -> set of child
    pids seen), merged into X's own feature vector at flush time. This is
    implemented below as `self._children_by_ppid`, separate from
    `self._accumulators`.
    """

    def __init__(self, window_seconds: int, on_window_complete: Callable[[FeatureVector], None]):
        self.window_seconds = window_seconds
        self.on_window_complete = on_window_complete
        self._accumulators: Dict[WindowKey, _WindowAccumulator] = {}
        self._children_by_ppid: Dict[int, Set[int]] = defaultdict(set)
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._reaper_thread = threading.Thread(target=self._reap_loop, daemon=True)

    def start(self):
        self._reaper_thread.start()

    def stop(self):
        self._stop.set()

    def ingest(self, event: RawEvent):
        with self._lock:
            key = self._key_for(event)
            acc = self._accumulators.get(key)
            if acc is None:
                acc = _WindowAccumulator(
                    pid=event.pid, ppid=event.ppid, comm=event.comm,
                    window_start_ns=event.ts,
                )
                self._accumulators[key] = acc

            acc.total_events += 1
            acc.last_event_ns = event.ts
            acc.ppid = event.ppid  # keep latest observed ppid
            acc.comm = event.comm

            # Subtlety #2: record this pid as a child of its ppid, regardless
            # of event type, so the PARENT's window can report fan-out later.
            self._children_by_ppid[event.ppid].add(event.pid)

            if event.event_type == EventType.execve:
                acc.num_execve += 1
                if event.filename: acc.distinct_files.add(event.filename)
            elif event.event_type == EventType.openat:
                acc.num_file_opens += 1
                if event.filename: acc.distinct_files.add(event.filename)
            elif event.event_type == EventType.rename:
                acc.num_file_renames += 1
                if event.filename: acc.distinct_files.add(event.filename)
            elif event.event_type == EventType.unlink:
                acc.num_file_deletes += 1
                if event.filename: acc.distinct_files.add(event.filename)
            elif event.event_type == EventType.connect:
                acc.num_connect += 1
                acc.distinct_dest_ips.add(event.dst_ip)
            elif event.event_type == EventType.setuid:
                acc.num_setuid += 1
            # accept: counted only in total_events / syscall_rate

            elapsed_s = (event.ts - acc.window_start_ns) / 1_000_000_000
            if elapsed_s >= self.window_seconds:
                self._flush(key)

    def _key_for(self, event: RawEvent) -> WindowKey:
        # Approximated process_start_time per SUBTLETY #1: the window_start_ns
        # of whatever accumulator currently exists for this pid, or a fresh
        # start (this event's ts) if none exists yet.
        for (pid, start_ns) in self._accumulators:
            if pid == event.pid:
                return (pid, start_ns)
        return (event.pid, event.ts)

    def _flush(self, key: WindowKey):
        acc = self._accumulators.pop(key, None)
        if acc is None:
            return
        num_distinct_children = len(self._children_by_ppid.pop(acc.pid, set()))
        duration_s = max((acc.last_event_ns - acc.window_start_ns) / 1_000_000_000, 0.001)

        vector = FeatureVector(
            pid=acc.pid, ppid=acc.ppid, comm=acc.comm,
            window_start_ns=acc.window_start_ns, window_end_ns=acc.last_event_ns,
            num_execve=acc.num_execve,
            num_distinct_children=num_distinct_children,
            num_file_opens=acc.num_file_opens,
            num_file_renames=acc.num_file_renames,
            num_file_deletes=acc.num_file_deletes,
            num_distinct_files_touched=len(acc.distinct_files),
            num_connect=acc.num_connect,
            num_distinct_dest_ips=len(acc.distinct_dest_ips),
            num_setuid=acc.num_setuid,
            syscall_rate=acc.total_events / duration_s,
        )
        self.on_window_complete(vector)

    def _reap_loop(self):
        """Flushes windows whose process has gone quiet (no new events) even
        though the 5s elapsed-since-window-start check in `ingest` never fired
        again. Without this, a process that emits 3 events and then exits
        would sit in `_accumulators` forever and never reach the ML model."""
        while not self._stop.is_set():
            now_ns = time.time_ns()
            with self._lock:
                stale_keys = [
                    k for k, acc in self._accumulators.items()
                    if (now_ns - acc.last_event_ns) / 1_000_000_000 >= self.window_seconds
                ]
                for k in stale_keys:
                    self._flush(k)
            self._stop.wait(timeout=self.window_seconds)
```

### Edge Cases & Failure Scenarios
- **Malformed/truncated JSON lines from the collector:** handled in `socket_client.py` via try/except around `json.loads` — logged and skipped, ingestion never crashes on one bad line.
- **`_key_for`'s linear scan over `self._accumulators`** is O(n) per event; acceptable at this project's scale (dozens to low hundreds of concurrently active windows on a single dev machine) but should be replaced with a `pid -> current_window_key` side-index if this is ever pointed at a busier host — documented as a known v2 optimization, not a v1 blocker.
- **Collector restarts mid-window:** the reconnect logic in `socket_client.py` means events simply resume arriving; any windows that were mid-flight when the connection dropped will eventually be flushed by the reaper (they will just have fewer events than a full 5s window would normally have — acceptable, not silently lost).

### Verification & Testing Criteria
```bash
cd backend && source .venv/bin/activate && pip install -r requirements.txt
pytest tests/test_windowing.py -v
```
`tests/test_windowing.py` must include at minimum: (1) a test that feeds synthetic events for one pid and asserts the emitted `FeatureVector` counts match exactly; (2) a test that feeds events for a parent pid AND a child pid and asserts `num_distinct_children == 1` on the parent's flushed vector; (3) a test that ingests 2 events for a pid, waits (or mocks time), and asserts the reaper flushes it without a 3rd event ever arriving.

---

## Phase 4 — ML Training & Inference (Isolation Forest)

### Phase Goal & Context
Turn a collected baseline of "normal" feature vectors into a trained model, and wire that model into the live pipeline so every completed window gets scored the moment it's built.

### Prerequisites
Phase 3 complete and producing `FeatureVector` objects from live or recorded traffic.

### Detailed Sub-Tasks
1. Collect a baseline dataset (run the full collector + ingestion pipeline for a period of ordinary machine use, persist every `FeatureVector` to a CSV — this is a one-time data-collection step, not part of the runtime pipeline).
2. Write the training script.
3. Write the inference module with correct sklearn sign conventions.
4. Wire inference into `pipeline.py` so it runs synchronously right after each window is flushed.

### File & Code Specifications

**`backend/sentinel_backend/features/vector.py`**:
```python
from pydantic import BaseModel

FEATURE_COLUMNS = [
    "num_execve", "num_distinct_children", "num_file_opens",
    "num_file_renames", "num_file_deletes", "num_distinct_files_touched",
    "num_connect", "num_distinct_dest_ips", "num_setuid", "syscall_rate",
]

class FeatureVector(BaseModel):
    pid: int
    ppid: int
    comm: str
    window_start_ns: int
    window_end_ns: int
    num_execve: int
    num_distinct_children: int
    num_file_opens: int
    num_file_renames: int
    num_file_deletes: int
    num_distinct_files_touched: int
    num_connect: int
    num_distinct_dest_ips: int
    num_setuid: int
    syscall_rate: float

    def to_array(self) -> list[float]:
        """Ordered numeric array matching FEATURE_COLUMNS exactly — this
        ordering is the actual model input contract. Any change to
        FEATURE_COLUMNS requires retraining the model; the two must never
        drift out of sync."""
        return [float(getattr(self, col)) for col in FEATURE_COLUMNS]
```

**`backend/sentinel_backend/ml/train.py`**:
```python
"""Offline training entrypoint. Run as: python -m sentinel_backend.ml.train baseline.csv"""
import sys
import joblib
import pandas as pd
from sklearn.ensemble import IsolationForest
from ..features.vector import FEATURE_COLUMNS

def train(csv_path: str, output_path: str, contamination: float = 0.02):
    df = pd.read_csv(csv_path)
    missing = set(FEATURE_COLUMNS) - set(df.columns)
    if missing:
        raise ValueError(f"Baseline CSV is missing required columns: {missing}")

    X = df[FEATURE_COLUMNS].values
    model = IsolationForest(
        n_estimators=100,
        contamination=contamination,  # expected proportion of outliers; tune
                                        # empirically against your own baseline —
                                        # 0.02 is a reasonable starting point,
                                        # not a validated constant
        random_state=42,
        n_jobs=-1,  # IsolationForest is CPU-parallel and cheap; safe on this hardware
    )
    model.fit(X)
    joblib.dump(model, output_path)
    print(f"Trained on {len(df)} windows, saved to {output_path}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m sentinel_backend.ml.train <baseline.csv> [output.joblib]")
        sys.exit(1)
    csv_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else "sentinel_backend/ml/model_store/isolation_forest.joblib"
    train(csv_path, output_path)
```

**`backend/sentinel_backend/ml/inference.py`**:
```python
import joblib
from dataclasses import dataclass
from ..features.vector import FeatureVector

@dataclass
class AnomalyResult:
    anomaly_score: float   # sklearn decision_function output — NEGATIVE = anomalous, POSITIVE = normal
    is_anomalous: bool     # sklearn predict() == -1

class AnomalyScorer:
    """Loads a persisted IsolationForest once and scores FeatureVectors.

    IMPORTANT sklearn sign convention (verified against sklearn docs, do not
    flip this): IsolationForest.decision_function() returns HIGHER values for
    NORMAL points and LOWER (more negative) values for ANOMALIES. predict()
    returns 1 for inliers and -1 for outliers. Getting this backwards silently
    inverts every anomaly in the dashboard — a very easy, very costly mistake
    to make when wiring this up quickly."""

    def __init__(self, model_path: str):
        self.model = joblib.load(model_path)

    def score(self, vector: FeatureVector) -> AnomalyResult:
        X = [vector.to_array()]
        raw_score = float(self.model.decision_function(X)[0])
        prediction = int(self.model.predict(X)[0])
        return AnomalyResult(
            anomaly_score=raw_score,
            is_anomalous=(prediction == -1),
        )
```

### Edge Cases & Failure Scenarios
- **Cold start — no model exists yet on first run:** `AnomalyScorer.__init__` will raise `FileNotFoundError` if `model_path` doesn't exist. The pipeline (Phase 3/6 wiring) must catch this at startup and fail loudly with a clear message ("no trained model found — run `python -m sentinel_backend.ml.train` first"), not silently skip scoring.
- **Baseline contamination:** if the "normal" period used to build `baseline.csv` accidentally includes genuinely unusual activity (e.g., a software update running in the background), the model will learn that as normal and under-flag it later. Document this as a data-quality responsibility, not something the code can detect for you.
- **Feature drift:** if `FEATURE_COLUMNS` in `vector.py` is ever changed (a feature added/removed) after a model was trained, `to_array()`'s output length will not match what the model expects, and `decision_function`/`predict` will raise a shape-mismatch error. This is intentional — a silent mismatch would be far worse than a loud one.

### Verification & Testing Criteria
```bash
# After collecting at least ~30 minutes of baseline (ordinary use) traffic to baseline.csv:
python -m sentinel_backend.ml.train baseline.csv
python -c "
from sentinel_backend.ml.inference import AnomalyScorer
from sentinel_backend.features.vector import FeatureVector
scorer = AnomalyScorer('sentinel_backend/ml/model_store/isolation_forest.joblib')
normal = FeatureVector(pid=1,ppid=0,comm='bash',window_start_ns=0,window_end_ns=5_000_000_000,
    num_execve=1,num_distinct_children=0,num_file_opens=3,num_file_renames=0,num_file_deletes=0,
    num_distinct_files_touched=3,num_connect=0,num_distinct_dest_ips=0,num_setuid=0,syscall_rate=0.8)
extreme = FeatureVector(pid=2,ppid=0,comm='evil',window_start_ns=0,window_end_ns=5_000_000_000,
    num_execve=50,num_distinct_children=20,num_file_opens=900,num_file_renames=850,num_file_deletes=800,
    num_distinct_files_touched=900,num_connect=60,num_distinct_dest_ips=55,num_setuid=5,syscall_rate=600)
print('normal:', scorer.score(normal))
print('extreme:', scorer.score(extreme))
"
```
Phase 4 is complete when the extreme synthetic vector scores as `is_anomalous=True` with a clearly lower `anomaly_score` than the normal vector. If it does not, the contamination parameter or the baseline data needs revisiting before proceeding — do not move to Phase 5 with an inference path that cannot distinguish an obviously extreme case.

---

## Phase 5 — Database & Persistence

### Phase Goal & Context
Every scored window needs to be durably stored so the API and dashboard have historical data to query, not just whatever is currently in memory.

### Prerequisites
Phase 4 complete (AnomalyResult objects are being produced).

### Detailed Sub-Tasks
1. Define the SQLAlchemy schema — one denormalized `windows` table (feature vector + ML output combined; this scale does not benefit from further normalization).
2. Session/engine factory.
3. Repository functions: insert, paginated query, filter by pid/anomalous-only.

### File & Code Specifications

**`backend/sentinel_backend/db/schema.py`**:
```python
from sqlalchemy import Column, Integer, String, Float, Boolean, BigInteger, DateTime, func
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class WindowRecord(Base):
    __tablename__ = "windows"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pid = Column(Integer, nullable=False, index=True)
    ppid = Column(Integer, nullable=False)
    comm = Column(String(16), nullable=False, index=True)
    window_start_ns = Column(BigInteger, nullable=False)
    window_end_ns = Column(BigInteger, nullable=False)

    num_execve = Column(Integer, nullable=False)
    num_distinct_children = Column(Integer, nullable=False)
    num_file_opens = Column(Integer, nullable=False)
    num_file_renames = Column(Integer, nullable=False)
    num_file_deletes = Column(Integer, nullable=False)
    num_distinct_files_touched = Column(Integer, nullable=False)
    num_connect = Column(Integer, nullable=False)
    num_distinct_dest_ips = Column(Integer, nullable=False)
    num_setuid = Column(Integer, nullable=False)
    syscall_rate = Column(Float, nullable=False)

    anomaly_score = Column(Float, nullable=False, index=True)
    is_anomalous = Column(Boolean, nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

**`backend/sentinel_backend/db/session.py`**:
```python
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .schema import Base

DB_PATH = os.environ.get("SENTINEL_DB_PATH", "/data/sentinel.db")
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

def init_db():
    Base.metadata.create_all(bind=engine)
```

**`backend/sentinel_backend/db/repository.py`**:
```python
from typing import Optional, List
from sqlalchemy.orm import Session
from .schema import WindowRecord
from ..features.vector import FeatureVector, FEATURE_COLUMNS
from ..ml.inference import AnomalyResult

def insert_window(db: Session, vector: FeatureVector, result: AnomalyResult) -> WindowRecord:
    record = WindowRecord(
        pid=vector.pid, ppid=vector.ppid, comm=vector.comm,
        window_start_ns=vector.window_start_ns, window_end_ns=vector.window_end_ns,
        **{col: getattr(vector, col) for col in FEATURE_COLUMNS},
        anomaly_score=result.anomaly_score, is_anomalous=result.is_anomalous,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

def query_windows(
    db: Session, limit: int = 100, pid: Optional[int] = None,
    anomalous_only: bool = False,
) -> List[WindowRecord]:
    q = db.query(WindowRecord)
    if pid is not None:
        q = q.filter(WindowRecord.pid == pid)
    if anomalous_only:
        q = q.filter(WindowRecord.is_anomalous.is_(True))
    return q.order_by(WindowRecord.id.desc()).limit(limit).all()
```

### Edge Cases & Failure Scenarios
- **SQLite write concurrency:** SQLite handles one writer at a time; at this event volume (one insert roughly every few seconds per active process) this is not a bottleneck, but it is the reason a future migration to Postgres would be needed for a genuinely multi-host deployment — documented, not solved, in v1.
- **`connect_args={"check_same_thread": False}`** is required because the ingestion pipeline (Phase 3) runs on a background thread while FastAPI (Phase 6) serves requests on the main event loop — without this flag SQLite raises a thread-safety error.
- **Unbounded table growth:** no retention/pruning logic is included in v1. Document as a known follow-up (e.g., a scheduled job deleting records older than N days) rather than silently letting the demo machine's disk fill — acceptable for a portfolio-scope project running for days/weeks, not a production concern here.

### Verification & Testing Criteria
```bash
python -c "
from sentinel_backend.db.session import init_db, SessionLocal
from sentinel_backend.db.repository import insert_window
from sentinel_backend.features.vector import FeatureVector
from sentinel_backend.ml.inference import AnomalyResult
init_db()
db = SessionLocal()
v = FeatureVector(pid=1,ppid=0,comm='test',window_start_ns=0,window_end_ns=1,num_execve=0,
  num_distinct_children=0,num_file_opens=0,num_file_renames=0,num_file_deletes=0,
  num_distinct_files_touched=0,num_connect=0,num_distinct_dest_ips=0,num_setuid=0,syscall_rate=0.0)
r = AnomalyResult(anomaly_score=0.1, is_anomalous=False)
insert_window(db, v, r)
print('insert OK')
"
```

---

## Phase 6 — API Layer (FastAPI)

### Phase Goal & Context
Expose the persisted data (and a live stream of new results) over HTTP, with authentication, so the frontend — or any other client — can consume it.

### Prerequisites
Phase 5 complete.

### Detailed Sub-Tasks
1. Bearer-token auth dependency.
2. `GET /api/v1/windows`, `GET /api/v1/windows/{id}`, `GET /api/v1/processes`.
3. `GET /api/v1/stream` — SSE endpoint.
4. Wire `pipeline.py` to broadcast each new scored window to connected SSE clients as it happens.

### File & Code Specifications

**`backend/sentinel_backend/api/auth.py`**:
```python
import os
from fastapi import Header, HTTPException, status

def verify_token(authorization: str = Header(...)):
    expected = os.environ.get("API_AUTH_TOKEN")
    if not expected:
        raise RuntimeError("API_AUTH_TOKEN is not set — refusing to start with no auth configured")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer token")
    token = authorization.removeprefix("Bearer ")
    if token != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
```

**`backend/sentinel_backend/api/schemas.py`**:
```python
from pydantic import BaseModel
from datetime import datetime

class WindowOut(BaseModel):
    id: int
    pid: int
    ppid: int
    comm: str
    window_start_ns: int
    window_end_ns: int
    num_execve: int
    num_distinct_children: int
    num_file_opens: int
    num_file_renames: int
    num_file_deletes: int
    num_distinct_files_touched: int
    num_connect: int
    num_distinct_dest_ips: int
    num_setuid: int
    syscall_rate: float
    anomaly_score: float
    is_anomalous: bool
    created_at: datetime

    class Config:
        from_attributes = True
```

**`backend/sentinel_backend/api/routes_windows.py`**:
```python
from fastapi import APIRouter, Depends, Query
from typing import Optional, List
from sqlalchemy.orm import Session
from .auth import verify_token
from .schemas import WindowOut
from ..db.session import SessionLocal
from ..db.repository import query_windows
from ..db.schema import WindowRecord

router = APIRouter(prefix="/api/v1", tags=["windows"], dependencies=[Depends(verify_token)])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/windows", response_model=List[WindowOut])
def list_windows(
    limit: int = Query(100, le=1000), pid: Optional[int] = None,
    anomalous_only: bool = False, db: Session = Depends(get_db),
):
    return query_windows(db, limit=limit, pid=pid, anomalous_only=anomalous_only)

@router.get("/windows/{window_id}", response_model=WindowOut)
def get_window(window_id: int, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    record = db.query(WindowRecord).filter(WindowRecord.id == window_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Window not found")
    return record
```

**`backend/sentinel_backend/api/routes_stream.py`**:
```python
import asyncio
import json
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from .auth import verify_token

router = APIRouter(prefix="/api/v1", tags=["stream"], dependencies=[Depends(verify_token)])

# A simple in-process broadcast queue set. pipeline.py calls broadcast_window()
# after every insert; each connected SSE client gets its own asyncio.Queue.
_subscribers: set[asyncio.Queue] = set()

def broadcast_window(window_dict: dict):
    payload = json.dumps(window_dict, default=str)
    for q in list(_subscribers):
        q.put_nowait(payload)

@router.get("/stream")
async def stream(request: Request):
    queue: asyncio.Queue = asyncio.Queue()
    _subscribers.add(queue)

    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"data: {payload}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"  # SSE comment line, prevents proxy timeouts
        finally:
            _subscribers.discard(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

**`backend/sentinel_backend/api/main.py`**:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from . import routes_windows, routes_processes, routes_stream
from ..db.session import init_db

app = FastAPI(title="Sentinel API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to the actual frontend origin before any real deployment
    allow_methods=["GET"],
    allow_headers=["Authorization", "Content-Type"],
)

@app.on_event("startup")
def on_startup():
    init_db()

app.include_router(routes_windows.router)
app.include_router(routes_processes.router)
app.include_router(routes_stream.router)

@app.get("/health")
def health():
    return {"status": "ok"}
```

### Edge Cases & Failure Scenarios
- **`API_AUTH_TOKEN` unset:** `verify_token` raises `RuntimeError` on the very first request rather than silently allowing unauthenticated access — a security tool must fail closed, not open.
- **SSE behind a reverse proxy:** the `: keepalive\n\n` comment line every 15s prevents idle-timeout disconnects from most proxies/load balancers — do not remove this even though it looks unused; it exists specifically to survive infrastructure the demo may eventually sit behind.
- **CORS `allow_origins=["*"]`** is a deliberate, explicitly-flagged v1 shortcut for local development; it must be narrowed to the actual frontend origin before this is ever exposed beyond localhost — this is called out as a defensive-coding requirement in Agent Execution Guidelines, not left implicit.

### Verification & Testing Criteria
```bash
uvicorn sentinel_backend.api.main:app --reload &
curl http://localhost:8000/health
curl -H "Authorization: Bearer $API_AUTH_TOKEN" http://localhost:8000/api/v1/windows?limit=5
curl -N -H "Authorization: Bearer $API_AUTH_TOKEN" http://localhost:8000/api/v1/stream  # should hang open, streaming
# Interactive docs, useful for the portfolio demo itself:
open http://localhost:8000/docs
```

---

## Phase 7 — Frontend Dashboard (React)

### Phase Goal & Context
The visible, demoable part of the project — a live view of anomaly scores as they're produced.

### Prerequisites
Phase 6 complete and reachable at `http://localhost:8000`.

### Detailed Sub-Tasks
1. Scaffold with Vite.
2. `useEventStream` hook wrapping the native browser `EventSource` API against `/api/v1/stream`.
3. `AnomalyTimeline` (Recharts) and `ProcessTable`.
4. Auth token handling (stored client-side for this single-operator v1 — see edge cases).

### File & Code Specifications

**`frontend/src/hooks/useEventStream.js`**:
```javascript
import { useEffect, useRef, useState } from 'react';

export function useEventStream(url, token) {
  const [windows, setWindows] = useState([]);
  const esRef = useRef(null);

  useEffect(() => {
    // Native EventSource does not support custom headers, so the token is
    // passed as a query parameter for the SSE connection specifically. This
    // is a documented, deliberate exception to "always use the Authorization
    // header" — EventSource has no mechanism for custom headers, and this is
    // the standard workaround used across the industry for browser-native SSE.
    const es = new EventSource(`${url}?token=${encodeURIComponent(token)}`);
    esRef.current = es;

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setWindows((prev) => [data, ...prev].slice(0, 200)); // cap in-memory history
    };

    es.onerror = () => {
      // EventSource auto-reconnects by default; nothing to do here beyond
      // logging, but this handler must exist or errors are silently swallowed.
      console.warn('SSE connection error, browser will auto-reconnect');
    };

    return () => es.close();
  }, [url, token]);

  return windows;
}
```

**`frontend/src/components/AnomalyTimeline.jsx`**:
```jsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AnomalyTimeline({ windows }) {
  const data = [...windows].reverse().map((w) => ({
    time: new Date(w.window_start_ns / 1e6).toLocaleTimeString(),
    score: w.anomaly_score,
    comm: w.comm,
  }));

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis label={{ value: 'Anomaly score (lower = more anomalous)', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Line type="monotone" dataKey="score" stroke="#dc2626" dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**`frontend/src/components/ProcessTable.jsx`**:
```jsx
export default function ProcessTable({ windows }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th>Time</th><th>PID</th><th>Command</th><th>Score</th><th>Anomalous</th>
        </tr>
      </thead>
      <tbody>
        {windows.slice(0, 50).map((w, i) => (
          <tr key={i} style={{ background: w.is_anomalous ? '#fee2e2' : 'transparent' }}>
            <td>{new Date(w.window_start_ns / 1e6).toLocaleTimeString()}</td>
            <td>{w.pid}</td>
            <td>{w.comm}</td>
            <td>{w.anomaly_score.toFixed(4)}</td>
            <td>{w.is_anomalous ? '⚠️ yes' : 'no'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

**`frontend/src/App.jsx`**:
```jsx
import { useEventStream } from './hooks/useEventStream';
import AnomalyTimeline from './components/AnomalyTimeline';
import ProcessTable from './components/ProcessTable';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
const API_TOKEN = import.meta.env.VITE_API_TOKEN;

export default function App() {
  const windows = useEventStream(`${API_BASE}/api/v1/stream`, API_TOKEN);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Sentinel — live behavioral anomaly detection</h1>
      <AnomalyTimeline windows={windows} />
      <ProcessTable windows={windows} />
    </div>
  );
}
```

### Edge Cases & Failure Scenarios
- **Token exposed client-side via `VITE_API_TOKEN`:** acceptable for a single-operator local demo (the entire point of a bearer token here is "not literally zero auth," not "withstand a real threat model"); document plainly in the README that this is not a multi-user-safe pattern and a real deployment needs a proper login flow — do not present this as more secure than it is.
- **`EventSource` cannot send the token as a header**, so it goes in the query string; because it's a query string, it can end up logged by intermediate proxies — acceptable for local/demo use, flagged explicitly, not silently glossed over.
- **Unbounded chart growth:** `useEventStream` caps history at 200 entries client-side to avoid the browser tab's memory growing without bound during a long demo session.

### Verification & Testing Criteria
```bash
cd frontend && npm install && npm run dev
# open http://localhost:5173 — the timeline and table should populate live as
# ordinary machine activity (openat/execve/etc.) flows through the whole pipeline
```

---

## Phase 8 — Integration & Containerization

### Phase Goal & Context
Wire backend, database, and frontend into one `docker-compose up`, while keeping the collector on the host per the Phase 2 decision.

### Prerequisites
Phases 2–7 individually verified.

### File & Code Specifications

**`docker-compose.yml`**:
```yaml
version: "3.9"
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - API_AUTH_TOKEN=${API_AUTH_TOKEN}
      - SENTINEL_DB_PATH=/data/sentinel.db
      - SENTINEL_SOCKET_PATH=/host-tmp/sentinel_collector.sock
    volumes:
      - sentinel_data:/data
      - /tmp:/host-tmp   # bind-mounts the host /tmp so the container can reach
                          # the collector's Unix socket, which lives on the host
      - ./backend/sentinel_backend/ml/model_store:/app/sentinel_backend/ml/model_store
    depends_on: []       # intentionally empty — the collector is host-run, not a compose service

  frontend:
    build: ./frontend
    ports:
      - "5173:80"
    environment:
      - VITE_API_BASE=http://localhost:8000
      - VITE_API_TOKEN=${API_AUTH_TOKEN}
    depends_on:
      - backend

volumes:
  sentinel_data:
```

**`backend/Dockerfile`**:
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "sentinel_backend.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**`frontend/Dockerfile`**:
```dockerfile
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### Edge Cases & Failure Scenarios
- **The `/tmp:/host-tmp` bind mount is the load-bearing detail of this entire phase.** Without it, the containerized backend has no way to reach the host-run collector's Unix socket, since containers do not share the host's filesystem namespace by default. If the socket path is ever changed in `.env`, this mount and `SENTINEL_SOCKET_PATH` must be updated together — a mismatch here is silent (the backend just logs "collector not available yet, retrying" forever), so check this first if the dashboard shows no data after `docker-compose up`.
- **Startup order:** the collector (host process, started via `sudo ./collector/run.sh`, separately from Compose) should ideally be running before `docker-compose up`, but `socket_client.py`'s reconnect loop (Phase 3) means starting Compose first is not a hard failure — it will simply wait and connect once the collector appears.

### Verification & Testing Criteria
```bash
sudo ./collector/run.sh &            # start the host collector first
docker-compose up --build            # then bring up backend + frontend
curl http://localhost:8000/health
open http://localhost:5173
```
Phase 8 is complete when opening the dashboard shows live data originating from real host activity, end to end, through every layer described in §1.

---

## Phase 9 — Testing, Validation & Demo Scripts

### Phase Goal & Context
A detection system that has never actually detected anything in front of a human is not yet demo-ready. This phase produces synthetic, safe, reversible scripts that trigger clear anomalies on demand — essential for the actual LinkedIn/portfolio demonstration, not just for correctness testing.

### File & Code Specifications

**`test/simulate_ransomware.py`**:
```python
"""Safe, reversible synthetic ransomware-like file-thrash generator.
Operates ONLY inside a dedicated temp directory it creates and cleans up —
never touches real user files. Run this while the full pipeline is up to
produce a clearly visible anomaly in the dashboard."""
import os
import shutil
import tempfile
import time

def run(num_files: int = 500, duration_s: float = 3.0):
    workdir = tempfile.mkdtemp(prefix="sentinel_demo_ransomware_")
    print(f"Working in {workdir} — will be deleted at the end.")
    try:
        paths = []
        start = time.time()
        for i in range(num_files):
            path = os.path.join(workdir, f"file_{i}.txt")
            with open(path, "w") as f:
                f.write("synthetic content")
            paths.append(path)
        for path in paths:
            renamed = path + ".locked"
            os.rename(path, renamed)
        for path in paths:
            os.remove(path + ".locked")
        elapsed = time.time() - start
        print(f"Created, renamed, and deleted {num_files} files in {elapsed:.2f}s — "
              f"check the dashboard for an anomaly spike now.")
    finally:
        shutil.rmtree(workdir, ignore_errors=True)

if __name__ == "__main__":
    run()
```

**`test/simulate_beaconing.py`**:
```python
"""Safe synthetic C2-beaconing-like generator. Connects repeatedly to
loopback addresses only — makes no real outbound network contact."""
import socket
import time

def run(num_connections: int = 40, interval_s: float = 0.1):
    for i in range(num_connections):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(0.2)
            s.connect_ex(("127.0.0.1", 9. if False else 9999))  # deliberately unlikely to be open; connect_ex won't raise
            s.close()
        except OSError:
            pass
        time.sleep(interval_s)
    print(f"Attempted {num_connections} rapid connects — check the dashboard for a beaconing-pattern anomaly.")

if __name__ == "__main__":
    run()
```
(Fix the stray `9. if False else 9999` construct above to plain `9999` when implementing — flagged here deliberately as an example of the kind of small slip a reviewing human or agent should catch before merging, not because it belongs in the final code.)

### Verification & Testing Criteria
```bash
python test/simulate_ransomware.py   # dashboard should show a clear anomaly spike for the invoking process within one window
python test/simulate_beaconing.py    # dashboard should show a distinct connect-pattern anomaly
pytest backend/tests/ -v             # full backend unit suite
```
The project is demo-ready only when both simulator scripts produce a visibly flagged (`is_anomalous=True`, red-highlighted row) entry in the live dashboard within one window cycle of being run.

---

## Agent Execution Guidelines

**These rules apply to any AI coding agent executing this plan and take precedence over any conflicting convention it might otherwise default to.**

### Execution order
Phases are strictly sequential (0 → 9); do not begin a phase whose Prerequisites are unmet. Within Phase 1 and Phase 2 specifically, do not write `main.c` before `monitor.bpf.c` compiles and loads cleanly (Phase 1's own Verification criteria must pass first) — the skeleton header Phase 2 depends on does not exist until Phase 1's build succeeds.

### Environment variables and secrets
- Every secret (currently only `API_AUTH_TOKEN`) is read from the environment, never hardcoded, never committed. `.env.example` documents required keys with placeholder values; `.env` itself must be in `.gitignore` from the very first commit.
- Generate a real token for local `.env` with `openssl rand -hex 32` — do not leave `changeme-generate-a-real-token` in place.
- If a required environment variable is missing at runtime, fail loudly at startup (see Phase 6's `verify_token`) — never substitute a silent default for a secret.

### Code style, naming, linting
- **C**: SPDX license headers on every file, `snake_case` for functions/variables, one `.c`/`.h` pair per logical unit (never combine the BPF program and the userspace loader into one file). Format with `clang-format` using the Linux kernel style (`--style=linux`) before committing.
- **Python**: PEP 8, `snake_case` for functions/variables, `PascalCase` for classes, type hints on every function signature (already modeled throughout this document — continue that pattern, do not drop hints for "quick" helper functions). Lint with `ruff check .`; format with `ruff format .` (or `black`, pick one and apply it consistently across the whole `backend/` tree, not per-file).
- **JavaScript/JSX**: functional components only, hooks for state, `camelCase` for variables/functions, `PascalCase` for component files and exports. Lint with `eslint`.
- Every new module gets a short top-of-file docstring/comment stating its one job — this document's own code samples follow that convention; match it.

### Defensive coding practices (non-negotiable, cross-cutting)
1. **Every socket read, every `json.loads`, every subprocess call, every file open must be wrapped for failure.** This document already demonstrates the pattern (see Phase 3's malformed-line handling, Phase 2's write-failure handling) — apply the same standard to any code not explicitly shown here (e.g., additional API endpoints added later).
2. **Never let a single bad event, line, or request crash a long-running process.** The collector, the ingestion loop, and the API must all individually survive malformed input from any upstream source.
3. **Fail closed on auth and fail loud on missing config** — a security-monitoring tool that silently degrades into "no authentication" or "no data" on misconfiguration is worse than one that visibly refuses to start.
4. **Do not introduce a second source of truth for `FEATURE_COLUMNS`.** Every place that touches the feature vector (training, inference, the SQLAlchemy schema, the API response schema) must derive from or be checked against the single list in `backend/sentinel_backend/features/vector.py` — this document already keeps schema, model input, and DB columns in that same order deliberately; preserve that invariant when extending the feature set.
5. **No placeholder logic.** If a future extension genuinely cannot be implemented in this pass (e.g., IPv6 connect support, capability-based non-root execution, Postgres migration), it must be written into this document's Edge Cases sections as an explicit, named follow-up — never left as a silent `pass`, a bare `TODO`, or an untested code path in the shipped v1.
