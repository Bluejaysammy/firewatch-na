import { z } from "zod";
import { errorResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxy for the NOAA NDGD near-surface smoke forecast (ImageServer
 * exportImage). Proxied so the browser only talks to our origin and so the
 * upstream URL/params stay validated server-side.
 */
const SMOKE_URL =
  "https://mapservices.weather.noaa.gov/raster/rest/services/air_quality/ndgd_smoke_sfc_1hr_avg_time/ImageServer/exportImage";

const querySchema = z.object({
  bbox: z
    .string()
    .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/),
  width: z.coerce.number().int().min(64).max(2048),
  height: z.coerce.number().int().min(64).max(2048),
});

export async function GET(req: Request) {
  const limited = rateLimit(req, "tiles", 240);
  if (limited) return limited;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return errorResponse("bbox, width, height required", 400);
  const { bbox, width, height } = parsed.data;

  try {
    const upstream = await fetch(
      `${SMOKE_URL}?f=image&bbox=${encodeURIComponent(bbox)}&bboxSR=4326&imageSR=3857` +
        `&size=${width},${height}&format=png&transparent=true`,
      { signal: AbortSignal.timeout(25000), cache: "no-store" }
    );
    if (!upstream.ok) return errorResponse("Smoke service unavailable", 502);
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=120",
      },
    });
  } catch {
    return errorResponse("Smoke service unavailable", 502);
  }
}
