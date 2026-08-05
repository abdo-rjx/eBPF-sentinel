# Sentinel — A Host-Based Intrusion Detection System (HIDS)

> A deep, from-scratch explanation of the whole project: the architecture, the
> logic behind every layer, the data flow, and why each design decision was made.
> Nothing is assumed — everything starts from first principles.

---

## Table of contents

1. [What Sentinel is](#1-what-sentinel-is)
2. [The threat model and design philosophy](#2-the-threat-model-and-design-philosophy)
3. [System architecture](#3-system-architecture)
4. [Tier 1 — The kernel eBPF collector](#4-tier-1--the-kernel-ebpf-collector)
5. [Tier 2 — The C userspace collector](#5-tier-2--the-c-userspace-collector)
6. [The wire contract (kernel ↔ collector ↔ backend)](#6-the-wire-contract)
7. [Tier 3 — The Python backend](#7-tier-3--the-python-backend)
8. [Tier 4 — The React dashboard](#8-tier-4--the-react-dashboard)
9. [The synthetic attack simulators](#9-the-synthetic-attack-simulators)
10. [Detection logic end-to-end (worked examples)](#10-detection-logic-end-to-end)
11. [The four issues fixed for the review](#11-the-four-issues-fixed-for-the-review)
12. [Running the system end-to-end](#12-running-the-system-end-to-end)
13. [Known gaps and limitations](#13-known-gaps-and-limitations)

---

## 1. What Sentinel is

Sentinel is a **host-based intrusion detection system (HIDS)**. It watches the
system calls that every running process makes — at the kernel level — and turns
them into statistical "behavior profiles" for each process. It then asks an
unsupervised machine-learning model one question:

> "Does this process's behavior over the last 5 seconds look like the behavior
> of every other process we've ever seen, or is it an outlier?"

If it's an outlier, Sentinel flags it as a **potential attack**. It does this
with **no signature database** — there is no list of "known malware hashes" or
"IOC strings" anywhere. It's *behavioral* (anomaly-based) detection, which is
what makes it able to catch **zero-day** attacks: a brand-new piece of malware
that no vendor has ever seen still has to *behave* differently from a normal
process, and that behavioral difference is exactly what Sentinel measures.

The three physical tiers:

```
kernel eBPF (collector/bpf/monitor.bpf.c)
   → BPF ring buffer
   → C collector (collector/src/main.c) — NDJSON over AF_UNIX socket /tmp/sentinel_collector.sock
   → Python backend (backend/sentinel_backend/) — windowing → feature vectors → Isolation Forest → SQLite
   → REST + SSE (FastAPI, :8000)
   → React/Vite dashboard (frontend/, :5173)
```

---

## 2. The threat model and design philosophy

Before writing any code, you have to decide *what you're trying to catch* and
*what you're willing to tolerate*. Sentinel's answers:

### What we try to catch (the threat model)

| Attack class | Observable signature in syscalls |
|---|---|
| **Ransomware** | Mass file creation / renaming / deletion in a burst, especially `.locked`-style rename+delete patterns, at a high syscall rate |
| **C2 beaconing** | A process repeatedly connecting to the *same* small set of destination IPs on a regular cadence |
| **Privilege escalation** | A process suddenly calling `setuid()` to change identity |
| **Malware execution / persistence** | Unexpected `execve` of unknown binaries; a process spawning an unusual number of children |
| **Lateral movement / recon** | A process opening a suspiciously large set of files or connecting to many distinct hosts |

### The philosophy (three design rules)

1. **Collect raw, decide later.** The eBPF layer records *everything* as raw
   events. All intelligence — aggregation, scoring, alerting — lives in the
   backend where it's cheap to change. The kernel program is deliberately dumb.

2. **Behavior is statistical, not rule-based.** Normal systems are noisy. The
   question "is this an attack?" is really "is this an *outlier*?" — a
   statistical question. So the detector is an unsupervised model (Isolation
   Forest) trained on *normal* behavior, not a set of "attack signatures."

3. **Three physically separated tiers over well-defined wire formats.** The
   kernel never talks to Python directly, the Python never talks to the
   frontend directly. Each boundary is a documented, versioned contract
   (byte-for-byte struct / NDJSON schema / REST+SSE). This makes each tier
   independently testable and swappable.

---

## 3. System architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  KERNEL SPACE                                                        │
│                                                                     │
│  monitor.bpf.c  (eBPF program, loaded via CO-RE/BTF)                │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 7 tracepoints: sys_enter_execve/connect/accept/openat/       │   │
│  │               unlink/rename/setuid                           │   │
│  │      │ each fires → fill_common() → emit_event()             │   │
│  │      │                                                       │   │
│  │      ▼                                                       │   │
│  │  BPF ring buffer map "events" (256 KB)                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ ring_buffer__poll() (userspace, 200ms)
┌───────────────────────────▼─────────────────────────────────────────┐
│  USERSAPCE: C collector  (collector/src/main.c, runs as root)       │
│  · adds realtime offset to monotonic timestamp                      │
│  · serializes each struct event → one NDJSON line                   │
│  · writes lines over AF_UNIX socket /tmp/sentinel_collector.sock    │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ stream socket, one JSON object per line
┌───────────────────────────▼─────────────────────────────────────────┐
│  PYTHON BACKEND  (FastAPI on :8000)                                 │
│                                                                     │
│  socket_client.stream_events()  ──retry loop──▶ RawEvent            │
│        │                                                            │
│        ▼                                                            │
│  WindowAggregator  (5s buckets keyed by (pid, first_seen_ts))       │
│        │  reaper thread flushes silent windows                      │
│        ▼                                                            │
│  FeatureVector  (10 behavioral features)                            │
│        │                                                            │
│        ▼                                                            │
│  AnomalyScorer  (Isolation Forest, trained on baseline.csv)         │
│        │                                                            │
│        ▼                                                            │
│  apply_detection_policy  (daemon allowlist + beaconing rule)        │
│        │                                                            │
│        ▼                                                            │
│  SQLite "windows" table   ────▶  SSE broadcast to subscribers       │
│        │                                                            │
│        ▼                                                            │
│  REST routers: /windows /processes /stats /stream + /analysis       │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ REST + Server-Sent Events
┌───────────────────────────▼─────────────────────────────────────────┐
│  REACT/VITE DASHBOARD  (:5173)                                      │
│  · useEventStream → EventSource → SSE ?token=…                      │
│  · demo mode (mock data) when no backend URL                        │
│  · Process table / detail drawer / anomaly timeline / AI panel      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Tier 1 — The kernel eBPF collector

### 4.1 Why eBPF, and why it runs in the kernel

An HIDS that watches syscalls has two options:

- **ptrace / LD_PRELOAD interception** — these live in *userspace* and are
  trivially bypassed by malware (ptrace-based tracing can be detected and
  evaded; LD_PRELOAD can be unset or ignored by statically-linked binaries).
- **Kernel-level instrumentation** — observe the syscall *before* userspace
  even sees it. This cannot be escaped by userland tricks, because it happens
  at the point where the process transitions into the kernel.

**eBPF** (extended Berkeley Packet Filter) is Linux's sanctioned way to run
safe, sandboxed programs inside the kernel. A program is loaded by a privileged
process (our C collector, running as root), verified by the kernel to terminate
and never dereference arbitrary memory, then JIT-compiled and attached to
*events*. We attach ours to **tracepoints**, which are stable, versioned
instrumentation hooks in the kernel's syscall-entry paths.

### 4.2 CO-RE and BTF: why the program is portable

Kernel internal structures (like `struct task_struct`) change between kernel
versions. A traditional "kernel module" is compiled against one exact kernel
and breaks on the next update. We avoid that with **CO-RE (Compile Once, Run
Everywhere)**:

- **BTF (BPF Type Format)**: the kernel exposes a machine-readable description
  of its own types at `/sys/kernel/btf/vmlinux`. The C program includes
  `vmlinux.h` — a generated header of all those types. We `#include` a
  *specific* host's vmlinux.h but the bytecode stays generic.
- At load time, `libbpf` **relocates** every field access against the *actual*
  running kernel. `BPF_CORE_READ(task, real_parent, tgid)` is a macro that
  compiles into a relocation describing "read field `real_parent`, then field
  `tgid`, of a task struct" — libbpf resolves the real offsets when the program
  is attached.

**Important workflow rule:** `vmlinux.h` is machine-generated and
kernel-version-specific. It must be regenerated per machine with
`sudo bpftool btf dump file /sys/kernel/btf/vmlinux format c > collector/bpf/vmlinux.h`.
Never hand-edit it.

### 4.3 The seven tracepoints — what each one catches

`collector/bpf/monitor.bpf.c` attaches seven tracepoint programs, one per
syscall. Each maps to a *specific* attack-observable:

| Tracepoint | When it fires | What behavior it reveals |
|---|---|---|
| `sys_enter_execve` | A process asks the kernel to run a new binary | Program launch — malware execution, suspicious binaries, script drops |
| `sys_enter_connect` | A process initiates a TCP/UDP connection | Network contact — C2 beaconing, exfiltration, lateral movement |
| `sys_enter_accept` | A process accepts an incoming connection | Server behavior — reverse shells, open backdoors |
| `sys_enter_openat` | A process opens a file | File access — ransomware file churn, recon, sensitive-file reads |
| `sys_enter_unlink` | A process deletes a file | Destruction — ransomware deleting originals after encryption |
| `sys_enter_rename` | A process renames a file | Encrypt-then-rename (`.locked` pattern), persistence via renaming |
| `sys_enter_setuid` | A process changes its user ID | Privilege escalation — `setuid(0)` attempts |

Why *sys_enter_* (the syscall *entry* tracepoint) rather than *sys_exit_*? At
entry, the arguments are exactly what the caller requested (we want the
*intent* — the filename being opened, the IP being connected to). On exit, the
arguments may have been mutated and the struct is less stable. We also see the
attempt even if the syscall later fails (e.g., a connect to a refused port) —
which is actually *more* useful for detection (failed connects are a beaconing
signature).

### 4.4 The common event-fill helper

Every tracepoint calls `fill_common()` to populate the fields every event
shares:

```c
static void fill_common(struct event *e) {
    e->timestamp_ns = bpf_ktime_get_ns();          // CLOCK_MONOTONIC — ns since boot
    u64 pid_tgid = bpf_get_current_pid_tgid();
    e->pid = pid_tgid >> 32;                        // upper half = process id
    e->tid = (u32)pid_tgid;                         // lower half = thread id
    e->uid = bpf_get_current_uid_gid();
    bpf_get_current_comm(&e->comm, sizeof(e->comm)); // task name, ≤15 chars
    e->ppid = BPF_CORE_READ(task, real_parent, tgid); // parent process id
}
```

**The two non-obvious facts hidden here:**

1. **`bpf_ktime_get_ns()` is CLOCK_MONOTONIC** — nanoseconds *since boot*, not
   since the Unix epoch (1970). This single detail caused the "1970 timestamp"
   bug and the window-reaper bug (see [§11](#11-the-four-issues-fixed-for-the-review)).
2. **`comm` is truncated to 16 bytes** (`TASK_COMM_LEN = 16`, of which one byte
   is the NUL terminator, so ≤15 printable chars). This is why the daemon
   allowlist stores truncated names like `systemd-journal` (from
   `systemd-journald`), and why the backend's `comm` matching must use those
   truncated forms.

### 4.5 The event struct — one flat, shared struct

`collector/src/events.h` defines `struct event`. Critically, **the exact same
struct definition exists in the kernel program (`monitor.bpf.c`) and in the C
userspace collector (`main.c`)** — it is the byte-for-byte contract between
Tier 1 and Tier 2. Fields:

```c
struct event {
    unsigned long long timestamp_ns;  // ns (monotonic in kernel; offset added in userspace)
    int   pid, tid, ppid, uid;        // process/thread/parent/user ids
    char  comm[16];                   // task name (truncated)
    int   event_type;                 // 1..7 → execve..setuid
    char  filename[256];              // for openat/unlink/rename/execve
    unsigned int dst_ip;              // for connect (network-order int)
    unsigned int dst_port;            // for connect
    int   target_uid;                 // for setuid
};
```

**Design decision — flat struct, not a union.** Different event types need
different fields, so a union would be more memory-efficient. It's deliberately
*flat* instead: the kernel program fills only the fields that matter per event
type and zeroes the rest, and both sides share one identical layout. The cost
(every event carries a few unused bytes) buys *simplicity and safety* — no
union-tag bookkeeping, no risk of the two sides disagreeing on which fields
overlap. This struct is the wire format; both sides must change together.

### 4.6 The ring buffer — why it's loss-resistant

Events are written into a **BPF ring buffer** (map named `events`, 256 KB).
This is a lock-free, per-CPU buffer the kernel program `reserve()`s slots in and
the userspace collector `poll()`s. Why a ring buffer and not a simple perf
array or map?

- **Ordering**: ring buffers preserve arrival order, which matters because we
  later compute *rates* and *window spans*.
- **Backpressure without dropping order**: if the buffer is full the kernel
  program can sleep (for syscall tracepoints) or drop the *newest* event rather
  than corrupting the stream.
- **Efficient batching**: the userspace side can read many events per poll
  syscall.

---

## 5. Tier 2 — The C userspace collector

`collector/src/main.c` does four jobs:

1. Load the eBPF skeleton, attach the tracepoints, and keep the ring buffer
   drained.
2. Convert each raw event's *monotonic* timestamp into *real wall-clock epoch*
   time.
3. Serialize each event to **one line of NDJSON**.
4. Stream those lines over a **Unix stream socket** to the Python backend —
   and survive the backend dying, rebooting, or reconnecting.

### 5.1 Skeleton loading and the poll loop

Using `libbpf`, the collector includes the generated `monitor.skel.h`
(regenerated by `make` from `monitor.bpf.c`). It:

- opens and loads the BPF program,
- attaches each of the 7 tracepoint links,
- creates a `ring_buffer` handle bound to the `events` map with a callback,
- loops on `ring_buffer__poll(rb, 200)` — 200ms batches.

### 5.2 The clock offset (the 1970-bug fix)

This is the crux of the timestamp fix. The kernel only ever sees monotonic time,
but everyone downstream (the UI, the retention pruner) thinks in *wall-clock
epoch* time. The collector bridges the two domains:

```c
static long long clock_offset_ns = 0;

static void refresh_clock_offset(void) {
    struct timespec rt, mt;
    if (clock_gettime(CLOCK_REALTIME, &rt) == 0 &&
        clock_gettime(CLOCK_MONOTONIC, &mt) == 0) {
        clock_offset_ns =
            ((long long)rt.tv_sec * 1000000000LL + rt.tv_nsec)
          - ((long long)mt.tv_sec * 1000000000LL + mt.tv_nsec);
    }
}
```

The offset is *realtime_now − monotonic_now*, sampled at nearly the same
instant, so the difference between the two clocks is exactly what must be added
to a monotonic timestamp to convert it to epoch. In `emit_event()`:

```c
unsigned long long ts_ns = (unsigned long long)e->timestamp_ns
                         + (unsigned long long)clock_offset_ns;
```

and `ts_ns` is what gets serialized. The offset is refreshed every 200ms poll
so NTP clock steps are absorbed within a batch.

**Why this logic is correct:** a monotonic timestamp `M` (since boot) plus the
offset `(realtime_now − monotonic_now)` yields `M + realtime_now − monotonic_now`.
If both samples are taken at the same instant, `realtime_now − monotonic_now`
is a constant offset across the whole boot (the two clocks differ only by their
start time, up to small drift). So any event timestamp converts cleanly.

### 5.3 NDJSON serialization

Each event becomes one line, e.g.:

```json
{"ts":1754090500123456789,"pid":2841,"tid":2841,"ppid":1,"uid":1000,"comm":"python3.12","event_type":"openat","filename":"/tmp/foo","dst_ip":0,"dst_port":0,"target_uid":0}
```

**The deliberate flaw:** `main.c` does **not** JSON-escape `comm` or `filename`.
A filename containing a quote or backslash produces a malformed JSON line. This
is intentional pragmatism (escaping in C is error-prone and slow) — the backend
is required to *tolerate* malformed lines by logging and skipping them
(see [§7.1](#71-ingestion--the-socket-client)). This is documented in the wire
contract.

### 5.4 The Unix socket lifecycle and SIGPIPE

- The socket is `AF_UNIX, SOCK_STREAM` at `/tmp/sentinel_collector.sock`.
- **Why stream (TCP-like) and not datagram (UDP-like)?** Because NDJSON over a
  stream gives us *reliable, ordered, delimited* delivery; datagrams can drop
  and arrive out of order, and a single datagram would need to fit one event.
- **Why a Unix socket at all, and not TCP on localhost?** Unix sockets are
  faster (no IP stack), and they're scoped to the host — nothing network-facing.
  The collector (root) and backend (normal user) both live on this machine.
- **SIGPIPE handling:** the collector writes with `write()` to the socket. If
  the backend has closed its end, the write triggers `SIGPIPE`, which by default
  *terminates the process*. The collector installs `signal(SIGPIPE, SIG_IGN)`
  so a vanished backend doesn't kill the sensor — the write just fails and the
  collector keeps polling the ring buffer.
- On a failed write it closes and re-`bind`s the socket, so a backend restart
  can reconnect cleanly.

---

## 6. The wire contract

The contract is the *only* way the tiers communicate. Three things must stay in
sync or the whole system silently breaks:

1. **`struct event`** (C) — identical in `monitor.bpf.c` (kernel) and `main.c`
   (userspace). Change both together.
2. **NDJSON field names** — `main.c` emits `ts,pid,tid,ppid,uid,comm,
   event_type,filename,dst_ip,dst_port,target_uid`; `RawEvent` in
   `backend/sentinel_backend/ingestion/models.py` mirrors them exactly.
3. **`event_type` string values** — `main.c`'s `type_names[]` maps the int
   codes (1–7) to `"execve","connect","accept","openat","unlink","rename",
   "setuid"`; Python's `EventType(str, Enum)` uses the same strings.

> Note: `ts` is **wall-clock epoch nanoseconds** after the collector fix
> (converted from the kernel's monotonic value). `window_start_ns` /
> `window_end_ns` and the DB column store this epoch value. Anything that
> compares these against a clock must use epoch (`time.time()`), never
> monotonic.

---

## 7. Tier 3 — The Python backend

### 7.1 Ingestion — the socket client

`backend/sentinel_backend/ingestion/socket_client.py` exposes `stream_events()`,
a **generator** that yields parsed `RawEvent` objects forever:

```python
def stream_events(socket_path: str) -> Iterator[RawEvent]:
    while True:
        # connect; on failure log + retry in 2s
        # read 64KB chunks, buffer, split on '\n'
        # for each line: json.loads → RawEvent(**data)
        # on JSONDecodeError/ValueError: log "Dropping malformed event line" and continue
```

Key behaviors:

- **Infinite retry loop with 2s backoff**: if the collector isn't up yet (or
  restarts), the backend just waits — it never crashes. This makes startup
  order irrelevant (start backend before collector and it connects on the next
  retry tick).
- **Line-delimited framing**: the 64KB read may split a JSON object across
  chunks, so the client accumulates into a buffer and only parses complete
  lines.
- **Malformed-line tolerance**: because the collector doesn't JSON-escape, some
  lines fail to parse. They're dropped with a warning, never fatal — one bad
  filename can't take down the sensor pipeline.

`RawEvent` is a pydantic model mirroring the wire contract. `EventType` is a
`str` enum so `"openat" == EventType.openat` — the 7 string values match the
collector's `type_names[]`.

### 7.2 Windowing — turning events into behavior snapshots

`WindowAggregator` groups the raw event stream into fixed **5-second** buckets
(keyed by `(pid, first_seen_ts)`), then hands each completed bucket to a
callback as a `FeatureVector`. This is where raw syscalls become *behavior*.

**Why window at all?** A single `openat` is meaningless — normal programs open
files constantly. What's meaningful is the *density and shape* of syscalls
within a short time window: "500 opens + 500 renames + 500 deletes in 5
seconds" is a signal; "1 open" is noise. Windowing is how we convert a firehose
of events into a statistical sample.

#### 7.2.1 The two non-obvious behaviors

**A. PID reuse — the window key is `(pid, first_seen_ts)`, not just `pid`.**

Linux recycles PIDs. If PID 1234 is a normal `bash` and later (after exit)
PID 1234 is a malicious process, keying only on `pid` would merge two
completely different processes into one vector. The aggregator keys on the
tuple `(pid, start_ns)` where `start_ns` is the *first event's timestamp* — a
cheap approximation of "process start time." A reused pid with a different
start time is a *different* window.

The implementation `_key_for()` is a linear scan over active accumulators
matching on pid — **O(n)** per event. For a single host this is fine (dozens of
live accumulators); it's flagged as the "known v2 optimization" (hash map
keyed by pid → list of start times).

**B. Children fan-out — the parent can't see its own forks.**

`fork()` is *not* one of our 7 hooked syscalls, so when a process spawns
children, the *parent* emits no event for it. But "number of distinct children
spawned" is a strong malware signal (botnets fork workers; droppers spawn many
children). Solution: a parallel index `_children_by_ppid: ppid → set[child
pids]`. When process P's window is flushed, we look up
`_children_by_ppid[P.pid]` and count distinct child pids. This is "merged into
the parent's vector at flush time" — the parent's *own* events alone can't
produce this feature.

#### 7.2.2 The flush path

A window is flushed when either:

1. **Elapsed-time flush**: an event for the same key arrives with
   `(now_ts − window_start_ns) >= window_seconds`. On every ingest the
   aggregator checks this and flushes if the window aged out.
2. **Reaper flush**: `_reap_loop()` runs on a daemon thread every
   `window_seconds` and flushes any accumulator whose `last_event_ns` is older
   than one window. **This is essential**: a process that stops emitting
   (finished, or a quiet attacker) would otherwise never be scored. The reaper
   guarantees every window eventually gets a verdict.

The vector is built in `_flush`:

- `num_distinct_children = len(children_by_ppid.pop(acc.pid))` — note the
  `pop`: a parent's child-count is consumed once, at its first flush.
- `num_distinct_files_touched = len(distinct_files)` — count, not list; we
  don't store paths in the DB (just counts).
- `num_distinct_dest_ips = len(distinct_dest_ips)` — same dedup for IPs.
- `syscall_rate = total_events / window_seconds` — **rate over the nominal
  5s window, not the actual activity span**. This was a deliberate fix: an
  earlier `max(span, 0.001s)` clamp inflated the rate of short-lived processes
  to ~1000/s, pushing real windows far outside the training baseline and
  creating false anomalies.

`window_end_ns` = `last_event_ns` (not `start + window_seconds`), so the window
reflects the *actual observed* span.

### 7.3 Features — the 10-dimension behavior vector

`features/vector.py` defines `FEATURE_COLUMNS` — **the single source of truth**
for the feature set. `FeatureVector.to_array()` returns the features in exactly
this order, and that ordering is simultaneously:

- the Isolation Forest model input,
- the `windows` table column set,
- the API response schema,
- the explainability z-score input.

```python
FEATURE_COLUMNS = [
    "num_execve", "num_distinct_children", "num_file_opens",
    "num_file_renames", "num_file_deletes", "num_distinct_files_touched",
    "num_connect", "num_distinct_dest_ips", "num_setuid", "syscall_rate",
]
```

| # | Feature | Meaning | Signals |
|---|---|---|---|
| 1 | `num_execve` | program launches in this window | malware execution, script drops |
| 2 | `num_distinct_children` | distinct child processes spawned | botnet fan-out, droppers |
| 3 | `num_file_opens` | files opened | recon, file churn |
| 4 | `num_file_renames` | files renamed | encrypt-then-rename (ransomware) |
| 5 | `num_file_deletes` | files deleted | destruction phase |
| 6 | `num_distinct_files_touched` | unique files touched (union of the above) | breadth of filesystem reach |
| 7 | `num_connect` | outbound connections initiated | beaconing, exfil |
| 8 | `num_distinct_dest_ips` | distinct destination IPs | "many hosts" vs "one C2 host" |
| 9 | `num_setuid` | setuid attempts | privilege escalation |
| 10 | `syscall_rate` | total events / 5s | burstiness; brute-force density |

**Critical maintenance rule:** if `FEATURE_COLUMNS` ever changes, the model
*must* be retrained — the old joblib has a different input shape and will throw
a loud shape error (intentional loudness over silent wrong scoring).

### 7.4 The model — Isolation Forest

#### 7.4.1 The theory (why this algorithm)

**Isolation Forest** is an unsupervised anomaly-detection algorithm. Its
central insight is elegant: *anomalies are few and different, so they are easy
to isolate with random splits.*

- It builds `n_estimators` random **isolation trees**. Each tree randomly picks
  a feature and a random split value between the min and max of that feature,
  then partitions the data — recursively — until every point is alone in its
  own leaf.
- **Normal points** sit in dense regions, so it takes many splits to isolate
  them → they end up in *deep* leaves.
- **Anomalous points** are far from everyone else, so a random split is very
  likely to separate them early → they end up in *shallow* leaves.

The score comes from **average path length**: short average path to isolation =
anomalous.

Why this over, say, K-means or a Gaussian model? Isolation Forest:

- is **unsupervised** — we never need labeled malware to train (critical: we
  can't enumerate attacks we haven't seen; that's the *zero-day* argument),
- handles **high-dimensional** sparse behavioral data (many zeros),
- gives a **continuous score** (`decision_function()`) we can threshold and
  display, not just a hard label.

#### 7.4.2 Training — offline on a baseline

`ml/train.py` fits `IsolationForest(n_estimators=100, contamination=0.02)` on
`baseline.csv` — a CSV of feature vectors captured during **normal** system
operation. It dumps the fitted model to
`backend/sentinel_backend/ml/model_store/isolation_forest.joblib`.

`contamination=0.02` says "I expect about 2% of the baseline to be outliers"
— it calibrates the decision boundary. **This number is the global sensitivity
knob**: too low and the forest calls everything normal; too high and it cries
wolf on ordinary noise. The empirical history: the model was once retrained on a
*dirty* baseline (containing simulator traffic) with too-low contamination,
which produced a ~60% false-positive rate; retraining on a *clean* baseline
with tuned contamination dropped the FP rate to ~2%.

#### 7.4.3 Inference — scoring one window

`AnomalyScorer.score(vector)`:

```python
X = [vector.to_array()]
raw_score = float(self.model.decision_function(X)[0])   # neg = anomalous
prediction = int(self.model.predict(X)[0])              # -1 = anomalous
return AnomalyResult(anomaly_score=raw_score,
                     is_anomalous=(prediction == -1))
```

**THE most dangerous convention in the codebase — do not "fix" it:**

> **sklearn sign convention:** `decision_function()` returns **negative** for
> anomalies and positive for normal points; `predict()` returns **-1** for
> anomalies and **1** for normal points.

Flipping either of these silently inverts *every alert in the dashboard*. The
AnomalyResult keeps the raw `anomaly_score` (negative = more anomalous) and
`is_anomalous` derived from `predict() == -1`. The frontend severity mapping
(see [§8.4](#84-severity-mapping)) treats `is_anomalous` as the alert trigger,
and the *value* of `anomaly_score` as the strength.

### 7.5 Explainability — why was a window flagged?

A raw number ("score -0.14") is not actionable. `ml/explain.py` —
`FeatureAnalyzer` — computes **per-feature z-scores** against the training
baseline:

```
z = (window_value − baseline_mean) / baseline_std
```

For each of the 10 features it reports the value, baseline mean/std, the z-score,
and a severity bucket (`|z| > 3` high, `> 1.5` medium, else low), sorted by
|z|. The "top contributors" are the features with |z| > 1.5. This powers the
`/windows/{id}/analysis` endpoint and the AI panel, turning a verdict into a
readable "this window was flagged because `num_file_renames` was 500 vs a
baseline mean of 0.4 (z = +18.4)."

**Caveat:** the baseline.csv is loaded *lazily* by the API route, resolved
relative to CWD — so the API server must be started from `backend/` or the
analysis endpoint silently has no baseline (z-scores fall back to mean=0,
std=1).

### 7.6 The detection policy — rules that the model *cannot* learn

`ml/detection_policy.py` runs **after** the model and can override the verdict.
It exists because two classes of real-world behavior are structurally
invisible to an unsupervised count-based model:

**A. The daemon allowlist (kills a false positive).**

`systemd-udevd` (and other system daemons) legitimately burst: during a
device hotplug it can rename+delete ~40 files and open ~6 connections in 5s.
To the forest that looks *exactly* like ransomware (it scores **−0.06,
anomalous**). The policy forces these well-known, trusted daemons to benign:

```python
if vector.comm in SYSTEM_DAEMONS:
    result.is_anomalous = False
    return
```

Note the allowlist stores **truncated** comm names (the kernel caps at 15
chars): `systemd-journal` (for `systemd-journald`), `systemd-userwor`,
`systemd-resolve`, etc. This is the "v2 fix" for the teacher's CRITICAL
false-positive.

**B. The beaconing rule (catches a blind spot).**

C2 beaconing = many connections to the *same* IP on a cadence. Our features
have `num_connect` and `num_distinct_dest_ips` — but empirically, 40 connects
to 1 IP scores **+0.075, NORMAL**. Why? Because the *training baseline itself
contains* single-IP connection bursts (a normal web scraper or downloader can
open 97 connects to one host), so the forest learned "many connects to one IP
= normal." The count aggregates can't express *regularity over time* — which is
what really distinguishes a beacon from a burst. The rule encodes the shape the
model is blind to:

```python
if (vector.num_connect >= BEACONING_CONNECT_THRESHOLD      # 20
        and vector.num_distinct_dest_ips <= BEACONING_MAX_DISTINCT_IPS):  # 2
    result.is_anomalous = True
```

Thresholds are tuned against `baseline.csv`: `num_connect>=20 & ips<=2` matches
**0 of 7376** baseline windows — every real heavy-connector fans out across
many IPs, so the rule has zero false positives on the baseline.

**Ordering matters:** the allowlist check runs *first* and `return`s — so a
daemon is never promoted by the beaconing rule (a `NetworkManager` hammering
one IP stays benign). The raw `anomaly_score` is preserved untouched, so the AI
panel still shows the model's honest opinion even when the policy overrides the
verdict.

`pipeline.py` wires it as a one-liner after scoring:

```python
result = scorer.score(vector)
apply_detection_policy(vector, result)
```

### 7.7 Database — SQLite, one denormalized table

- **Schema** (`db/schema.py`): a single `windows` table; `WindowRecord` maps
  the 10 features + `pid`, `ppid`, `comm`, `window_start_ns`, `window_end_ns`,
  `anomaly_score`, `is_anomalous`, `created_at`. Denormalized on purpose: read
  paths (list windows, filter anomalous, explain a window) never need a JOIN.
- **Session** (`db/session.py`): lazy-init engine, **`check_same_thread:
  False`** is *required* — ingestion runs on the pipeline's background thread
  while FastAPI serves requests on the event loop; without this flag SQLite
  refuses cross-thread connections.
- **Repository** (`db/repository.py`): `insert_window(db, vector, result)`
  persists a scored window; `query_windows(...)` supports `limit`, `pid`
  filter, `anomalous_only`.
- **Retention** (`db/retention.py`): a background loop (`start_retention_loop`,
  every 1h) prunes windows older than 24h via `prune_old_windows()`. **The
  cutoff uses `time.time()` (epoch) to match the epoch `window_end_ns`** — the
  answer to "why doesn't the table grow forever." (This was aligned with the
  epoch collector fix; a monotonic cutoff here would be a silent no-op and the
  table would grow unboundedly.)

### 7.8 The API layer

#### 7.8.1 App bootstrap and the pipeline thread

`api/main.py` builds the FastAPI app with a **lifespan hook** that:

1. calls `init_db()`, and
2. starts `run_pipeline()` in a **daemon thread** named `sentinel-pipeline`.

Why a thread and not a separate process? Because `run_pipeline()` blocks
forever consuming the socket, *and* SSE subscribers live in an in-process set
(`routes_stream._subscribers`). For the pipeline's `broadcast_window()` to reach
SSE subscribers, they must share a process. A daemon thread keeps the asyncio
event loop free while the pipeline runs.

#### 7.8.2 Auth — fail-closed

`api/auth.py`:

- `verify_token` — header-only `Authorization: Bearer <token>`, required by
  every router except `/health`. **Fails closed**: if `API_AUTH_TOKEN` is unset
  in the environment, it raises `RuntimeError` — the API refuses to run
  unauthenticated rather than serving open.
- `verify_token_any` — accepts the token *either* as the header *or* as a
  `?token=` query param. **Why:** the frontend uses the native `EventSource`
  API, which *cannot set request headers*. So the SSE stream must accept the
  token as a query param. Only the `/stream` router uses this; every other
  router keeps strict header-only auth.

#### 7.8.3 Routers

- `routes_windows` — `GET /api/v1/windows` (list, filters), `GET /windows/{id}`
  (one window), `GET /windows/{id}/analysis` (z-score explainability via
  `FeatureAnalyzer`).
- `routes_processes` — per-process aggregation views (distinct comms, latest
  windows).
- `routes_stats` — aggregate stats (totals, averages) for the header cards.
- `routes_stream` — the SSE endpoint (below).

#### 7.8.4 SSE streaming — the live telemetry channel

`routes_stream.py`:

- `_subscribers: set[asyncio.Queue]` — in-process subscriber registry.
- `broadcast_window(window_dict)` — called by `pipeline.py` after *every* DB
  insert; serializes the window dict to JSON and `put_nowait` on every
  subscriber queue.
- `GET /stream` — adds a fresh queue, returns a `StreamingResponse` that
  yields `data: {json}\n\n` per window. **The 15s keepalive comment
  `: keepalive\n\n` is load-bearing**: without it, idle proxies close the
  connection after ~30s of no data and the dashboard falls into a reconnect
  loop. Never remove it.
- On disconnect, the queue is discarded (`_subscribers.discard`).

The full live path is:

```
socket line → RawEvent → aggregator.ingest → window flush → FeatureVector
  → scorer.score → apply_detection_policy → insert_window → broadcast_window
  → SSE subscribers → dashboard
```

---

## 8. Tier 4 — The React dashboard

`frontend/` is a Vite + React app. Components of interest:
`useEventStream` (hook), `ProcessTable`, `ProcessDetailDrawer`,
`AnomalyTimeline`, `AIAnalysisPanel`, `utils/format.js`, and a severity mapper.

### 8.1 The data hook — `useEventStream`

```js
const fullUrl = token ? `${url}?token=${encodeURIComponent(token)}` : url;
const es = new EventSource(fullUrl);
```

- It connects to the backend's SSE endpoint with the token as a **query param**
  (matching `verify_token_any`).
- On each `data:` message it parses the window JSON and prepends it to a
  rolling window list (capped at 200).
- It builds the **process list** by collapsing windows to the newest per `pid`
  (`buildProcessList`) and computes header **stats** (`computeStats`):
  total windows, unique processes, anomaly counts, max anomaly score (the most
  negative), and the average syscall rate.

### 8.2 Demo mode — the dashboard with no backend

If the configured URL contains the string `undefined` (i.e. no
`VITE_API_BASE`/`VITE_API_TOKEN` were provided), the hook **never connects** —
it switches to `connectionState = 'demo_mode'` and generates mock windows with
`generateMockWindow()` on a 3.5s interval. Two of the initial 12 windows are
seeded as anomalies. This is how the dashboard is demonstrable with zero
backend running.

### 8.3 Timestamp handling (the 1970-bug surface)

Timestamps arrive as **epoch nanoseconds** (after the collector fix). The
frontend divides by `1e6` to get milliseconds and formats with the locale. The
shared `utils/format.js` adds a defensive guard:

```js
export function formatTimestamp(ns) {
  if (!Number.isFinite(Number(ns)) || Number(ns) < 1e15) return '—';
  return new Date(ns / 1e6).toLocaleString();
}
```

The `ns < 1e15` guard catches **legacy monotonic values** (~9e12 = 1970) and
renders an em-dash instead of a bogus 1970 date. Same guard in
`formatTimeOfDay` for the timeline. Demo-mode values (~1.75e18) pass the guard.

### 8.4 Severity mapping

A verdict renders as CRITICAL/HIGH/etc. based on `is_anomalous` (the alert
trigger) plus the anomaly score's magnitude for color/emphasis. Because
`is_anomalous` comes from `predict() == -1` and the score is the negative-is-bad
`decision_function()` value, the mapping logic keys the *hard alert* on
`is_anomalous` and uses the *score value* as the strength gradient. This keeps
the beaconing window (score +0.075 but policy-anomalous) rendering as CRITICAL
— the honest model score and the policy verdict are both shown, in different
places.

### 8.5 The rate formatter (the 0.2 vs 0/s fix)

Four display sites (`ProcessTable`, `ProcessDetailDrawer`, `AnomalyTimeline`,
`useEventStream` stats) previously did `Math.round(syscall_rate)`, which turned
real values like `0.2` into `0`. They now share `formatSyscallRate`:

```js
export function formatSyscallRate(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n)) return '0';
  return Number.isInteger(n) ? String(n) : n.toFixed(1); // 0.2 → "0.2", 8 → "8"
}
```

`AIAnalysisPanel` intentionally keeps the raw values (it's an analytic panel).

---

## 9. The synthetic attack simulators

Two safe scripts (`test/`) generate *real* syscall behavior on this host so the
full pipeline has something attack-like to catch. Both are provably safe: they
touch only an isolated temp dir / loopback, and clean up after themselves.

### 9.1 `simulate_ransomware.py`

```python
for i in range(500):                      # create 500 files
    open(path, "w").write("synthetic content")
for path in paths: os.rename(path, ".locked")   # rename all → .locked
for path in paths: os.remove(path + ".locked")  # delete all
```

Within ~3 seconds this produces, for the `python3.12` process:

- `num_file_opens ≈ 500`, `num_file_renames ≈ 500`, `num_file_deletes ≈ 500`
- `num_distinct_files_touched ≈ 500`
- `syscall_rate ≈ 1500/5 ≈ 300`

Isolation Forest verdict (verified offline): **anomalous, score ≈ −0.142** —
the multivariate burst is *far* outside the dense normal region. This is the
"zero-day ransomware caught by behavior, not signature" proof.

### 9.2 `simulate_beaconing.py`

```python
for i in range(40):                       # 40 rapid connects
    socket.connect_ex(("127.0.0.1", 9999)); time.sleep(0.1)
```

Within ~4 seconds: `num_connect = 40`, `num_distinct_dest_ips = 1`,
`syscall_rate ≈ 8`.

Isolation Forest verdict (verified offline): **normal, score ≈ +0.075** — the
model literally cannot see this as anomalous because the baseline contains
single-IP bursts. The **policy beaconing rule** (connect ≥ 20 & ips ≤ 2)
promotes it to anomalous. This is why the detection *policy layer* exists and
why the demo narrative says "the policy layer caught beaconing," not "the model
did."

### 9.3 The udevd burst (the false-positive case)

A device hotplug (`systemd-udevd`) bursts: renames=40, deletes=40, connect=6,
rate≈17 → the forest scores **−0.06, anomalous** (it looks like ransomware).
The allowlist suppresses it to benign. This is the teacher's CRITICAL
false-positive, fixed.

---

## 10. Detection logic end-to-end (worked examples)

Walking one real window through the whole system, for each of the three cases:

**Ransomware (caught by the model):**
1. `simulate_ransomware.py` makes 500 open+rename+delete syscalls.
2. Kernel tracepoints emit ~1500 events with `comm="python3.12"`.
3. `WindowAggregator` buckets them into one 5s window.
4. `_flush` builds `FeatureVector` (opens=500, renames=500, deletes=500,
   distinct_files=500, rate=300).
5. `AnomalyScorer`: `decision_function` → **−0.142** (very negative =
   anomalous), `predict` → **−1**.
6. `apply_detection_policy`: not a daemon; connect=0 → rule silent. Verdict
   stays anomalous.
7. Inserted to `windows`, broadcast over SSE.
8. Dashboard: CRITICAL; AI panel shows the z-scores (renames +18, deletes +18,
   ...).

**Beaconing (caught by the policy rule):**
1. `simulate_beaconing.py` makes 40 connects to 127.0.0.1.
2. Window: `num_connect=40`, `num_distinct_dest_ips=1`, rate≈8.
3. `AnomalyScorer` → **+0.075, predict +1 (NORMAL)** — the model's blind spot.
4. `apply_detection_policy`: not a daemon; 40 ≥ 20 and 1 ≤ 2 → **promoted to
   anomalous**. Raw score kept at +0.075.
5. Dashboard: CRITICAL (via `is_anomalous`); AI panel explains via `num_connect`
   z-score.

**udevd hotplug (suppressed by the allowlist):**
1. Device hotplug → `systemd-udevd` renames/deletes ~40 files.
2. Window scores **−0.06, anomalous** — model thinks it's ransomware.
3. `apply_detection_policy`: `comm in SYSTEM_DAEMONS` → forced benign.
4. Dashboard: shows `systemd-udevd` as BENIGN.

**Normal process (untouched):**
1. A normal `bash` window: opens=2, execve=1, rate=0.4.
2. Scores positive/normal; policy neither suppresses (not a daemon) nor
   promotes (few connects). Stays benign.

---

## 11. The four issues fixed for the review

The teacher/CTO review flagged four issues; all four were fixed and verified:

| # | Issue | Root cause | Fix |
|---|---|---|---|
| 1 | **1970 timestamps** | Collector emitted *monotonic* ns (`bpf_ktime_get_ns()`), downstream treated as epoch → 1970 | Collector adds a realtime−monotonic offset and emits true epoch ns ([§5.2](#52-the-clock-offset-the-1970-bug-fix)); frontend guards legacy values ([§8.3](#83-timestamp-handling-the-1970-bug-surface)) |
| 2 | **systemd-udevd CRITICAL false positive** | One global Isolation Forest; udevd hotplug bursts are structurally identical to ransomware | Daemon allowlist in `detection_policy.py` ([§7.6](#76-the-detection-policy--rules-that-the-model-cannot-learn)) |
| 3 | **Rounding inconsistency (0.2 vs 0/s)** | Four UI sites did `Math.round(syscall_rate)` | Shared `formatSyscallRate` ([§8.5](#85-the-rate-formatter-the-02-vs-0s-fix)) |
| 4 | **No zero-day detection evidence** | (deliverable, not a bug) — needed to *prove* the simulators produce visible anomalies | Offline verification script `test/verify_detection.py` (4/4 pass) + live demo ([§9](#9-the-synthetic-attack-simulators), [§12](#12-running-the-system-end-to-end)) |

**Bonus fixes discovered while working:**
- **Window reaper bug:** the reaper compared `time.time_ns()` (epoch) against
  monotonic `last_event_ns` → staleness test always true → every window flushed
  at the first tick. The collector epoch fix resolves it (both sides epoch now).
- **Retention no-op regression:** `retention.py` compared `time.monotonic()` vs
  epoch `window_end_ns` → would never prune. Aligned to `time.time()` (epoch).

---

## 12. Running the system end-to-end

```bash
# 1. eBPF collector (root + BTF kernel). Build first (no root), then run.
cd collector && make
sudo ./run.sh            # prints pre-flight checks; confirms
                         # "[collector] realtime-monotonic offset = ... s"

# 2. Backend (from backend/, venv active). Must set the auth token.
cd backend && source .venv/bin/activate
export API_AUTH_TOKEN=<token matching frontend/.env>
uvicorn sentinel_backend.api.main:app --port 8000   # :8000, /docs

# 3. Frontend
cd frontend && npm install && npm run dev            # :5173

# 4. Attack simulators (run while the pipeline is up)
python test/simulate_ransomware.py
python test/simulate_beaconing.py

# 5. Verify anomalies via the API (screenshot between sims so each is visible)
curl -H "Authorization: Bearer $API_AUTH_TOKEN" \
     "http://localhost:8000/api/v1/windows?anomalous_only=1&limit=20"
```

Offline verification (no root needed):

```bash
backend/.venv/bin/python test/verify_detection.py   # 4 PASS lines
cd backend && source .venv/bin/activate
pytest tests/ -v                                    # backend tests
ruff check . && ruff format .
```

Training the model (rerun if `FEATURE_COLUMNS` changes):

```bash
python -m sentinel_backend.ml.train baseline.csv
```

---

## 13. Known gaps and limitations

- **eBPF visibility scope:** the collector hooks only 7 syscalls. Actions via
  unhooked syscalls (e.g. `mmap`-only payloads, `sendfile`, `io_uring`) are
  invisible. Adding a hook = add a tracepoint + struct field + serialization +
  feature, then retrain.
- **No process identity → low-FP/high-TP tension:** daemons are handled by a
  static allowlist; a *compromised* daemon is trusted by design. That's the
  deliberate trade-off to kill the false positive.
- **comm-name collision / truncation:** two different processes sharing a name
  and window collide in the table (consolidated by comm); 15-char truncation
  merges distinct tools (`systemd-timesyn` vs `systemd-timesyncd`).
- **Baseline drift:** thresholds (`contamination`, beaconing rule) are tuned to
  the current `baseline.csv`. Retraining on a dirty baseline reintroduced a
  ~60% FP rate once before — train only on clean, representative normal
  traffic.
- **Global, single-host model:** one forest scores every process. A system that
  is systematically different from the baseline (e.g. a build farm) will show
  chronic "anomalies" — per-role models are a future direction.
- **Windowing key is O(n):** `_key_for` linear-scan per event is fine for a
  single host but not for a fleet.
- **SSE subscriber set is in-process:** horizontal scaling of the API breaks
  the broadcast (a second uvicorn worker has its own empty `_subscribers`).
  A pub/sub (Redis) would fix it.

---

*This document is a living explanation of the codebase. When the architecture
changes, update the tier diagram, the wire contract, and the feature table
together — they are the three things every other section depends on.*
