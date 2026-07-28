import os
from fastapi import Header, HTTPException, status
from typing import Optional

def verify_token(authorization: Optional[str] = Header(None)):
    expected = os.environ.get("API_AUTH_TOKEN")
    if not expected:
        raise RuntimeError("API_AUTH_TOKEN is not set — refusing to start with no auth configured")
    if authorization is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Authorization header")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer token")
    token = authorization.removeprefix("Bearer ")
    if token != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
