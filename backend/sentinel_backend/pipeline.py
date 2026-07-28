"""Wires ingestion -> windowing -> features -> ML -> db -> broadcast."""
import logging
import os
from .ingestion.socket_client import stream_events
from .ingestion.windowing import WindowAggregator
from .ml.inference import AnomalyScorer
from .db.session import init_db, get_session as SessionLocal
from .db.repository import insert_window
from .api.routes_stream import broadcast_window
from .features.vector import FeatureVector

logger = logging.getLogger(__name__)

def run_pipeline():
    socket_path = os.environ.get("SENTINEL_SOCKET_PATH", "/tmp/sentinel_collector.sock")
    window_seconds = int(os.environ.get("SENTINEL_WINDOW_SECONDS", "5"))
    model_path = os.environ.get("SENTINEL_MODEL_PATH",
                                "sentinel_backend/ml/model_store/isolation_forest.joblib")

    init_db()

    scorer = AnomalyScorer(model_path)

    def on_window_complete(vector: FeatureVector):
        result = scorer.score(vector)
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
            logger.info("Window pid=%d score=%.4f anomalous=%s",
                        vector.pid, result.anomaly_score, result.is_anomalous)
        finally:
            db.close()

    aggregator = WindowAggregator(window_seconds=window_seconds,
                                  on_window_complete=on_window_complete)
    aggregator.start()

    for event in stream_events(socket_path):
        aggregator.ingest(event)
