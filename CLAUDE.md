# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**Sentinel** is a host-based intrusion detection system (HIDS). A C/eBPF collector hooks 7 Linux syscalls (`execve`, `connect`, `accept`, `openat`, `unlink`, `rename`, `setuid`) inside the kernel, streams raw behavioral events over a Unix socket as NDJSON, and a Python backend turns them into per-process 5-second "feature vectors" that are scored by an Isolation Forest model for anomalies. Results persist to SQLite and stream live to a React dashboard via SSE. It is behavioral (unsupervised) detection — no signature database.

The system has **three physically separated tiers** that only communicate over well-defined wire formats:

```
kernel eBPF (collector/bpf/monitor.bpf.c)
   → BPF ring buffer
   → C collector (collector/src/main.c) — NDJSON over AF_UNIX socket /tmp/sentinel_collector.sock
   → Python backend (backend/sentinel_backend/) — windowing → feature vectors → Isolation Forest → SQLite
   → REST + SSE (FastAPI, :8000)
   → React/Vite dashboard (frontend/, :5173)
```

The C collector is **not** containerized and must run as root on the host; the backend and frontend run as normal processes.

## Commands

All paths are relative to the repo root unless noted. Backend commands run from `backend/` with the venv active (`source .venv/bin/activate`).

```bash
# Backend: install deps, run API server
cd backend && source .venv/bin/activate && pip install -r requirements.txt
uvicorn sentinel_backend.api.main:app --reload        # http://localhost:8000, /docs for Swagger

# Backend tests (pytest; ruff is in requirements.txt for linting)
pytest tests/ -v
pytest tests/test_windowing.py -v                      # single file
pytest tests/test_windowing.py::test_single_pid_counts -v   # single test
ruff check . && ruff format .

# Train the ML model from a baseline CSV of feature vectors (must be rerun if FEATURE_COLUMNS changes)
python -m sentinel_backend.ml.train baseline.csv        # writes ml/model_store/isolation_forest.joblib

# eBPF collector (requires root + BTF-enabled kernel)
cd collector && make                                    # builds build/sentinel_collector + regenerates src/monitor.skel.h
sudo ./run.sh                                           # pre-flight checks then runs the collector

# Frontend
cd frontend && npm install && npm run dev               # http://localhost:5173

# Synthetic attack simulators (run while the pipeline is up to produce visible anomalies)
python test/simulate_ransomware.py
python test/simulate_beaconing.py

# Offline end-to-end detection check (scores the simulator vectors against the
# trained model + policy; no collector/root needed) — run from repo root
backend/.venv/bin/python test/verify_detection.py
```

Notes:
- `vmlinux.h` is machine-generated and **kernel-version-specific**: `sudo bpftool btf dump file /sys/kernel/btf/vmlinux format c > collector/bpf/vmlinux.h`. Never hand-edit it; regenerate per machine/kernel.
- The frontend has a **demo mode**: if the SSE URL contains `undefined` (i.e. no `VITE_API_TOKEN`/`VITE_API_BASE`), `useEventStream` generates mock data instead of connecting. This is how the dashboard works with no backend running.
- `test/simulate_ransomware.py` and `test/simulate_beaconing.py` are safe — they only touch an isolated temp dir and loopback.

## Architecture — how the pieces connect

### Wire contract (kernel ↔ collector ↔ backend)

- `collector/src/events.h` defines the `struct event` shared **byte-for-byte** by both `monitor.bpf.c` (kernel) and `main.c` (userspace). Fields are populated selectively by event type but kept in a flat struct (no union) deliberately. Change it on both sides together.
- `main.c` serializes each event to one NDJSON line, e.g. `{"ts":…,"pid":…,"ppid":…,"comm":"…","event_type":"openat","filename":"…",…}`. It **does not JSON-escape** `comm`/`filename`, so the backend must tolerate malformed lines (it does — `socket_client.py` logs and skips them).
- `backend/sentinel_backend/ingestion/models.py` (`RawEvent`) is the Python mirror of the NDJSON schema. `event_type` uses string values matching `type_names[]` in `main.c`.

### Windowing (`ingestion/windowing.py`)

`WindowAggregator` groups events into fixed `SENTINEL_WINDOW_SECONDS`-second buckets keyed by `(pid, process_start_time_ns)`. Two non-obvious behaviors:

1. **Pid reuse**: the key includes an approximated process start time (first-seen event ts) because the kernel recycles pids.
2. **Children fan-out**: child spawn counts cannot be observed from the parent's own events (fork isn't hooked), so a parallel `ppid → set[child pids]` index is maintained and merged into the parent's vector at flush time.

A background reaper thread (`_reap_loop`) flushes windows that went quiet, so a process that stops emitting events still gets scored. `_key_for` is an O(n) linear scan — a known v2 optimization.

