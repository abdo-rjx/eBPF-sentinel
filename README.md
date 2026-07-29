# 🛡️ eBPF Sentinel: Real-Time Behavioral Anomaly Detection System

**eBPF Sentinel** (`sentinel`) is a lightweight, host-based intrusion and malware detection system (HIDS) built with **C / eBPF (libbpf + CO-RE)** and **Python Machine Learning (Isolation Forest)**. 

Unlike traditional antivirus tools that rely on static signature databases (which fail against new or modified malware), Sentinel continuously monitors kernel-level process activity to learn what "normal" machine behavior looks like. It detects novel, zero-day security threats—such as ransomware file thrashing, command-and-control (C2) beaconing, and privilege escalation—by flagging statistical outliers in real time.

---

## 💡 Why eBPF Sentinel? (The High-Level Concept)

### The Core Problem
Traditional security software inspects files on disk or listens in user space. This approach has two major drawbacks:
1. **Signatures are reactive:** If a hacker modifies a single byte of their malware, traditional signatures miss it.
2. **User-space inspection is slow and bypassable:** Attackers with elevated privileges can tamper with user-space monitoring software or hide process activities.

### The Sentinel Solution
Sentinel operates directly inside the **Linux Kernel** using **eBPF (Extended Berkeley Packet Filter)**:
- **Zero Overhead & Tamper-Proof:** eBPF lets us run sandboxed C programs directly inside the kernel at native speed without modifying kernel source code or loading risky kernel modules.
- **Behavioral Detection over Signatures:** Instead of asking *"Is this file hash bad?"*, Sentinel asks *"Is this process behaving weirdly compared to normal execution history?"*

```
Traditional Antivirus:  "Is this file known malware?" ❌ (Misses Zero-Days)
eBPF Sentinel:          "Why did a text editor just open 500 files and rename them to .locked in 2 seconds?" 🚨 (Catches Ransomware)
```

---

## 🏗️ System Architecture & Data Flow

Sentinel is split into two main layers: a **Kernel Collector** running on the host for raw event capture, and a **Containerized Backend & Frontend** for data aggregation, ML scoring, and visualization.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 KERNEL SPACE                                    │
│  Hooked Syscalls: execve | connect | accept | openat | unlink | rename | setuid │
│                                      │                                          │
│                           eBPF Program (C, CO-RE)                               │
│                                      │                                          │
│                              BPF Ring Buffer                                    │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │ (Drains ring buffer via poll)
┌──────────────────────────────────────▼──────────────────────────────────────────┐
│                           USER SPACE - C COLLECTOR                              │
│             libbpf loader ➔ Serializes to NDJSON ➔ Unix Domain Socket           │
│                        (Runs directly on Host machine)                          │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │ Unix Socket (AF_UNIX / NDJSON Stream)
┌──────────────────────────────────────▼──────────────────────────────────────────┐
│                            PYTHON ANALYSIS BACKEND                              │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ 1. Ingestion & Windowing: Groups events into 5-second per-process buckets    │ │
│ │ 2. Feature Extraction: Calculates 10 behavioral metrics (rates, files, IPs) │ │
│ │ 3. Machine Learning: Scores vectors using Isolation Forest (scikit-learn)   │ │
│ │ 4. Storage & API: Saves to SQLite & broadcasts live alerts via FastAPI SSE  │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                     (Runs via Docker / Docker Compose)                          │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │ Server-Sent Events (SSE) / REST API
┌──────────────────────────────────────▼──────────────────────────────────────────┐
│                               REACT DASHBOARD                                   │
│            Live Anomaly Timeline Chart ➔ Real-Time Process Threat Table         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🧠 How the Logic Works (Step-by-Step)

### 1. Kernel Event Capture (C + eBPF CO-RE)
The kernel program (`collector/bpf/monitor.bpf.c`) hooks 7 security-critical Linux system calls:
* **`execve`**: Process executions and lineage tracking.
* **`connect` / `accept`**: Network communication (outbound connections and inbound listeners).
* **`openat`**: File access monitoring.
* **`unlink` / `rename`**: File deletion and extension changes (ransomware indicators).
* **`setuid`**: Privilege escalation attempts.

