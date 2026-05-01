from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api import ai, auth, documents, search, ws
from app.core.config import get_settings
from app.db.session import engine
from app.models import Base


settings = get_settings()

app = FastAPI(title="NoteFlow API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://localhost", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup() -> None:
    async with engine.begin() as connection:
        # Enable pgvector extension before creating tables (required on Railway / managed Postgres)
        await connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await connection.run_sync(Base.metadata.create_all)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(ai.router)
app.include_router(search.router)
app.include_router(ws.router)

