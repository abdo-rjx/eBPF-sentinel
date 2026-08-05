import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ..db.session import init_db
from ..pipeline import run_pipeline
from . import routes_processes, routes_stats, routes_stream, routes_windows


@asynccontextmanager
async def lifespan(application: FastAPI):
    init_db()
    # run_pipeline() blocks forever; it must live in the SAME process as the
    # SSE endpoints because routes_stream._subscribers is an in-process set.
    # A daemon thread keeps the event loop free while the pipeline consumes
    # the collector socket, scores windows, and broadcasts them to subscribers.
    threading.Thread(target=run_pipeline, name="sentinel-pipeline", daemon=True).start()
    yield


app = FastAPI(title="Sentinel API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(routes_windows.router)
app.include_router(routes_processes.router)
app.include_router(routes_stats.router)
app.include_router(routes_stream.router)


@app.get("/health")
def health():
    return {"status": "ok"}