Whenever any process executes one of these syscalls, the eBPF program reads process metadata (`pid`, `ppid`, `uid`, command name `comm`, target filename, IP/port) and pushes it into a high-performance **BPF Ring Buffer**.

### 2. High-Speed Host Ingestion (C Collector)
The C collector (`collector/src/main.c`) loads the eBPF program into the host kernel using `libbpf` and **CO-RE (Compile Once – Run Everywhere)**. It continuously polls the ring buffer, serializes the kernel structs into Newline-Delimited JSON (NDJSON), and streams them over a local Unix Domain Socket (`/tmp/sentinel_collector.sock`).

### 3. Windowing & Feature Engineering (Python)
Raw syscall logs are noisy. The Python backend aggregates events into **5-second window buckets** per process (`pid`, `start_time`). For every window, Sentinel extracts a **10-dimensional feature vector**:
1. `num_execve`: Number of spawned commands.
2. `num_distinct_children`: Child process fan-out.
3. `num_file_opens`: File read/write frequency.
4. `num_file_renames`: File rename operations.
5. `num_file_deletes`: File deletion frequency.
6. `num_distinct_files_touched`: File diversity index.
7. `num_connect`: Network connection attempts.
8. `num_distinct_dest_ips`: IP address fan-out.
9. `num_setuid`: Privilege changes.
10. `syscall_rate`: Total event density per second.

### 4. Unsupervised Anomaly Scoring (Isolation Forest)
Each 5-second feature vector is evaluated by an **Isolation Forest** model (`scikit-learn`):
* **Normal Behavior:** Processes like `bash`, `node`, `chrome`, or `systemd` produce predictable, standard vectors.
* **Anomalous Behavior:** Outlier vectors (e.g., thousands of file renames in seconds, or dozens of rapid outbound socket connections) require very few partition splits to isolate, yielding a low decision score.
* **Result:** Any window flagged as an outlier (`is_anomalous=True`) is flagged on the dashboard in red.

### 5. Live Visualization (FastAPI + React Dashboard)
Scored windows are stored in SQLite and broadcasted instantly to the React UI via **Server-Sent Events (SSE)**. Security analysts see a real-time graph of system anomaly scores and a table highlighting suspicious processes.

---

## 🎯 Threat Detection Capabilities

| Threat Type | Behavioral Indicator | Sentinel Feature Signal |
| :--- | :--- | :--- |
| **Ransomware / File Thrashing** | Rapid file opens, renames (e.g. `.locked`), and deletions | High `num_file_renames`, `num_file_deletes`, `syscall_rate` |
| **C2 Beaconing / Exfiltration** | Periodic rapid network connections to multiple target IPs | High `num_connect`, `num_distinct_dest_ips` |
| **Privilege Escalation** | Execution of `setuid` binaries or unexpected privilege switches | High `num_setuid`, `execve` |
| **Web Shell / Suspicious Lineage** | Web server (`nginx`/`apache`) spawning `sh` or `bash` | Abnormal `ppid` ➔ `comm` lineage and `num_execve` |

---

## 📁 Repository Structure

```
sentinel/
├── PLAN.md                          # Comprehensive technical design specification
├── README.md                        # Project documentation
├── docker-compose.yml               # Orchestrates Python Backend & React Frontend
├── collector/                       # Kernel eBPF collector (C / libbpf)
│   ├── bpf/
│   │   ├── monitor.bpf.c            # Kernel space eBPF program (tracepoints)
│   │   └── vmlinux.h                # Auto-generated kernel BTF type definitions
│   ├── src/
│   │   ├── main.c                   # Userspace loader, ring buffer poll, NDJSON socket
│   │   └── events.h                 # Shared C event data structure
│   ├── Makefile                     # Build script for BPF & C binaries
│   └── run.sh                       # Root launcher script
├── backend/                         # Python Analysis Pipeline & API
│   ├── sentinel_backend/
│   │   ├── ingestion/               # Socket client & dual-indexed 5s windowing
│   │   ├── features/                # 10D feature vector builder
│   │   ├── ml/                      # Isolation Forest training & inference module
│   │   ├── db/                      # SQLite ORM schema & repositories
│   │   └── api/                     # FastAPI endpoints (REST + SSE live stream)
│   └── tests/                       # Unit and integration test suite
├── frontend/                        # React + Vite Web Dashboard
│   └── src/
│       ├── components/              # Live Anomaly Timeline & Process Table
│       └── hooks/                   # SSE EventStream consumer
└── test/                            # Safe Attack Simulation Scripts
    ├── simulate_ransomware.py       # Synthetic ransomware file-thrashing simulator
    └── simulate_beaconing.py        # Synthetic C2 beaconing simulator
```

