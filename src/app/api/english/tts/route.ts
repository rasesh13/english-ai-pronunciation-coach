import { callFastApi, forwardFastApi } from "@/server/fastapi-client";

export async function POST(request: Request) {
  const body = await request.text();
  return forwardFastApi(await callFastApi("/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: request.signal }));
}
