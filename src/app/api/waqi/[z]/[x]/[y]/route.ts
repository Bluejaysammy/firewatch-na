import { errorResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Optional World Air Quality Index (waqi.info) AQI tile proxy. Enabled only
 * when WAQI_TOKEN is configured; the token never reaches the browser.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ z: string; x: string; y: string }> }
) {
  const limited = rateLimit(req, "tiles", 240);
  if (limited) return limited;

  const token = process.env.WAQI_TOKEN;
  if (!token) return errorResponse("AQI tile layer is not configured", 404);

  const { z, x, y } = await ctx.params;
  const zi = Number(z), xi = Number(x), yi = Number(y);
  if (
    !Number.isInteger(zi) || zi < 0 || zi > 12 ||
    !Number.isInteger(xi) || xi < 0 || xi >= 2 ** zi ||
    !Number.isInteger(yi) || yi < 0 || yi >= 2 ** zi
  ) {
    return errorResponse("Invalid tile request", 400);
  }

  try {
    const upstream = await fetch(
      `https://tiles.aqicn.org/tiles/usepa-aqi/${zi}/${xi}/${yi}.png?token=${token}`,
      { signal: AbortSignal.timeout(15000), cache: "no-store" }
    );
    if (!upstream.ok) return errorResponse("AQI tile unavailable", 502);
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=600",
      },
    });
  } catch {
    return errorResponse("AQI tile unavailable", 502);
  }
}
