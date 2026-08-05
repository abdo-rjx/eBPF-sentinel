"""V1: processes endpoint — returns aggregated process info from windows table."""

from fastapi import APIRouter, Depends
from sqlalchemy import Integer, func
from sqlalchemy.orm import Session

from ..db.schema import WindowRecord
from ..db.session import get_session as SessionLocal
from .auth import verify_token

router = APIRouter(
    prefix="/api/v1", tags=["processes"], dependencies=[Depends(verify_token)]
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/processes")
def list_processes(db: Session = Depends(get_db)):
    rows = (
        db.query(
            WindowRecord.pid,
            WindowRecord.comm,
            func.count(WindowRecord.id).label("windows_count"),
            func.sum(WindowRecord.is_anomalous.cast(Integer)).label("anomalies_count"),
        )
        .group_by(WindowRecord.pid, WindowRecord.comm)
        .order_by(WindowRecord.pid)
        .all()
    )

    return [
        {
            "pid": r.pid,
            "comm": r.comm,
            "windows": r.windows_count,
            "anomalies": r.anomalies_count or 0,
        }
        for r in rows
    ]
