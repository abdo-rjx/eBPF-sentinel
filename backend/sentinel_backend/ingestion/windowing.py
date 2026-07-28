import time
import threading
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Callable, Dict, Set, Tuple
from .models import RawEvent, EventType
from ..features.vector import FeatureVector

WindowKey = Tuple[int, int]

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
            acc.ppid = event.ppid
            acc.comm = event.comm

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

            elapsed_s = (event.ts - acc.window_start_ns) / 1_000_000_000
            if elapsed_s >= self.window_seconds:
                self._flush(key)

    def _key_for(self, event: RawEvent) -> WindowKey:
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
