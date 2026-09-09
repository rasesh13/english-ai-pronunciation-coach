from __future__ import annotations

import os
import re
from contextlib import asynccontextmanager
from typing import Annotated, Any

import httpx
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

from backend.database import DATABASE_URL, clear_learner_resource, clear_learner_state, get_learner_state, initialize_database, record_attempt
from backend.evaluation import PRACTICE_CATALOG, evaluate_attempt


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    yield


allowed_origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if origin.strip()]

app = FastAPI(title="EnglishAI pronunciation backend", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def production_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), geolocation=(), microphone=(self)"
    return response


class TtsRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1200)
    speed: str = Field(pattern="^(slow|normal)$")


class ClearRequest(BaseModel):
    sessionId: str = Field(min_length=1, max_length=80)
    resource: str | None = Field(default=None, pattern="^(attempts|mistake)$")
    id: str | None = Field(default=None, max_length=80)


def clean_session_id(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]", "", value)[:80]
    if not cleaned:
        raise HTTPException(status_code=400, detail="A valid session ID is required.")
    return cleaned


async def whisper_transcription(audio: bytes, filename: str, content_type: str) -> tuple[str, list[dict[str, Any]]]:
    api_key = os.getenv("OPENAI_API_KEY") or os.getenv("STT_API_KEY")
    if not api_key:
        raise RuntimeError("Whisper is not configured")
    data = [
        ("model", "whisper-1"),
        ("language", "en"),
        ("response_format", "verbose_json"),
        ("timestamp_granularities[]", "word"),
    ]
    files = {"file": (filename or "attempt.webm", audio, content_type or "audio/webm")}
    async with httpx.AsyncClient(timeout=45) as client:
        response = await client.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {api_key}"},
            data=data,
            files=files,
        )
    if response.status_code >= 400:
        raise RuntimeError(f"Whisper returned {response.status_code}")
    payload = response.json()
    return str(payload.get("text", "")).strip(), payload.get("words") or []


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "EnglishAI FastAPI",
        "database": "postgresql+pgvector" if DATABASE_URL.startswith("postgresql") else "sqlite-fallback",
        "providers": {
            "whisper": bool(os.getenv("OPENAI_API_KEY") or os.getenv("STT_API_KEY")),
            "rime": bool(os.getenv("RIME_API_KEY")),
        },
        "features": ["transcription", "evaluation", "slow-tts", "normal-tts", "recurring-mistakes", "before-after-evidence"],
    }


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "EnglishAI pronunciation backend", "status": "ok", "health": "/health"}


@app.get("/catalog")
def catalog() -> dict[str, Any]:
    return {"items": PRACTICE_CATALOG}


@app.get("/state")
def state(session_id: str) -> dict[str, Any]:
    return {"state": get_learner_state(clean_session_id(session_id))}


@app.delete("/state")
def clear_state(request: ClearRequest) -> dict[str, Any]:
    session_id = clean_session_id(request.sessionId)
    if request.resource:
        clear_learner_resource(session_id, request.resource, request.id)
    else:
        clear_learner_state(session_id)
    return {"ok": True, "state": get_learner_state(session_id)}


@app.post("/evaluate")
async def evaluate(
    session_id: Annotated[str, Form(alias="sessionId")],
    target_phrase: Annotated[str, Form(alias="targetPhrase", min_length=1, max_length=500)],
    transcript: Annotated[str, Form(max_length=1200)] = "",
    duration_ms: Annotated[int, Form(alias="durationMs", ge=0, le=300_000)] = 0,
    audio: Annotated[UploadFile | None, File()] = None,
) -> dict[str, Any]:
    clean_id = clean_session_id(session_id)
    resolved_transcript = transcript.strip()
    source = "browser-transcript"
    words: list[dict[str, Any]] = []

    if audio is not None:
        audio_bytes = await audio.read(15 * 1024 * 1024 + 1)
        if len(audio_bytes) > 15 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Audio must be smaller than 15 MB.")
        if audio_bytes and (os.getenv("OPENAI_API_KEY") or os.getenv("STT_API_KEY")):
            try:
                resolved_transcript, words = await whisper_transcription(audio_bytes, audio.filename or "attempt.webm", audio.content_type or "audio/webm")
                source = "whisper-1"
            except RuntimeError as error:
                if not resolved_transcript:
                    raise HTTPException(status_code=502, detail="Whisper could not transcribe this attempt.") from error

    if not resolved_transcript:
        raise HTTPException(status_code=422, detail="No transcript was available. Configure Whisper or use a browser with speech recognition.")

    if duration_ms <= 0 and words:
        duration_ms = round(float(words[-1].get("end", 0)) * 1000)
    try:
        result = evaluate_attempt(target_phrase, resolved_transcript, duration_ms)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    attempt = record_attempt(clean_id, result, source)
    return {
        "ok": True,
        "attempt": attempt,
        "evaluation": {**result, "improvement": attempt["improvement"]},
        "state": get_learner_state(clean_id),
        "providers": {"transcription": source, "rime": bool(os.getenv("RIME_API_KEY"))},
    }


@app.post("/tts")
async def tts(request: TtsRequest) -> Response:
    api_key = os.getenv("RIME_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Rime is not configured. Use browser speech fallback.")
    time_scale_factor = 1.43 if request.speed == "slow" else 1.0
    payload = {
        "speaker": os.getenv("RIME_VOICE", "astra"),
        "text": request.text.strip(),
        "modelId": os.getenv("RIME_MODEL", "coda"),
        "lang": os.getenv("RIME_LANGUAGE", "en-US"),
        "timeScaleFactor": time_scale_factor,
    }
    client = httpx.AsyncClient(timeout=30)
    try:
        upstream_request = client.build_request(
            "POST",
            os.getenv("RIME_ENDPOINT", "https://users.rime.ai/v1/rime-tts"),
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json", "Accept": "audio/mpeg"},
            json=payload,
        )
        response = await client.send(upstream_request, stream=True)
    except httpx.HTTPError as error:
        await client.aclose()
        raise HTTPException(status_code=502, detail="Rime is temporarily unavailable.") from error
    if response.status_code >= 400:
        await response.aclose()
        await client.aclose()
        raise HTTPException(status_code=502, detail=f"Rime returned {response.status_code}.")

    async def stream_audio():
        try:
            async for chunk in response.aiter_bytes():
                yield chunk
        finally:
            await response.aclose()
            await client.aclose()

    return StreamingResponse(stream_audio(), media_type=response.headers.get("content-type", "audio/mpeg"), headers={"Cache-Control": "no-store", "X-EnglishAI-Speed": request.speed})
