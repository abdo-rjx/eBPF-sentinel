from fastapi import APIRouter, Depends, Query
from typing import Optional, List
from sqlalchemy.orm import Session
from .auth import verify_token
from .schemas import WindowOut
from ..db.session import get_session as SessionLocal
from ..db.repository import query_windows
from ..db.schema import WindowRecord

router = APIRouter(prefix="/api/v1", tags=["windows"], dependencies=[Depends(verify_token)])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/windows", response_model=List[WindowOut])
def list_windows(
    limit: int = Query(100, le=1000), pid: Optional[int] = None,
    anomalous_only: bool = False, db: Session = Depends(get_db),
):
    return query_windows(db, limit=limit, pid=pid, anomalous_only=anomalous_only)

@router.get("/windows/{window_id}", response_model=WindowOut)
def get_window(window_id: int, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    record = db.query(WindowRecord).filter(WindowRecord.id == window_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Window not found")
    return record
