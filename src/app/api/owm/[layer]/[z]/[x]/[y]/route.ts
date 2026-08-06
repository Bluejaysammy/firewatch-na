import { errorResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Optional OpenWeatherMap weather tile proxy (wind, temperature,
 * precipitation). Enabled only when OWM_API_KEY is configured; the key never
 * reaches the browser.
 */
const ALLOWED_LAYERS = new Set(["wind_new", "temp_new", "precipitation_new", "clouds_new"]);

export async function GET(
  req: Request,
  ctx: { params: Promise<{ layer: string; z: string; x: string; y: string }> }
) {
  const limited = rateLimit(req, "tiles", 240);
  if (limited) return limited;

  const key = process.env.OWM_API_KEY;
  if (!key) return errorResponse("OpenWeatherMap layers are not configured", 404);

  const { layer, z, x, y } = await ctx.params;
  const zi = Number(z), xi = Number(x), yi = Number(y);
  if (
    !ALLOWED_LAYERS.has(layer) ||
    !Number.isInteger(zi) || zi < 0 || zi > 12 ||
    !Number.isInteger(xi) || xi < 0 || xi >= 2 ** zi ||
    !Number.isInteger(yi) || yi < 0 || yi >= 2 ** zi
  ) {
    return errorResponse("Invalid tile request", 400);
  }

  try {
    const upstream = await fetch(
      `https://tile.openweathermap.org/map/${layer}/${zi}/${xi}/${yi}.png?appid=${key}`,
      { signal: AbortSignal.timeout(15000), cache: "no-store" }
    );
    if (!upstream.ok) return errorResponse("Weather tile unavailable", 502);
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=600",
      },
    });
  } catch {
    return errorResponse("Weather tile unavailable", 502);
  }
}
