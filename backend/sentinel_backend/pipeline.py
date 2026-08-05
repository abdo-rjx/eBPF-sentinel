"""Wires ingestion -> windowing -> features -> ML -> db -> broadcast."""

import logging

from . import config
from .api.routes_stream import broadcast_window
from .db.repository import insert_window
from .db.retention import start_retention_loop
from .db.session import get_session as SessionLocal
from .db.session import init_db
from .features.vector import FeatureVector
from .ingestion.socket_client import stream_events
from .ingestion.windowing import WindowAggregator
from .ml.detection_policy import apply_detection_policy
from .ml.inference import AnomalyResult, AnomalyScorer

logger = logging.getLogger(__name__)


def score_window(scorer: AnomalyScorer, vector: FeatureVector) -> AnomalyResult:
    """Score a window with the Isolation Forest, then apply the post-model policy."""
    result = scorer.score(vector)
    apply_detection_policy(vector, result)
    return result


def run_pipeline():
    socket_path = config.SENTINEL_SOCKET_PATH
    window_seconds = config.SENTINEL_WINDOW_SECONDS
    model_path = config.SENTINEL_MODEL_PATH

    init_db()
    start_retention_loop(retention_hours=24, interval_hours=1)

    scorer = AnomalyScorer(model_path)

    def on_window_complete(vector: FeatureVector):
        result = score_window(scorer, vector)
        db = SessionLocal()
        try:
            record = insert_window(db, vector, result)
            window_dict = {
                "id": record.id,
                "pid": record.pid,
                "ppid": record.ppid,
                "comm": record.comm,
                "window_start_ns": record.window_start_ns,
                "window_end_ns": record.window_end_ns,
                "num_execve": record.num_execve,
                "num_distinct_children": record.num_distinct_children,
                "num_file_opens": record.num_file_opens,
                "num_file_renames": record.num_file_renames,
                "num_file_deletes": record.num_file_deletes,
                "num_distinct_files_touched": record.num_distinct_files_touched,
                "num_connect": record.num_connect,
                "num_distinct_dest_ips": record.num_distinct_dest_ips,
                "num_setuid": record.num_setuid,
                "syscall_rate": record.syscall_rate,
                "anomaly_score": record.anomaly_score,
                "is_anomalous": record.is_anomalous,
                "created_at": str(record.created_at),
            }
            broadcast_window(window_dict)
            logger.info(
                "Window pid=%d score=%.4f anomalous=%s",
                vector.pid,
                result.anomaly_score,
                result.is_anomalous,
            )
        finally:
            db.close()

    aggregator = WindowAggregator(
        window_seconds=window_seconds, on_window_complete=on_window_complete
    )
    aggregator.start()

    for event in stream_events(socket_path):
        aggregator.ingest(event)
