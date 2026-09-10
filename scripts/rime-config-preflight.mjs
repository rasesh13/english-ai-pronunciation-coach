import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const example = readFileSync(".env.example", "utf8");
const entries = new Map(
  example
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);

const secretNames = ["RIME_API_KEY", "OPENAI_API_KEY", "STT_API_KEY", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "LLM_API_KEY"];
for (const name of secretNames) {
  assert.ok(entries.has(name), `.env.example must declare ${name}`);
  assert.equal(entries.get(name), "", `.env.example must leave ${name} blank`);
}

assert.equal(entries.get("RIME_MODEL"), "coda");
assert.equal(entries.get("RIME_VOICE"), "astra");
assert.equal(entries.get("RIME_LANGUAGE"), "en-US");
assert.equal(entries.get("RIME_ENDPOINT"), "https://users.rime.ai/v1/rime-tts");
assert.ok(!example.includes("NEXT_PUBLIC_RIME"), "Rime configuration must remain server-only");

const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" }).trim().split(/\r?\n/);
const trackedEnvironmentFiles = tracked.filter((name) => /(^|\/)\.env(?:\.|$)/.test(name));
assert.deepEqual(trackedEnvironmentFiles, [".env.example"], "Only .env.example may be tracked");

for (const file of tracked) {
  if (!/\.(?:ts|tsx|js|mjs|py|md|ya?ml|json|example)$/.test(file)) continue;
  const text = readFileSync(file, "utf8");
  assert.ok(!/RIME_API_KEY[ \t]*=[ \t]*[^\s"']{12,}/.test(text), `Possible Rime secret in ${file}`);
}

process.stdout.write([
  "✓ .env.example contains every required Rime field",
  "✓ secret placeholders are blank",
  "✓ no NEXT_PUBLIC_RIME variable exposes server configuration",
  "✓ no non-example .env file is tracked",
  "✓ no obvious Rime credential is present in tracked text",
].join("\n") + "\n");
