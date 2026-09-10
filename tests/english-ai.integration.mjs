import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const workspace = process.cwd();
const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "english-ai-integration-"));
const databaseFile = path.join(temporaryDirectory, "english-ai.db");
const port = 33_000 + Math.floor(Math.random() * 700);
const origin = `http://127.0.0.1:${port}`;
const windowsVenvPython = path.join(workspace, "backend", ".venv", "Scripts", "python.exe");
const unixVenvPython = path.join(workspace, "backend", ".venv", "bin", "python");
const python = existsSync(windowsVenvPython) ? windowsVenvPython : existsSync(unixVenvPython) ? unixVenvPython : "python";
const server = spawn(python, ["-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", String(port)], {
  cwd: workspace,
  env: { ...process.env, DATABASE_URL: `sqlite:///${databaseFile.replaceAll("\\", "/")}`, RIME_API_KEY: "", OPENAI_API_KEY: "", STT_API_KEY: "" },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
server.stdout.on("data", (chunk) => { output += chunk.toString(); });
server.stderr.on("data", (chunk) => { output += chunk.toString(); });
const sessionId = `test_${crypto.randomUUID()}`;

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`EnglishAI backend exited early.\n${output}`);
    try { if ((await fetch(`${origin}/health`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`EnglishAI backend did not start.\n${output}`);
}

async function evaluate(targetPhrase, transcript, durationMs = 2_000) {
  const body = new FormData();
  body.set("sessionId", sessionId);
  body.set("targetPhrase", targetPhrase);
  body.set("transcript", transcript);
  body.set("durationMs", String(durationMs));
  const response = await fetch(`${origin}/evaluate`, { method: "POST", body });
  return { response, body: await response.json() };
}

try {
  await waitForServer();

  const health = await (await fetch(`${origin}/health`)).json();
  assert.equal(health.status, "ok");
  assert.equal(health.providers.whisper, false);
  assert.equal(health.providers.rime, false);
  assert.deepEqual(health.rime, {
    configured: false,
    provider: "Rime",
    modelId: "coda",
    speaker: "astra",
    language: "en-US",
    endpoint: "https://users.rime.ai/v1/rime-tts",
    audioFormat: "audio/mpeg",
    requestTransport: "HTTPS POST + JSON",
    responseTransport: "streamed HTTP response",
  });

  const catalog = await (await fetch(`${origin}/catalog`)).json();
  assert.equal(catalog.items.length, 20);
  assert.deepEqual([...new Set(catalog.items.map((item) => item.category))], ["VOWELS", "STRESS", "RHYTHM", "NAMES", "NUMBERS"]);

  const target = "Thirty-three thoughtful thinkers.";
  const first = await evaluate(target, "Thirty thoughtful thinkers.");
  assert.equal(first.response.status, 200);
  assert.equal(first.body.providers.transcription, "browser-transcript");
  assert.ok(first.body.evaluation.issues.length > 0);

  const repeat = await evaluate(target, "Thirty thoughtful thinkers.");
  assert.equal(repeat.response.status, 200);
  assert.equal(repeat.body.state.mistakes[0].count, 2);
  assert.equal(repeat.body.state.stats.recurringMistakes, 1);

  const corrected = await evaluate(target, target);
  assert.equal(corrected.response.status, 200);
  assert.equal(corrected.body.evaluation.score, 100);
  assert.ok(corrected.body.evaluation.improvement > 0);
  assert.equal(corrected.body.state.attempts.length, 3);

  const tts = await fetch(`${origin}/tts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: target, speed: "slow" }) });
  assert.equal(tts.status, 503);

  const mistakeId = corrected.body.state.mistakes[0].id;
  const deleteMistake = await fetch(`${origin}/state`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId, resource: "mistake", id: mistakeId }) });
  assert.equal((await deleteMistake.json()).state.mistakes.length, 0);

  const clearAttempts = await fetch(`${origin}/state`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId, resource: "attempts" }) });
  assert.equal((await clearAttempts.json()).state.attempts.length, 0);

  process.stdout.write("✓ 20-phrase catalog and five practice categories\n✓ transcript evaluation and issue detection\n✓ recurring-mistake counting\n✓ retry improvement and before/after history\n✓ Rime fallback contract\n✓ selective state clearing\n");
} finally {
  if (server.exitCode === null) {
    server.kill();
    await new Promise((resolve) => server.once("exit", resolve));
  }
  await rm(temporaryDirectory, { recursive: true, force: true });
}
