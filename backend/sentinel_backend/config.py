import os

_BACKEND_ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))


def _resolve_path(path: str) -> str:
    """Resolve a possibly-relative file path against the backend root.

    Env overrides like SENTINEL_DB_PATH=sentinel.db (see .env) are meant
    relative to the project, not the process CWD — booting uvicorn from /tmp
    must not silently create a brand-new empty DB next to it.
    """
    if os.path.isabs(path):
        return path
    return os.path.normpath(os.path.join(_BACKEND_ROOT, path))


API_AUTH_TOKEN = os.environ.get("API_AUTH_TOKEN")
SENTINEL_DB_PATH = _resolve_path(os.environ.get("SENTINEL_DB_PATH", "sentinel.db"))
SENTINEL_SOCKET_PATH = os.environ.get(
    "SENTINEL_SOCKET_PATH", "/tmp/sentinel_collector.sock"
)
SENTINEL_MODEL_PATH = _resolve_path(
    os.environ.get(
        "SENTINEL_MODEL_PATH", "sentinel_backend/ml/model_store/isolation_forest.joblib"
    )
)
SENTINEL_WINDOW_SECONDS = int(os.environ.get("SENTINEL_WINDOW_SECONDS", "5"))
ISOLATION_FOREST_CONTAMINATION = float(
    os.environ.get("ISOLATION_FOREST_CONTAMINATION", "0.02")
)
