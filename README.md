# EnglishAI

EnglishAI is a pronunciation coach for adult English learners who know what they want to say but need reliable practice with difficult sounds, word stress, connected speech, unfamiliar names, and easily confused numbers. The learner hears a Rime-generated reference at slow and natural speed, records an attempt, receives content and delivery feedback, and retries against saved before/after evidence.

- Live demo: https://english-ai-pronunciation-coach.vercel.app/
- Source: https://github.com/rasesh13/english-ai-pronunciation-coach
- Four-minute demo plan and recording checklist: [DEMO.md](./DEMO.md)
- Hard-voice acceptance evidence: [RIME_EVIDENCE.md](./RIME_EVIDENCE.md)

## Normal flow

1. Choose one of 20 phrases across VOWELS, STRESS, RHYTHM, NAMES, and NUMBERS.
2. Select **HEAR MODEL**. The server requests the phrase from Rime at slow (`timeScaleFactor: 1.43`) and natural (`1.0`) speed.
3. Select the microphone and speak. `MediaRecorder` captures the audio while Web Speech can provide a low-latency provisional transcript.
4. FastAPI sends recorded audio to Whisper when configured, evaluates phrase accuracy and pacing, and persists the attempt.
5. EnglishAI shows the score, phonetic cue, coaching tip, recurring mistakes, and before/after improvement.

The hard voice problem is interruption safety: stopping a live attempt aborts the active request, stops queued audio, and fences any late result so obsolete speech cannot play after the learner changes direction.

## Setup

Prerequisites: Node.js 20.9 or newer, npm, Python 3.12, and a modern Chromium browser. PostgreSQL is optional; SQLite is the local default.

```bash
git clone https://github.com/rasesh13/english-ai-pronunciation-coach.git
cd english-ai-pronunciation-coach
npm install
python -m venv backend/.venv
backend/.venv/Scripts/python -m pip install -r backend/requirements.txt
copy .env.example .env.local
```

On macOS/Linux, activate `backend/.venv/bin/python` and use `cp .env.example .env.local`. Add real credentials only to `.env.local`; it is ignored by Git.

Required for the judged Rime path:

```dotenv
RIME_API_KEY=
```

Optional production values are `DATABASE_URL`, `OPENAI_API_KEY` (or `STT_API_KEY`), `FASTAPI_URL`, and `CORS_ORIGINS`. Start both services with:

```bash
npm run dev
```

Open http://localhost:3000. The launcher starts Next.js on port 3000 and FastAPI on port 8000.

## Architecture

```text
Browser
  ├─ MediaRecorder + optional Web Speech transcript
  └─ Next.js 16 App Router UI
       ├─ /api/english/* Route Handlers (server boundary)
       └─ FastAPI
            ├─ Whisper transcription (optional authoritative transcript)
            ├─ deterministic pronunciation + pacing evaluation
            ├─ PostgreSQL/pgvector or SQLite persistence
            └─ Rime HTTPS JSON request → streamed MPEG audio
```

The Rime API key exists only in FastAPI. Next.js proxies the response stream without buffering it and forwards non-secret evidence headers (`X-Voice-Provider`, `X-Rime-Model`, `X-Rime-Speaker`, and `X-Rime-Language`). The UI shows `RIME · CODA · ASTRA` only after a successful Rime audio response; a configured flag alone is not presented as proof of playback.

The interruption boundary uses `AbortController`, a monotonically increasing request ID, immediate audio cleanup, and server-side stale-request checks. A late response must still own the active request ID before it can update state or speak.

## Third-party services

| Service | Purpose | Data sent |
| --- | --- | --- |
| Rime | Slow and natural reference speech | Target phrase, speaker/model/language, speed factor |
| OpenAI Whisper | Optional authoritative transcription | Recorded attempt audio |
| Render | FastAPI and PostgreSQL hosting | Application/API traffic and learner state |
| Vercel | Next.js hosting and server-side proxy | Web and Route Handler traffic |
| PostgreSQL + pgvector | Production attempt and mistake persistence | Session-scoped evaluation records |

## Exact Rime configuration

| Detail | Value used by this repository |
| --- | --- |
| Model ID | `coda` |
| Speaker | `astra` |
| Language | `en-US` |
| Endpoint | `https://users.rime.ai/v1/rime-tts` |
| Request | HTTPS `POST`, bearer authorization, JSON body |
| Request fields | `speaker`, `text`, `modelId`, `lang`, `timeScaleFactor` |
| Audio format | `audio/mpeg` requested and streamed to the browser |
| Transport | FastAPI streaming HTTP response → Next.js streaming proxy → browser `Audio` |
| Slow / normal | `timeScaleFactor` `1.43` / `1.0` |

Run `npm run verify:rime` against production, or `npm run verify:rime -- http://localhost:3000`, to prove configuration plus non-empty streamed audio. The command fails closed if Rime is not configured, the response is not audio, or any provider/model/speaker/language evidence header differs.

## API

- `GET /api/english/health` — database, Whisper, Rime readiness, and non-secret Rime configuration.
- `GET /api/english/catalog` — the 20-phrase practice catalog.
- `POST /api/english/evaluate` — audio/transcript evaluation and persistence.
- `GET|DELETE /api/english/state` — before/after attempts and recurring mistakes.
- `POST /api/english/tts` — Rime audio at `slow` or `normal` speed.

## Failure behavior

- Missing Rime key: `/tts` returns `503`; the UI labels the path `BROWSER VOICE` and uses browser speech synthesis.
- Rime timeout/upstream error: FastAPI returns `502`; the UI falls back to browser speech for that utterance.
- Interruption: active fetches are aborted, current audio and browser synthesis stop, recording tracks close, and late request IDs cannot commit.
- Missing Whisper key: Web Speech supplies the transcript when available. If neither exists, the UI explains how to configure transcription.
- Whisper failure: a provisional browser transcript can still be evaluated; without one, the API returns `502`.
- Missing PostgreSQL: local development uses SQLite. A production database outage makes the FastAPI workflow unavailable rather than silently discarding evidence.
- Oversized or empty audio: files over 15 MB return `413`; attempts without any transcript return `422`.

## Known limitations

- Browser microphone and Web Speech behavior varies by browser and requires user permission.
- Pronunciation scoring combines transcript match and delivery timing; it is coaching feedback, not a clinical accent assessment.
- Word-level acoustic/phoneme scoring depends on the transcription provider and is not a full forced-alignment system.
- SQLite is single-instance local storage and is not suitable for horizontally scaled production.
- Browser speech is an explicit availability fallback and is not Rime evidence.
- The live Rime proof requires `RIME_API_KEY` on the Render FastAPI service; repository configuration cannot include that secret.

## Verification

```bash
npm run test:rime-config  # organizers' config/secret hygiene preflight
npm run test:english      # catalog, scoring, history, fallback behavior
npm run test:integration  # production build, hard interruption fence, API state
npm run judge:preflight   # config scan, lint, build, EnglishAI integration
npm run verify:rime       # live provider + streamed audio proof (requires deployed key)
```

`.env.example` contains blank secret placeholders only. `.gitignore` excludes all other `.env*` files, local databases, and generated build output.

## Deployment

The Next.js frontend deploys from `main` to Vercel. `render.yaml` defines the FastAPI service and PostgreSQL database; secret fields use `sync: false`. Configure `FASTAPI_URL` in Vercel and enter `RIME_API_KEY` and `OPENAI_API_KEY` in Render's environment settings. Never prefix those secrets with `NEXT_PUBLIC_`.
