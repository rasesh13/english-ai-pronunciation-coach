# Rime and hard-voice evidence

## Claim

EnglishAI lets a learner interrupt reference speech or an active request and immediately change direction. The prior audio is stopped, the request is aborted, and any late response is rejected before it can update the session or speak.

## Acceptance test

Given request A is active, when the user interrupts A and starts request B, all of the following must hold:

1. A's audio playback and queued browser synthesis stop immediately.
2. A's client fetch receives an abort signal.
3. The server marks A cancelled and refuses A's late result with `409` and `stale: true`.
4. Only the current request may commit state or produce speech.
5. A successful Rime stream identifies itself as provider `Rime`, model `coda`, speaker `astra`, language `en-US`, and contains non-empty audio bytes.

## Repeatable procedure

```bash
npm install
npm run test:rime-config
npm run test:integration
npm run verify:rime
```

`tests/orbit.integration.mjs` starts request A, waits until its request ID is active, sends the interruption, and asserts that the pending response is fenced with `409` and `stale: true`. `scripts/rime-live-check.mjs` reads public health/configuration, requests both slow and normal speech, checks the provider evidence headers, and reads the first streamed audio chunk. It never needs or prints the Rime API key.

For a manual reproduction, select **HEAR MODEL**, press **STOP** during playback, then immediately choose a different phrase. The first voice must stop and must not resume. After an actual Rime response, the control panel must show `RIME · CODA · ASTRA`.

## Results

### Deterministic interruption acceptance

Passed locally on 2026-09-10 with the exact output `interrupted requests are fenced before commit`; the full run completed with `13 integration checks passed`. The test fails if the stale response is accepted.

### Live Rime provider check — 2026-09-10 UTC

Command:

```bash
npm run verify:rime
```

Observed production state before this update:

- `GET /api/english/health`: `200`, `providers.rime: false`
- `POST /api/english/tts`: `503`, JSON error response, no audio stream
- `/api/voice`: `configured: false`, model `coda`, voice `astra`

Result: **Rime live acceptance is blocked because `RIME_API_KEY` is not configured on the deployed FastAPI service.** This is not a Rime latency measurement and must not be presented as one. After the server-only key is added in Render and the service redeploys, rerun `npm run verify:rime` and replace this subsection with its timestamped passing output before recording the judged demo.

## Failure behavior

- Missing key returns `503` and the UI uses explicitly labeled browser speech.
- Rime network, timeout, or upstream failures return `502`; no partial provider success is claimed.
- An interrupt aborts fetch, stops HTML audio and speech synthesis, closes recording tracks, and increments the request generation so stale callbacks return without committing.
- Provider proof is derived from successful response headers plus non-empty streamed audio, never from the presence of configuration alone.

## Limitations

- The automated fence test is deterministic but does not measure microphone-to-stop latency on every device.
- Network and browser scheduling affect the observed interruption time.
- Browser speech fallback validates resilience, not Rime quality or availability.
- Positive live evidence cannot be committed until the deployment owner supplies the Rime secret outside Git.
- Pronunciation scoring is educational feedback and not a clinical or accent-bias evaluation.
