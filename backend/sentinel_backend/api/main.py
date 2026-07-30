from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from . import routes_windows, routes_processes, routes_stream, routes_stats
from ..db.session import init_db


@asynccontextmanager
async def lifespan(application: FastAPI):
    init_db()
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
