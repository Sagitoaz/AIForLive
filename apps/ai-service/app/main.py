from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.personalization import router as personalization_router
from app.core.settings import settings
from app.services.personalization import PersonalizationService


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.personalization_service = PersonalizationService()
    yield


app = FastAPI(
    title=settings.service_name,
    version=settings.version,
    description="Bounded personalization intelligence; never writes business tables.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:4000"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.middleware("http")
async def correlation_id(request: Request, call_next):  # type: ignore[no-untyped-def]
    request_id = request.headers.get("x-correlation-id", str(uuid4()))
    response = await call_next(request)
    response.headers["x-correlation-id"] = request_id
    return response


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.service_name, "version": settings.version}


app.include_router(personalization_router)
