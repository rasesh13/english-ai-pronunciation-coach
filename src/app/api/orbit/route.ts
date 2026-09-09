import {
  beginOrbitRequest,
  cancelOrbitRequest,
  commitOrbitRequest,
  failOrbitRequest,
  getOrbitState,
  type OrbitTool,
} from "@/server/orbit-store";
import { executeOrbitTool, inferOrbitTool, orbitTools } from "@/server/orbit-tools";

function json(data: object, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function cleanIdentifier(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const cleaned = value.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  return cleaned || fallback;
}

async function applyConfiguredDelay() {
  const delay = Math.min(2_000, Math.max(0, Number(process.env.ORBIT_REQUEST_DELAY_MS) || 0));
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
}

export async function GET(request: Request) {
  const sessionId = cleanIdentifier(new URL(request.url).searchParams.get("sessionId"), "anonymous");
  return json({
    online: true,
    tools: orbitTools,
    voiceConfigured: Boolean(process.env.RIME_API_KEY),
    state: await getOrbitState(sessionId),
  });
}

export async function POST(request: Request) {
  const started = Date.now();
  let sessionId = "anonymous";
  let requestId = crypto.randomUUID();
  let query = "";
  let tool: OrbitTool = "SEARCH";

  try {
    const body = await request.json() as { tool?: unknown; query?: unknown; sessionId?: unknown; requestId?: unknown };
    query = typeof body.query === "string" ? body.query.trim() : "";
    sessionId = cleanIdentifier(body.sessionId, "anonymous");
    requestId = cleanIdentifier(body.requestId, crypto.randomUUID());
    const requestedTool = typeof body.tool === "string" ? body.tool.toUpperCase() : "AUTO";
    tool = requestedTool === "AUTO" ? inferOrbitTool(query) : requestedTool as OrbitTool;

    if (!orbitTools.includes(tool) || !query || query.length > 500) {
      return json({ error: "Enter a request under 500 characters and choose a supported tool." }, 400);
    }

    await beginOrbitRequest(sessionId, requestId, tool, query);
    await applyConfiguredDelay();
    const result = await executeOrbitTool(tool, query, request.signal);
    const committed = await commitOrbitRequest({
      sessionId,
      requestId,
      tool,
      query,
      answer: result.answer,
      meta: result.meta,
      elapsedMs: Date.now() - started,
      noteContent: result.noteContent,
      timerSeconds: result.timerSeconds,
    });

    if (!committed.committed) {
      return json({ ok: false, stale: true, error: "This request was superseded by a newer instruction.", state: committed.state }, 409);
    }

    return json({
      ok: true,
      requestId,
      tool,
      elapsedMs: Date.now() - started,
      answer: result.answer,
      meta: result.meta,
      note: committed.note,
      timer: committed.timer,
      state: committed.state,
    });
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    const message = aborted ? "Request cancelled." : error instanceof Error ? error.message : "ORBIT could not complete that request.";
    const state = await failOrbitRequest({ sessionId, requestId, tool, query, error: message, elapsedMs: Date.now() - started }).catch(() => undefined);
    return json({ ok: false, error: message, elapsedMs: Date.now() - started, state }, aborted ? 499 : 502);
  }
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null) as { sessionId?: unknown; requestId?: unknown } | null;
  const sessionId = cleanIdentifier(body?.sessionId, "anonymous");
  const requestId = cleanIdentifier(body?.requestId, "");
  if (!requestId) return json({ error: "requestId is required." }, 400);
  return json({ ok: true, state: await cancelOrbitRequest(sessionId, requestId) });
}
