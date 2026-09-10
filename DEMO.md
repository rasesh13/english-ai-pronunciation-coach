# EnglishAI demo — 4:20 maximum

Recording link: add the final public, view-only video URL here after the production Rime check passes. Do not record a claimed Rime run while `npm run verify:rime` is failing.

## Before recording

1. Run `npm run judge:preflight`.
2. Run `npm run verify:rime` and retain its timestamped output.
3. Open the live demo and confirm the server line says `RIME READY`.
4. Prepare a quiet microphone and the phrase **Thirty-three thoughtful thinkers.**
5. Keep the GitHub `README.md`, `RIME_EVIDENCE.md`, and `scripts/rime-live-check.mjs` tabs ready.

## Timed shot list

| Time | Show | Say |
| --- | --- | --- |
| 0:00–0:30 | Landing view and five phrase categories | The target user is an adult English learner who needs repeatable feedback on sounds, stress, rhythm, names, and numbers—not a one-off transcript. |
| 0:30–1:20 | Select VOWELS and **HEAR MODEL** | This is the normal flow. FastAPI requests the reference twice from Rime: slow, then natural speed. Open the menu after playback and point to `RIME · CODA · ASTRA`; this appears only after successful streamed audio. |
| 1:20–2:15 | Record an intentionally imperfect first attempt, then show score/issues | MediaRecorder captures the attempt. Whisper is authoritative when configured; the evaluator stores phrase accuracy, pacing, phonetic guidance, and recurring mistakes. |
| 2:15–2:55 | Record a corrected retry and show before/after improvement | The measurable result is the score, improvement delta, attempt count, and recurring-mistake count. Use the values actually displayed; do not narrate predetermined numbers. |
| 2:55–3:35 | Start **HEAR MODEL**, press **STOP** during playback, immediately select another phrase | The hard voice problem is barge-in safety. Audio stops, the active fetch is aborted, and the old request ID is fenced so a late response cannot speak. |
| 3:35–3:55 | Deliberate failure: temporarily show the documented no-key result or a captured `503` preflight output | Missing or failed Rime never masquerades as success: the endpoint fails closed and the UI explicitly switches to `BROWSER VOICE`. |
| 3:55–4:20 | GitHub README, evidence file, live-check script, repository and live URL | Show the exact model, speaker, language, endpoint, MPEG format, streaming transport, reproducible tests, known limitations, source repository, and live demo link. |

## Required recording assertions

- Keep the recording under 4:30; the stated requirement is 4–5 minutes maximum.
- Show the browser address bar on the production URL.
- Show `RIME · CODA · ASTRA` after real playback, not merely `RIME READY`.
- Demonstrate one interruption while audio or a request is active.
- Show the actual on-screen measurement from the retry.
- Do not expose environment values, network authorization headers, dashboards, or keys.
- Upload the edited recording as view-only and replace the recording line at the top of this file with its URL.