---

## 🚀 Quick Start & Installation

### Prerequisites (Host Machine)
* **OS:** Linux (Kernel $\ge 5.8$ with BTF enabled; tested on Fedora Linux).
* **Toolchain:** `clang`, `llvm`, `libbpf-devel`, `bpftool`, `gcc`, `make`.
* **Runtimes:** Python $\ge 3.11$, Node.js $\ge 18$, Docker & Docker Compose.

### Step 1: Install Dependencies & Prepare Kernel BTF
On Fedora/RHEL-based systems:
```bash
sudo dnf install -y clang llvm libbpf-devel bpftool elfutils-libelf-devel kernel-devel make gcc python3.12 nodejs npm docker docker-compose
```
Generate the kernel BTF headers:
```bash
sudo bpftool btf dump file /sys/kernel/btf/vmlinux format c > collector/bpf/vmlinux.h
```

### Step 2: Build the eBPF Host Collector
```bash
cd collector
make
```

### Step 3: Set Up Python Backend & Train Model
```bash
cd ../backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Create .env configuration
cp ../.env.example ../.env
```

To train the Isolation Forest model on your machine's baseline activity:
1. Run the collector and save a baseline of normal activity to `baseline.csv` (or use the provided `baseline.csv`).
2. Train the model:
```bash
python -m sentinel_backend.ml.train baseline.csv
```

### Step 4: Run eBPF Sentinel

1. **Start the Host Kernel Collector (Requires Root for eBPF):**
```bash
cd collector
sudo ./run.sh
```

2. **Start the Backend & Dashboard (In a new terminal):**
```bash
docker-compose up --build
```
Access the dashboard in your web browser at: **`http://localhost:5173`**  
Access the API documentation at: **`http://localhost:8000/docs`**

---

## 🧪 Simulating Attacks & Verification

Sentinel includes safe, self-contained test scripts to simulate malware behaviors without modifying real user files or creating external network traffic.

### 1. Simulate Ransomware (File Thrashing)
Run the synthetic ransomware script:
```bash
python test/simulate_ransomware.py
```
* **What it does:** Creates 500 temporary files, rapidly renames them all to `.locked`, and deletes them inside a temporary isolated folder.
* **Expected Result:** The process triggers a sudden spike in `num_file_renames` and `num_file_deletes`, flagging an immediate **red anomaly** on the live dashboard.

### 2. Simulate C2 Beaconing (Network Anomaly)
Run the synthetic network beaconing script:
```bash
python test/simulate_beaconing.py
```
* **What it does:** Rapidly attempts socket connections to loopback addresses.
* **Expected Result:** Triggers a spike in `num_connect` and `num_distinct_dest_ips`, raising an anomaly alert.

---

## ⚙️ Key Technical Highlights

* **Libbpf + CO-RE over BCC:** Avoids heavy LLVM runtime compilation overhead on the host. The eBPF binary is compiled once and adapts to any kernel using BTF relocations.
* **IPC Isolation:** The C collector and Python analysis engine communicate over a Unix Domain Socket using NDJSON, preserving strict process boundary separation.
* **Thread-Safe Dual-Indexed Windowing:** Process windows track parent-child relationships across asynchronous syscall boundaries without requiring full process tree tracking.
* **Resilient Ingestion:** Socket disconnects or malformed lines are gracefully logged and recovered without crashing long-running daemon processes.

---

## 🛡️ License & Acknowledgments
Developed as an open-source demonstration of kernel-level security engineering, eBPF systems programming, and modern behavioral malware detection.
