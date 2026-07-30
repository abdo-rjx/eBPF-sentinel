"""Aggregated statistics endpoint for the dashboard overview."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from .auth import verify_token
from ..db.session import get_session as SessionLocal
from ..db.schema import WindowRecord

router = APIRouter(prefix="/api/v1", tags=["stats"], dependencies=[Depends(verify_token)])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    total = db.query(func.count(WindowRecord.id)).scalar() or 0
    anomaly_count = db.query(func.count(WindowRecord.id)).filter(
        WindowRecord.is_anomalous.is_(True)
    ).scalar() or 0

    unique_processes = (
        db.query(func.count(func.distinct(WindowRecord.pid)))
        .scalar() or 0
    )
    anomaly_processes = (
        db.query(func.count(func.distinct(WindowRecord.pid)))
        .filter(WindowRecord.is_anomalous.is_(True))
        .scalar() or 0
    )

    avg_rate = (
        db.query(func.avg(WindowRecord.syscall_rate))
        .scalar() or 0.0
    )

    top_anomalies = (
        db.query(
            WindowRecord.pid,
            WindowRecord.comm,
            WindowRecord.anomaly_score,
            WindowRecord.window_start_ns,
        )
        .filter(WindowRecord.is_anomalous.is_(True))
        .order_by(WindowRecord.anomaly_score.asc())
        .limit(10)
        .all()
    )

    return {
        "total_windows": total,
        "anomaly_count": anomaly_count,
        "unique_processes": unique_processes,
        "anomaly_processes": anomaly_processes,
        "avg_syscall_rate": round(float(avg_rate), 1),
        "anomaly_rate_pct": round(
            (anomaly_count / total * 100) if total > 0 else 0.0, 1
        ),
        "top_anomalies": [
            {
                "pid": r.pid,
                "comm": r.comm,
                "anomaly_score": r.anomaly_score,
                "window_start_ns": r.window_start_ns,
            }
            for r in top_anomalies
        ],
    }
