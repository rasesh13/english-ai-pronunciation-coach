import assert from "node:assert/strict";

const baseUrl = (process.argv[2] || process.env.DEMO_BASE_URL || "https://english-ai-pronunciation-coach.vercel.app").replace(/\/$/, "");
const phrase = "Thirty-three thoughtful thinkers.";

async function firstAudioChunk(speed) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}/api/english/tts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: phrase, speed }),
  });
  const reader = response.body?.getReader();
  const first = reader ? await reader.read() : { value: undefined };
  const firstAudioMs = Math.round(performance.now() - startedAt);
  await reader?.cancel();
  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    provider: response.headers.get("x-voice-provider"),
    modelId: response.headers.get("x-rime-model"),
    speaker: response.headers.get("x-rime-speaker"),
    language: response.headers.get("x-rime-language"),
    speed: response.headers.get("x-englishai-speed"),
    firstAudioMs,
    firstChunkBytes: first.value?.byteLength || 0,
  };
}

const healthResponse = await fetch(`${baseUrl}/api/english/health`, { cache: "no-store" });
assert.equal(healthResponse.status, 200, "Health endpoint must be reachable");
const health = await healthResponse.json();
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), baseUrl, health }, null, 2));
assert.equal(health.providers?.rime, true, "Rime is not configured on the live FastAPI service");

for (const speed of ["slow", "normal"]) {
  const result = await firstAudioChunk(speed);
  console.log(JSON.stringify(result, null, 2));
  assert.equal(result.status, 200);
  assert.match(result.contentType || "", /^audio\//);
  assert.equal(result.provider, "Rime");
  assert.equal(result.modelId, "coda");
  assert.equal(result.speaker, "astra");
  assert.equal(result.language, "en-US");
  assert.equal(result.speed, speed);
  assert.ok(result.firstChunkBytes > 0, "Rime returned no audio bytes");
}

process.stdout.write("✓ Live Rime configuration and streamed audio verified\n");
