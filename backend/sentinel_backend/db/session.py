import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from ..config import SENTINEL_DB_PATH
from .schema import Base

_engine = None
_SessionLocal = None


def _get_db_path():
    # Single source of truth is config.py (absolute default: backend/sentinel.db),
    # so the engine works regardless of the process CWD.
    path = SENTINEL_DB_PATH
    # Ensure parent directory exists for custom paths like /data/sentinel.db
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    return path


def _ensure_initialized():
    global _engine, _SessionLocal
    if _engine is None:
        db_path = _get_db_path()
        _engine = create_engine(
            f"sqlite:///{db_path}", connect_args={"check_same_thread": False}
        )
        _SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False)


def get_session():
    _ensure_initialized()
    return _SessionLocal()


def init_db():
    _ensure_initialized()
    Base.metadata.create_all(bind=_engine)
