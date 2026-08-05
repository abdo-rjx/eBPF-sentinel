"""Offline verification of the zero-day demo vectors.

Scores the exact feature vectors produced by test/simulate_ransomware.py and
test/simulate_beaconing.py (plus a systemd-udevd hotplug burst) through the
trained Isolation Forest AND the post-model detection policy. No collector/root
needed.

Run from repo root:
    backend/.venv/bin/python test/verify_detection.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from sentinel_backend.features.vector import FeatureVector
from sentinel_backend.ml.detection_policy import apply_detection_policy
from sentinel_backend.ml.inference import AnomalyScorer

MODEL = "backend/sentinel_backend/ml/model_store/isolation_forest.joblib"


def vec(comm="python3.12", **overrides):
    defaults = {
        "pid": 1234, "ppid": 1, "comm": comm,
        "window_start_ns": 0, "window_end_ns": 5_000_000_000,
        "num_execve": 0, "num_distinct_children": 0, "num_file_opens": 0,
        "num_file_renames": 0, "num_file_deletes": 0, "num_distinct_files_touched": 0,
        "num_connect": 0, "num_distinct_dest_ips": 0, "num_setuid": 0,
        "syscall_rate": 0.0,
    }
    defaults.update(overrides)
    return FeatureVector(**defaults)


def main():
    scorer = AnomalyScorer(MODEL)
    checks = [
        ("ransomware detected",
         vec(num_execve=1, num_file_opens=500, num_file_renames=500,
             num_file_deletes=500, num_distinct_files_touched=500,
             syscall_rate=300.0), True),
        ("beaconing detected (policy rule)",
         vec(num_execve=1, num_connect=40, num_distinct_dest_ips=1,
             syscall_rate=8.0), True),
        ("udevd burst suppressed (allowlist)",
         vec(comm="systemd-udevd", num_file_renames=40, num_file_deletes=40,
             num_connect=6, syscall_rate=17.2), False),
        ("quiet daemon stays normal",
         vec(comm="systemd-udevd", num_file_opens=2, num_file_renames=1,
             syscall_rate=0.6), False),
    ]

    failed = 0
    for label, v, expected in checks:
        raw = scorer.score(v)
        result = scorer.score(v)  # copy so we can show raw vs. post-policy
        apply_detection_policy(v, result)
        ok = result.is_anomalous == expected
        failed += 0 if ok else 1
        print(f"{'PASS' if ok else 'FAIL'}  {label}: "
              f"raw_score={raw.anomaly_score:+.4f} raw_anomalous={raw.is_anomalous} "
              f"-> policy_anomalous={result.is_anomalous} (expected {expected})")

    print(f"\n{'All offline detection expectations verified.' if not failed else f'{failed} check(s) FAILED'}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
