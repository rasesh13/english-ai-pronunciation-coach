import { getOrbitState } from "@/server/orbit-store";
import { orbitTools } from "@/server/orbit-tools";

export async function GET() {
  const state = await getOrbitState();
  return Response.json({
    status: "ok",
    service: "ORBIT backend",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    persistence: { driver: "json-file", ready: true },
    providers: { rime: Boolean(process.env.RIME_API_KEY) },
    tools: orbitTools,
    stats: state.stats,
  }, { headers: { "Cache-Control": "no-store" } });
}
