from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from . import routes_windows, routes_stream
from ..db.session import init_db

app = FastAPI(title="Sentinel API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["Authorization", "Content-Type"],
)

@app.on_event("startup")
def on_startup():
    init_db()

app.include_router(routes_windows.router)
app.include_router(routes_stream.router)

@app.get("/health")
def health():
    return {"status": "ok"}
