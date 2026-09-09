import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const workspace = process.cwd();
const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "orbit-integration-"));
const databaseFile = path.join(temporaryDirectory, "orbit.json");
const port = 32_000 + Math.floor(Math.random() * 700);
const origin = `http://127.0.0.1:${port}`;
const nextBinary = path.join(workspace, "node_modules", "next", "dist", "bin", "next");
const server = spawn(process.execPath, [nextBinary, "start", "-p", String(port)], {
  cwd: workspace,
  env: { ...process.env, ORBIT_DATA_FILE: databaseFile, ORBIT_REQUEST_DELAY_MS: "120" },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });

const checks = [];
const sessionId = `integration_${crypto.randomUUID()}`;

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`ORBIT server exited early.\n${serverOutput}`);
    try {
      const response = await fetch(`${origin}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`ORBIT server did not become ready.\n${serverOutput}`);
}

async function request(url, options) {
  const response = await fetch(`${origin}${url}`, options);
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  return { response, body };
}

async function postOrbit(query, tool = "AUTO", requestId = crypto.randomUUID()) {
  return request("/api/orbit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, requestId, tool, query }),
  });
}

function pass(label) {
  checks.push(label);
}

try {
  await waitForServer();

  const page = await fetch(origin);
  const html = await page.text();
  assert.equal(page.status, 200);
  assert.match(html, /DATA FORGE — ORBIT/);
  pass("page renders with the expected metadata");

  const health = await request("/api/health");
  assert.equal(health.response.status, 200);
  assert.equal(health.body.status, "ok");
  assert.equal(health.body.persistence.ready, true);
  assert.deepEqual(health.body.tools, ["WEATHER", "SEARCH", "CALCULATOR", "TIMER", "NOTES"]);
  pass("health, persistence, and capability discovery");

  const bootstrap = await request(`/api/orbit?sessionId=${encodeURIComponent(sessionId)}`);
  assert.equal(bootstrap.response.status, 200);
  assert.equal(bootstrap.body.online, true);
  assert.equal(bootstrap.body.state.notes.length, 0);
  pass("session bootstrap returns a clean durable state");

  const invalid = await postOrbit("");
  assert.equal(invalid.response.status, 400);
  pass("invalid commands are rejected");

  const calculation = await postOrbit("Calculate 7 * (3 + 2)");
  assert.equal(calculation.response.status, 200);
  assert.equal(calculation.body.tool, "CALCULATOR");
  assert.match(calculation.body.answer, /= 35$/);
  pass("automatic routing and calculator execution");

  const note = await postOrbit("Remember to finish the ORBIT integration test", "NOTES");
  assert.equal(note.response.status, 200);
  assert.equal(note.body.note.content, "finish the ORBIT integration test");
  const noteId = note.body.note.id;
  const noteState = await request(`/api/orbit/state?sessionId=${encodeURIComponent(sessionId)}`);
  assert.equal(noteState.body.state.notes.some((item) => item.id === noteId), true);
  pass("notes persist and can be read back");

  const timer = await postOrbit("Set a timer for 1 second", "TIMER");
  assert.equal(timer.response.status, 200);
  assert.equal(timer.body.timer.status, "active");
  await new Promise((resolve) => setTimeout(resolve, 1_150));
  const timerState = await request(`/api/orbit/state?sessionId=${encodeURIComponent(sessionId)}`);
  assert.equal(timerState.body.state.timers.find((item) => item.id === timer.body.timer.id)?.status, "completed");
  pass("timers persist and complete on schedule");

  const cancelledTimer = await postOrbit("Set a timer for 30 seconds", "TIMER");
  const timerDelete = await request("/api/orbit/state", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, resource: "timer", id: cancelledTimer.body.timer.id }),
  });
  assert.equal(timerDelete.response.status, 200);
  assert.equal(timerDelete.body.state.timers.some((item) => item.id === cancelledTimer.body.timer.id), false);
  pass("active timers can be stopped and removed");

  const search = await postOrbit("Search for Alan Turing", "SEARCH");
  assert.equal(search.response.status, 200);
  assert.match(search.body.answer, /Alan Turing/i);
  assert.match(search.body.meta, /^https:\/\//);
  pass("verified web search returns a source");

  const weather = await postOrbit("Check the weather in Delhi", "WEATHER");
  assert.equal(weather.response.status, 200);
  assert.match(weather.body.answer, /Delhi/i);
  pass("live weather lookup returns current conditions");

  const fencedRequestId = crypto.randomUUID();
  const pending = postOrbit("Check the weather in Reykjavik", "WEATHER", fencedRequestId);
  let activeRequestId = null;
  for (let attempt = 0; attempt < 30 && activeRequestId !== fencedRequestId; attempt += 1) {
    const state = await request(`/api/orbit/state?sessionId=${encodeURIComponent(sessionId)}`);
    activeRequestId = state.body.state.activeRequestId;
    if (activeRequestId !== fencedRequestId) await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(activeRequestId, fencedRequestId);
  const cancellation = await request("/api/orbit", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, requestId: fencedRequestId }),
  });
  assert.equal(cancellation.response.status, 200);
  const fenced = await pending;
  assert.equal(fenced.response.status, 409);
  assert.equal(fenced.body.stale, true);
  pass("interrupted requests are fenced before commit");

  const voice = await request("/api/voice");
  assert.equal(voice.response.status, 200);
  assert.equal(voice.body.provider, "Rime");
  assert.equal(typeof voice.body.configured, "boolean");
  pass("voice provider readiness and fallback contract");

  const noteDelete = await request("/api/orbit/state", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, resource: "note", id: noteId }),
  });
  assert.equal(noteDelete.body.state.notes.some((item) => item.id === noteId), false);
  const historyDelete = await request("/api/orbit/state", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, resource: "history" }),
  });
  assert.equal(historyDelete.body.state.runs.length, 0);
  pass("server memory and history management");

  process.stdout.write(`${checks.map((label) => `✓ ${label}`).join("\n")}\n\n${checks.length} integration checks passed.\n`);
} finally {
  if (server.exitCode === null) {
    server.kill();
    await new Promise((resolve) => server.once("exit", resolve));
  }
  await rm(temporaryDirectory, { recursive: true, force: true });
}
