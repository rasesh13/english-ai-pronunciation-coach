# EnglishAI architecture

The active pronunciation path is:

Browser microphone -> MediaRecorder -> Next.js Route Handler -> FastAPI -> Whisper
-> transcript/delivery evaluation -> PostgreSQL + pgvector (or SQLite)
-> Rime at 0.7x -> Rime at 1.0x -> learner retry.

Web Speech recognition supplies a low-latency transcript when available. The recorded audio is always uploaded, and Whisper becomes the authoritative transcript when configured. Evaluation records content match, delivery pace, phrase-specific IPA/coaching cues, attempt improvement, and recurring mistakes. Rime credentials remain exclusively in FastAPI; browser speech is the explicit local fallback.

The 20-item practice catalog covers vowels, stress, rhythm, unfamiliar names, and rapid numbers. Repeating a phrase creates before/after evidence; matching issue tokens increment the learner's recurring-mistake history.

The server returns non-secret Rime evidence headers only after a successful upstream response. Next.js forwards those headers and the audio body as a stream; it never exposes the API key. The client uses the headers to distinguish `RIME · CODA · ASTRA` proof from the weaker `RIME READY` configuration state.

Interruption is enforced in layers: `AbortController` cancels the current client request, active `Audio` and browser synthesis are stopped, media tracks are closed, and a request-generation check prevents stale callbacks from committing. The server-side ORBIT route separately fences cancelled request IDs before persistence.

The original ORBIT endpoints and story remain available as compatibility and presentation layers; the live controls are connected to the EnglishAI workflow.
