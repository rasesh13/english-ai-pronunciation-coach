import { callFastApi, forwardFastApi } from "@/server/fastapi-client";

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId") || "anonymous";
  return forwardFastApi(await callFastApi(`/state?session_id=${encodeURIComponent(sessionId)}`));
}

export async function DELETE(request: Request) {
  const body = await request.text();
  return forwardFastApi(await callFastApi("/state", { method: "DELETE", headers: { "Content-Type": "application/json" }, body }));
}
