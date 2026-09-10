import "server-only";

const fastApiUrl = (process.env.FASTAPI_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export async function callFastApi(pathname: string, init?: RequestInit) {
  try {
    return await fetch(`${fastApiUrl}${pathname}`, {
      ...init,
      cache: "no-store",
      signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(50_000)]) : AbortSignal.timeout(50_000),
    });
  } catch {
    return Response.json({ detail: "The EnglishAI FastAPI service is unavailable." }, { status: 503 });
  }
}

export async function forwardFastApi(response: Response) {
  const headers = new Headers({ "Cache-Control": "no-store" });
  for (const name of ["content-type", "x-englishai-speed", "x-voice-provider", "x-rime-model", "x-rime-speaker", "x-rime-language"]) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(response.body, { status: response.status, headers });
}
