"""Periodic pruning of old window records to prevent unbounded DB growth.

Usage:
    from sentinel_backend.db.retention import prune_old_windows, start_retention_loop

    # One-time prune:
    prune_old_windows(retention_hours=24)

    # Background loop (call from pipeline.py):
    start_retention_loop(retention_hours=24, interval_hours=1)
"""
import logging
import threading
import time
from sqlalchemy import delete
from .session import get_session as SessionLocal
from .schema import WindowRecord

logger = logging.getLogger(__name__)


def prune_old_windows(retention_hours: int = 24) -> int:
    """Delete all window records older than `retention_hours`. Returns count deleted."""
    db = SessionLocal()
    try:
        cutoff_ns = int((time.time() - retention_hours * 3600) * 1_000_000_000)
        count = db.query(WindowRecord).filter(
            WindowRecord.window_end_ns < cutoff_ns
        ).count()
        if count > 0:
            db.execute(
                delete(WindowRecord).where(
                    WindowRecord.window_end_ns < cutoff_ns
                )
            )
            db.commit()
            logger.info("Pruned %d old window records (>%dh)", count, retention_hours)
        return count
    finally:
        db.close()


def _retention_loop(retention_hours: int, interval_hours: int, stop):
    while not stop.is_set():
        try:
            prune_old_windows(retention_hours=retention_hours)
        except Exception as exc:
            logger.warning("Retention prune failed: %s", exc)
        stop.wait(timeout=interval_hours * 3600)


def start_retention_loop(
    retention_hours: int = 24, interval_hours: int = 1
) -> threading.Event:
    """Start a daemon thread that prunes old records periodically.
    Returns the stop Event — call stop.set() to shut down."""
    stop = threading.Event()
    t = threading.Thread(
        target=_retention_loop,
        args=(retention_hours, interval_hours, stop),
        daemon=True,
    )
    t.start()
    logger.info(
        "Retention loop started: prune >%dh old records every %dh",
        retention_hours,
        interval_hours,
    )
    return stop
