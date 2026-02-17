from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.auth import router as auth_router
from app.routes.cloudflare import router as cf_router
from app.routes.claude import router as claude_router
from app.routes.ports import router as ports_router
from app.routes.llm import router as llm_router
from app.scheduler import start_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield


app = FastAPI(title="SysMonitor", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3400", "http://localhost:3000", "http://192.192.192.169:3400"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(cf_router)
app.include_router(claude_router)
app.include_router(ports_router)
app.include_router(llm_router)


@app.get("/api/v1/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}
