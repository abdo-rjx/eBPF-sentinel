import os

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..db.repository import query_windows
from ..db.schema import WindowRecord
from ..db.session import get_session as SessionLocal
from ..ml.explain import FeatureAnalyzer
from .auth import verify_token
from .schemas import WindowOut

router = APIRouter(
    prefix="/api/v1", tags=["windows"], dependencies=[Depends(verify_token)]
)

_analyzer: FeatureAnalyzer | None = None


def get_analyzer() -> FeatureAnalyzer:
    global _analyzer
    if _analyzer is None:
        # baseline.csv lives at backend/baseline.csv; resolve relative to this
        # module so /analysis works regardless of the process CWD.
        baseline = os.path.join(os.path.dirname(__file__), "..", "..", "baseline.csv")
        _analyzer = FeatureAnalyzer(baseline_path=baseline)
    return _analyzer


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/windows", response_model=list[WindowOut])
def list_windows(
    limit: int = Query(100, le=1000),
    pid: int | None = None,
    anomalous_only: bool = False,
    db: Session = Depends(get_db),
):
    return query_windows(db, limit=limit, pid=pid, anomalous_only=anomalous_only)


@router.get("/windows/{window_id}", response_model=WindowOut)
def get_window(window_id: int, db: Session = Depends(get_db)):
    from fastapi import HTTPException

    record = db.query(WindowRecord).filter(WindowRecord.id == window_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Window not found")
    return record


@router.get("/windows/{window_id}/analysis")
def analyze_window(
    window_id: int,
    db: Session = Depends(get_db),
    analyzer: FeatureAnalyzer = Depends(get_analyzer),
):
    from fastapi import HTTPException

    record = db.query(WindowRecord).filter(WindowRecord.id == window_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Window not found")
    return analyzer.analyze(record)
