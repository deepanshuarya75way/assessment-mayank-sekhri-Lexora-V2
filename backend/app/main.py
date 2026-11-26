import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers.chat import router as chat_router
from app.routers.documents import router as documents_router
from app.routers.workspaces import router as workspaces_router
from app.services.bootstrap import run_startup_bootstrap

settings = get_settings()
app = FastAPI(title="Lexora API", version="0.1.0")

allowed_origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents_router)
app.include_router(chat_router)
app.include_router(workspaces_router)


@app.on_event("startup")
async def startup_event() -> None:
    await asyncio.to_thread(run_startup_bootstrap)



@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
