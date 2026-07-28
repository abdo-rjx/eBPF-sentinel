import asyncio
import json
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from .auth import verify_token

router = APIRouter(prefix="/api/v1", tags=["stream"], dependencies=[Depends(verify_token)])

_subscribers: set[asyncio.Queue] = set()

def broadcast_window(window_dict: dict):
    payload = json.dumps(window_dict, default=str)
    for q in list(_subscribers):
        q.put_nowait(payload)

@router.get("/stream")
async def stream(request: Request):
    queue: asyncio.Queue = asyncio.Queue()
    _subscribers.add(queue)

    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"data: {payload}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            _subscribers.discard(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
