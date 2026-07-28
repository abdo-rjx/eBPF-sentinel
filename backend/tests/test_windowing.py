import pytest
from sentinel_backend.ingestion.models import RawEvent, EventType
from sentinel_backend.ingestion.windowing import WindowAggregator
from sentinel_backend.features.vector import FeatureVector


def test_single_pid_counts():
    results = []

    def on_complete(v: FeatureVector):
        results.append(v)

    agg = WindowAggregator(window_seconds=5, on_window_complete=on_complete)
    base_ts = 1_000_000_000_000  # some base timestamp in ns
    pid = 100
    ppid = 1

    events = [
        RawEvent(ts=base_ts, pid=pid, tid=pid, ppid=ppid, uid=1000,
                 comm="test", event_type=EventType.execve, filename="/bin/ls"),
        RawEvent(ts=base_ts + 100_000_000, pid=pid, tid=pid, ppid=ppid, uid=1000,
                 comm="test", event_type=EventType.openat, filename="/etc/passwd"),
        RawEvent(ts=base_ts + 200_000_000, pid=pid, tid=pid, ppid=ppid, uid=1000,
                 comm="test", event_type=EventType.openat, filename="/etc/shadow"),
        RawEvent(ts=base_ts + 300_000_000, pid=pid, tid=pid, ppid=ppid, uid=1000,
                 comm="test", event_type=EventType.connect, dst_ip=0x0100007F, dst_port=80),
        RawEvent(ts=base_ts + 400_000_000, pid=pid, tid=pid, ppid=ppid, uid=1000,
                 comm="test", event_type=EventType.connect, dst_ip=0x0100007F, dst_port=443),
    ]

    for e in events:
        agg.ingest(e)

    agg._flush((pid, base_ts))

    assert len(results) == 1
    v = results[0]
    assert v.pid == pid
    assert v.ppid == ppid
    assert v.comm == "test"
    assert v.num_execve == 1
    assert v.num_file_opens == 2
    assert v.num_file_renames == 0
    assert v.num_file_deletes == 0
    assert v.num_connect == 2
    assert v.num_setuid == 0
    assert v.num_distinct_files_touched == 3
    assert v.num_distinct_dest_ips == 1
    assert v.num_distinct_children == 0
    assert v.syscall_rate > 0


def test_children_fan_out():
    results = []

    def on_complete(v: FeatureVector):
        results.append(v)

    agg = WindowAggregator(window_seconds=5, on_window_complete=on_complete)
    base_ts = 2_000_000_000_000
    parent_pid = 200
    child_pid = 201

    agg.ingest(RawEvent(ts=base_ts, pid=parent_pid, tid=parent_pid, ppid=1, uid=0,
                        comm="parent", event_type=EventType.execve, filename="/bin/bash"))
    agg.ingest(RawEvent(ts=base_ts + 50_000_000, pid=child_pid, tid=child_pid, ppid=parent_pid, uid=0,
                        comm="child", event_type=EventType.execve, filename="/bin/ls"))

    agg._flush((parent_pid, base_ts))

    assert len(results) == 1
    v = results[0]
    assert v.pid == parent_pid
    assert v.num_distinct_children == 1


def test_reaper_flushes_stale_window():
    results = []

    def on_complete(v: FeatureVector):
        results.append(v)

    agg = WindowAggregator(window_seconds=1, on_window_complete=on_complete)
    base_ts = 3_000_000_000_000

    agg.ingest(RawEvent(ts=base_ts, pid=300, tid=300, ppid=1, uid=0,
                        comm="reap_test", event_type=EventType.openat, filename="/tmp/x"))

    agg.start()

    import time
    time.sleep(1.5)

    agg.stop()

    assert len(results) == 1
    v = results[0]
    assert v.pid == 300
    assert v.num_file_opens == 1
