from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.auth import router as auth_router
from app.routes.servers import router as servers_router
from app.routes.alerts import router as alerts_router
from app.routes.cloudflare import router as cf_router
from app.scheduler import start_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield


app = FastAPI(title="SysMonitor", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3400", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(servers_router)
app.include_router(alerts_router)
app.include_router(cf_router)


@app.get("/api/v1/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
