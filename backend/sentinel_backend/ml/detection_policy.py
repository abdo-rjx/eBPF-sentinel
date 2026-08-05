"""Post-model detection policy.

Runs AFTER the Isolation Forest scores each window. It only ever flips the
CRITICAL/benign verdict that reaches the dashboard/DB; the raw anomaly_score is
kept so the AI panel still shows the model's opinion. Order matters:

1) The daemon allowlist suppresses known OS/kernel daemons (udevd hotplug
   bursts of renames/deletes are ordinary OS work, not user behavioral attack).
2) The beaconing rule promotes single-destination connection concentration,
   which count-aggregate 5s features cannot express (see below).
"""

# comm is capped at TASK_COMM_LEN=16 (15 chars + NUL) by the kernel, so long
# daemon names arrive truncated ("systemd-journald" -> "systemd-journal", etc.).
# Entries below are the observed truncated forms.
SYSTEM_DAEMONS = frozenset(
    {
        "systemd",
        "systemd-udevd",
        "systemd-journal",
        "systemd-logind",
        "systemd-resolve",
        "systemd-timesyn",
        "systemd-userwor",
        "systemd-coredum",
        "systemd-network",
        "systemd-hostnam",
        "systemd-timedat",
        "dbus-daemon",
        "NetworkManager",
        "ModemManager",
        "auditd",
        "gssproxy",
        "sssd_kcm",
        "sssd_nss",
        "crond",
        "cron",
        "atd",
        "rsyslogd",
        "agetty",
        "polkitd",
        "irqbalance",
        "firewalld",
    }
)

# C2 beaconing promotion. The Isolation Forest does NOT flag single-IP connect
# bursts: the baseline contains windows with num_connect up to 97, so 40
# connects to one loopback IP scores +0.075 / predict=1 (normal). Verified by
# scoring the exact simulate_beaconing.py vector. Baseline check for the rule
# thresholds (7376 windows): num_connect>=20 & num_distinct_dest_ips<=2 -> 0
# matches (all heavy connectors fan out across many IPs), so the rule has no
# false positives on the current baseline.
BEACONING_CONNECT_THRESHOLD = 20
BEACONING_MAX_DISTINCT_IPS = 2


def apply_detection_policy(vector, result):
    """Mutates result.is_anomalous in place. Daemons are never promoted.

    vector: features.vector.FeatureVector
    result: ml.inference.AnomalyResult (mutable dataclass)
    """
    if vector.comm in SYSTEM_DAEMONS:
        result.is_anomalous = False
        return
    if (
        vector.num_connect >= BEACONING_CONNECT_THRESHOLD
        and vector.num_distinct_dest_ips <= BEACONING_MAX_DISTINCT_IPS
    ):
        result.is_anomalous = True
