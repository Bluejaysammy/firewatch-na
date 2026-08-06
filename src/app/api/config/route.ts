import { jsonResponse } from "@/lib/server/http";
import { firmsEnabled } from "@/lib/server/sources/firms";
import type { AppConfig } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config: AppConfig = {
    refreshDefaultMs: Number(process.env.REFRESH_DEFAULT_SECONDS ?? 300) * 1000,
    firmsEnabled: firmsEnabled(),
    owmEnabled: Boolean(process.env.OWM_API_KEY),
    waqiEnabled: Boolean(process.env.WAQI_TOKEN),
  };
  return jsonResponse(config, 200, 300);
}
