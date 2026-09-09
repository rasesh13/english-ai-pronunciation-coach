import { callFastApi, forwardFastApi } from "@/server/fastapi-client";

export async function POST(request: Request) {
  const formData = await request.formData();
  return forwardFastApi(await callFastApi("/evaluate", { method: "POST", body: formData, signal: request.signal }));
}
