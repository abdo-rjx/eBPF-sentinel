import os
import pytest
from fastapi.testclient import TestClient

os.environ["API_AUTH_TOKEN"] = "test-token-12345"
os.environ["SENTINEL_DB_PATH"] = "/tmp/sentinel_test_api.db"

from sentinel_backend.api.main import app
from sentinel_backend.db.session import init_db

init_db()
client = TestClient(app)

def test_health_no_auth():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"

def test_windows_no_auth():
    resp = client.get("/api/v1/windows")
    assert resp.status_code == 401

def test_windows_with_auth():
    resp = client.get("/api/v1/windows", headers={"Authorization": "Bearer test-token-12345"})
    assert resp.status_code == 200

def test_stream_no_auth():
    resp = client.get("/api/v1/stream")
    assert resp.status_code == 401

def test_invalid_token():
    resp = client.get("/api/v1/windows", headers={"Authorization": "Bearer wrong-token"})
    assert resp.status_code == 401
