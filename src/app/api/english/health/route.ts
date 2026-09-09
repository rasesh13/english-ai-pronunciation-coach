import { callFastApi, forwardFastApi } from "@/server/fastapi-client";

export async function GET() {
  return forwardFastApi(await callFastApi("/health"));
}
