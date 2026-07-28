import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .schema import Base

_engine = None
_SessionLocal = None

def _get_db_path():
    return os.environ.get("SENTINEL_DB_PATH", "/data/sentinel.db")

def _ensure_initialized():
    global _engine, _SessionLocal
    if _engine is None:
        db_path = _get_db_path()
        _engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
        _SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False)

def get_session():
    _ensure_initialized()
    return _SessionLocal()

def init_db():
    _ensure_initialized()
    Base.metadata.create_all(bind=_engine)