### Feature vectors (`features/vector.py`)

`FEATURE_COLUMNS` is the **single source of truth** for the 10 features; `FeatureVector.to_array()` returns them in exactly that order. This ordering is simultaneously the Isolation Forest model input, the `windows` table column set, and the API response schema. Any change to `FEATURE_COLUMNS` requires retraining the model; the mismatch is intentionally loud (shape error), not silent.

### ML (`ml/`)

- `ml/train.py` — offline training entrypoint; fits `IsolationForest(n_estimators=100)` on a baseline CSV and dumps a joblib. `contamination` defaults to `ISOLATION_FOREST_CONTAMINATION` (env, default 0.02); the CLI writes to `SENTINEL_MODEL_PATH` unless an output path is given.
- `ml/inference.py` — `AnomalyScorer` loads the joblib once and scores vectors. **sklearn sign convention: `decision_function()` is negative for anomalies, positive for normal; `predict() == -1` means anomalous.** Do not flip this — it silently inverts every alert in the dashboard.
- `ml/detection_policy.py` — post-model rules run by `pipeline.score_window()`: a static `SYSTEM_DAEMONS` allowlist suppresses OS-kernel daemons (udevd hotplug bursts of renames/deletes), and a beaconing rule (`num_connect >= 20` with `<= 2` distinct IPs) promotes single-destination connect bursts that the count-aggregate features can't express. It mutates `AnomalyResult.is_anomalous` in place; `anomaly_score` is preserved.
- `ml/explain.py` — `FeatureAnalyzer` computes per-feature z-scores against `baseline.csv` (loaded lazily by `routes_windows.py`, resolved relative to the package root so it works from any CWD) to explain *why* a window was flagged.

### DB (`db/`)

- Single denormalized `windows` table (`WindowRecord` in `db/schema.py`), populated by `db/repository.py:insert_window`.
- `db/session.py` lazy-initializes the engine; `check_same_thread: False` is required because ingestion runs on a background thread while FastAPI serves on the event loop.
- `db/retention.py` prunes records older than 24h in a background loop — the answer to "why is the table not growing forever."

### API (`api/`)

- `main.py` mounts the routers, calls `init_db()` in a lifespan hook, and starts `run_pipeline()` in a daemon thread (see Pipeline wiring).
- Auth: `api/auth.py:verify_token` requires `Authorization: Bearer <API_AUTH_TOKEN>` on every route except `/health`; `/api/v1/stream` uses `verify_token_any`, which also accepts `?token=`. Both fail closed (raise if the env var is unset) — `API_AUTH_TOKEN` must be set or all authed requests 500.
- `routes_stream.py` keeps an in-process `_subscribers` set of asyncio queues; `pipeline.py` calls `broadcast_window()` after every DB insert. The 15s `: keepalive\n\n` comment line is load-bearing (prevents proxy idle disconnects) — don't remove it.

### Pipeline wiring (`pipeline.py`)

`run_pipeline()` is the only place that connects ingestion → windowing → ML → detection policy → DB → SSE broadcast. It blocks forever consuming `stream_events()`, so `api/main.py` starts it in a daemon thread inside the FastAPI lifespan (`threading.Thread(target=run_pipeline, daemon=True)`) — the same process as the SSE endpoints, because `routes_stream._subscribers` is an in-process set. Each completed window is handled by `score_window()`: `AnomalyScorer.score()` then `apply_detection_policy()` (allowlist + beaconing), then inserted into the DB and broadcast.

## Known gaps / things to verify before trusting

- **SSE auth**: `/api/v1/stream` accepts the token as a query param too (`verify_token_any` in `api/auth.py`; `frontend/src/lib/config.ts:streamUrl()` appends `?token=`), because native `EventSource` can't set headers. All other routes are header-only.
- **Explainability fallback**: `pages/Dashboard.tsx` calls the real `/api/v1/windows/{id}/analysis`; if the API is unreachable it falls back to a client-side deviation-vs-median calc labeled "Live analysis unavailable". The fallback is approximate, not the model's baseline z-scores — they can drift.
- **`SENTINEL_MODEL_PATH`**: defined in `config.py` (default `backend/sentinel_backend/ml/model_store/isolation_forest.joblib`); both `train.py` (CLI) and `pipeline.py` use it, so training and scoring stay consistent.

## Config & env

`.env.example` documents the variables; `.env` is gitignored. Key ones: `API_AUTH_TOKEN` (required), `SENTINEL_DB_PATH` (default `backend/sentinel.db` via `config.py`), `SENTINEL_SOCKET_PATH` (default `/tmp/sentinel_collector.sock`), `SENTINEL_WINDOW_SECONDS` (5), `ISOLATION_FOREST_CONTAMINATION` (0.02). Frontend: `VITE_API_BASE` (default `http://localhost:8000`), `VITE_API_TOKEN`.
