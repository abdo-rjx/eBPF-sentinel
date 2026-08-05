from sentinel_backend.features.vector import FeatureVector
from sentinel_backend.ml.detection_policy import (
    SYSTEM_DAEMONS,
    apply_detection_policy,
)
from sentinel_backend.ml.inference import AnomalyResult


def make_vector(comm="python3.12", **overrides):
    defaults = {
        "pid": 1234,
        "ppid": 1,
        "comm": comm,
        "window_start_ns": 0,
        "window_end_ns": 5_000_000_000,
        "num_execve": 0,
        "num_distinct_children": 0,
        "num_file_opens": 0,
        "num_file_renames": 0,
        "num_file_deletes": 0,
        "num_distinct_files_touched": 0,
        "num_connect": 0,
        "num_distinct_dest_ips": 0,
        "num_setuid": 0,
        "syscall_rate": 0.0,
    }
    defaults.update(overrides)
    return FeatureVector(**defaults)


def apply(v):
    result = AnomalyResult(anomaly_score=0.0, is_anomalous=True)  # start "anomalous"
    apply_detection_policy(v, result)
    return result


def test_udevd_burst_suppressed():
    """The udevd device-hotplug burst that triggered the teacher's CRITICAL
    false positive must be forced benign."""
    v = make_vector(
        comm="systemd-udevd",
        num_file_renames=40,
        num_file_deletes=40,
        num_connect=6,
        syscall_rate=17.2,
    )
    assert apply(v).is_anomalous is False


def test_quiet_daemon_stays_normal():
    v = make_vector(
        comm="systemd-udevd", num_file_opens=2, num_file_renames=1, syscall_rate=0.6
    )
    assert apply(v).is_anomalous is False


def test_beaconing_promoted():
    """simulate_beaconing.py: 40 connects to one loopback IP. The Isolation
    Forest scores it normal; the rule must promote it."""
    v = make_vector(
        num_execve=1, num_connect=40, num_distinct_dest_ips=1, syscall_rate=8.0
    )
    assert apply(v).is_anomalous is True


def test_daemon_never_promoted_by_beaconing_rule():
    """Allowlist wins over the promotion rule: a daemon hammering one IP stays
    benign."""
    v = make_vector(
        comm="NetworkManager",
        num_connect=60,
        num_distinct_dest_ips=1,
        syscall_rate=12.0,
    )
    assert apply(v).is_anomalous is False


def test_normal_vector_untouched():
    v = make_vector(num_execve=1, num_file_opens=1, syscall_rate=0.4)
    # starts False from a normal model verdict; policy leaves it alone
    result = AnomalyResult(anomaly_score=0.3, is_anomalous=False)
    apply_detection_policy(v, result)
    assert result.is_anomalous is False


def test_fanout_connects_not_promoted():
    """A normal heavy-connector (many distinct IPs) is not a beaconing shape."""
    v = make_vector(num_connect=40, num_distinct_dest_ips=25, syscall_rate=26.4)
    result = AnomalyResult(anomaly_score=-0.2, is_anomalous=False)
    apply_detection_policy(v, result)
    assert result.is_anomalous is False


def test_truncated_daemon_comm_in_allowlist():
    """kernel comm truncates at 15 chars; the allowlist stores those forms."""
    for comm in (
        "systemd-udevd",
        "systemd-journal",
        "systemd-userwor",
        "systemd-resolve",
        "NetworkManager",
    ):
        assert comm in SYSTEM_DAEMONS


def test_pipeline_score_window_applies_policy():
    """The production path (run_pipeline -> score_window) must apply the policy
    after the model verdict — a daemon is suppressed, a beaconing shape is
    promoted, and the raw anomaly_score is preserved either way."""
    from sentinel_backend.pipeline import score_window

    class _FakeScorer:
        def score(self, vector):
            # Isolation Forest says "normal" for both shapes below.
            return AnomalyResult(anomaly_score=0.075, is_anomalous=False)

    beaconing = make_vector(
        num_execve=1, num_connect=40, num_distinct_dest_ips=1, syscall_rate=8.0
    )
    result = score_window(_FakeScorer(), beaconing)
    assert result.is_anomalous is True  # promoted by the beaconing rule
    assert result.anomaly_score == 0.075  # raw model score preserved

    daemon = make_vector(
        comm="NetworkManager",
        num_connect=60,
        num_distinct_dest_ips=1,
        syscall_rate=12.0,
    )
    suppressed = score_window(_FakeScorer(), daemon)
    assert suppressed.is_anomalous is False  # allowlist wins over promotion
