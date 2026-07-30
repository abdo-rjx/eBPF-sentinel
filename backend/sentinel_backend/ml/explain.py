import os
import math
import json
import pandas as pd
import numpy as np
from ..features.vector import FEATURE_COLUMNS
from ..db.schema import WindowRecord

_FEATURE_LABELS = {
    "num_execve": "Process Executions",
    "num_distinct_children": "Child Process Spawn",
    "num_file_opens": "File Opens",
    "num_file_renames": "File Renames",
    "num_file_deletes": "File Deletions",
    "num_distinct_files_touched": "Unique Files Accessed",
    "num_connect": "Socket Connections",
    "num_distinct_dest_ips": "Distinct Remote IPs",
    "num_setuid": "Setuid Attempts",
    "syscall_rate": "Syscall Density",
}

class FeatureAnalyzer:
    def __init__(self, baseline_path: str | None = None):
        self.means: dict[str, float] = {}
        self.stds: dict[str, float] = {}
        if baseline_path and os.path.exists(baseline_path):
            df = pd.read_csv(baseline_path)
            for col in FEATURE_COLUMNS:
                self.means[col] = float(df[col].mean())
                self.stds[col] = float(df[col].std()) or 1.0

    def analyze(self, record: WindowRecord) -> dict:
        contributions = []
        for col in FEATURE_COLUMNS:
            value = float(getattr(record, col))
            mean = self.means.get(col, 0.0)
            std = self.stds.get(col, 1.0)
            z = (value - mean) / std if std > 0 else 0.0
            contributions.append({
                "feature": col,
                "label": _FEATURE_LABELS.get(col, col),
                "value": value,
                "baseline_mean": round(mean, 2),
                "baseline_std": round(std, 2),
                "z_score": round(z, 3),
                "severity": "high" if abs(z) > 3 else "medium" if abs(z) > 1.5 else "low",
            })

        contributions.sort(key=lambda c: abs(c["z_score"]), reverse=True)

        top_contributors = [c for c in contributions if abs(c["z_score"]) > 1.5]

        return {
            "window_id": record.id,
            "anomaly_score": record.anomaly_score,
            "is_anomalous": record.is_anomalous,
            "feature_count": len(FEATURE_COLUMNS),
            "contributions": contributions,
            "top_contributors": top_contributors,
            "summary": self._generate_summary(record, contributions, top_contributors),
        }

    def _generate_summary(self, record: WindowRecord, contributions: list, top: list) -> str:
        if not record.is_anomalous:
            return "No anomalous behavior detected. Process behavior is within normal statistical bounds."
        if not top:
            return "Slight statistical deviation detected but no single feature exceeds alert thresholds."
        top_features = [c["label"] for c in top[:3]]
        return f"Anomaly detected: {len(top)} behavioral signals deviating from baseline. "
