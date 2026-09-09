import { completeOrbitTimer, deleteOrbitResource, getOrbitState } from "@/server/orbit-store";

function json(data: object, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function cleanIdentifier(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) : "";
}

export async function GET(request: Request) {
  const sessionId = cleanIdentifier(new URL(request.url).searchParams.get("sessionId")) || "anonymous";
  return json({ ok: true, state: await getOrbitState(sessionId) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { sessionId?: unknown; resource?: unknown; action?: unknown; id?: unknown } | null;
  const sessionId = cleanIdentifier(body?.sessionId) || "anonymous";
  const id = cleanIdentifier(body?.id);
  if (body?.resource !== "timer" || body.action !== "complete" || !id) return json({ error: "A valid timer completion request is required." }, 400);
  return json({ ok: true, state: await completeOrbitTimer(sessionId, id) });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null) as { sessionId?: unknown; resource?: unknown; id?: unknown } | null;
  const sessionId = cleanIdentifier(body?.sessionId) || "anonymous";
  const id = cleanIdentifier(body?.id) || undefined;
  if (body?.resource !== "note" && body?.resource !== "timer" && body?.resource !== "history") return json({ error: "Choose note, timer, or history." }, 400);
  if (body.resource !== "history" && !id) return json({ error: "id is required." }, 400);
  return json({ ok: true, state: await deleteOrbitResource(sessionId, body.resource, id) });
}
