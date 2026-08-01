import os

API_AUTH_TOKEN = os.environ.get("API_AUTH_TOKEN")
SENTINEL_DB_PATH = os.environ.get("SENTINEL_DB_PATH", os.path.join(os.path.dirname(__file__), "..", "sentinel.db"))
SENTINEL_SOCKET_PATH = os.environ.get("SENTINEL_SOCKET_PATH", "/tmp/sentinel_collector.sock")
SENTINEL_WINDOW_SECONDS = int(os.environ.get("SENTINEL_WINDOW_SECONDS", "5"))
ISOLATION_FOREST_CONTAMINATION = float(os.environ.get("ISOLATION_FOREST_CONTAMINATION", "0.02"))
