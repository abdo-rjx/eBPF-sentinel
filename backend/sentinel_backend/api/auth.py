import os

from fastapi import Header, HTTPException, Query, status


def verify_token(authorization: str | None = Header(None)):
    expected = os.environ.get("API_AUTH_TOKEN")
    if not expected:
        raise RuntimeError(
            "API_AUTH_TOKEN is not set — refusing to start with no auth configured"
        )
    if authorization is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer token"
        )
    token = authorization.removeprefix("Bearer ")
    if token != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )


def verify_token_any(
    authorization: str | None = Header(None),
    token: str | None = Query(None),
):
    """Accept the token as either `Authorization: Bearer <t>` header or `?token=<t>` query param.

    The frontend's native EventSource cannot set request headers, so the SSE
    stream must also accept the token as a query parameter. Only the stream
    router uses this; all other routers keep header-only auth.
    """
    expected = os.environ.get("API_AUTH_TOKEN")
    if not expected:
        raise RuntimeError(
            "API_AUTH_TOKEN is not set — refusing to start with no auth configured"
        )
    provided = None
    if authorization and authorization.startswith("Bearer "):
        provided = authorization.removeprefix("Bearer ")
    elif token:
        provided = token
    if not provided:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token"
        )
    if provided != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )
