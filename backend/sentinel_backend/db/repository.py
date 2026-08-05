from sqlalchemy.orm import Session

from ..features.vector import FEATURE_COLUMNS, FeatureVector
from ..ml.inference import AnomalyResult
from .schema import WindowRecord


def insert_window(
    db: Session, vector: FeatureVector, result: AnomalyResult
) -> WindowRecord:
    record = WindowRecord(
        pid=vector.pid,
        ppid=vector.ppid,
        comm=vector.comm,
        window_start_ns=vector.window_start_ns,
        window_end_ns=vector.window_end_ns,
        **{col: getattr(vector, col) for col in FEATURE_COLUMNS},
        anomaly_score=result.anomaly_score,
        is_anomalous=result.is_anomalous,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def query_windows(
    db: Session,
    limit: int = 100,
    pid: int | None = None,
    anomalous_only: bool = False,
) -> list[WindowRecord]:
    q = db.query(WindowRecord)
    if pid is not None:
        q = q.filter(WindowRecord.pid == pid)
    if anomalous_only:
        q = q.filter(WindowRecord.is_anomalous.is_(True))
    return q.order_by(WindowRecord.id.desc()).limit(limit).all()
