import { NextResponse } from "next/server";

const rimeConfig = {
  model: process.env.RIME_MODEL || "coda",
  voice: process.env.RIME_VOICE || "astra",
  language: process.env.RIME_LANGUAGE || "en-US",
};

export async function GET() {
  return NextResponse.json({
    configured: Boolean(process.env.RIME_API_KEY),
    provider: "Rime",
    ...rimeConfig,
  });
}

export async function POST(request: Request) {
  if (!process.env.RIME_API_KEY) {
    return NextResponse.json({ configured: false, error: "RIME_API_KEY is not configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 1200) {
    return NextResponse.json({ error: "text must be between 1 and 1200 characters" }, { status: 400 });
  }

  let response: Response;
  try {
    response = await fetch(process.env.RIME_ENDPOINT || "https://users.rime.ai/v1/rime-tts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RIME_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({ speaker: rimeConfig.voice, text, modelId: rimeConfig.model, lang: rimeConfig.language }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return NextResponse.json({ configured: true, error: "Rime is temporarily unavailable" }, { status: 502 });
  }

  if (!response.ok) {
    return NextResponse.json({ configured: true, error: `Rime API returned ${response.status}` }, { status: 502 });
  }

  return new Response(response.body, {
    headers: { "Content-Type": response.headers.get("content-type") || "audio/mpeg", "Cache-Control": "no-store" },
  });
}
