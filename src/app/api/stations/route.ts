import { z } from "zod";
import { cached } from "@/lib/server/cache";
import { errorResponse, fetchUpstream, jsonResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";
import { clampBbox, roundBbox } from "@/lib/geo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  // "west,south,east,north"
  bbox: z
    .string()
    .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/),
});

interface OverpassElement {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export async function GET(req: Request) {
  const limited = rateLimit(req, "stations", 30);
  if (limited) return limited;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return errorResponse("bbox=w,s,e,n required", 400);
  const raw = parsed.data.bbox.split(",").map(Number) as [number, number, number, number];
  const [w, s, e, n] = roundBbox(clampBbox(raw), 0.25);
  if (e - w > 4 || n - s > 4) {
    return errorResponse("bbox too large; zoom in to load fire stations", 400);
  }

  try {
    const { value } = await cached(
      `stations:${w},${s},${e},${n}`,
      24 * 60 * 60 * 1000,
      async () => {
        const query = `[out:json][timeout:20];nwr["amenity"="fire_station"](${s},${w},${n},${e});out center 400;`;
        const res = await fetchUpstream("https://overpass-api.de/api/interpreter", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `data=${encodeURIComponent(query)}`,
          timeoutMs: 30000,
        });
        const data = (await res.json()) as { elements?: OverpassElement[] };
        return (data.elements ?? [])
          .map((el) => ({
            lat: el.lat ?? el.center?.lat,
            lon: el.lon ?? el.center?.lon,
            name: el.tags?.name ?? "Fire station",
          }))
          .filter((x): x is { lat: number; lon: number; name: string } =>
            Number.isFinite(x.lat) && Number.isFinite(x.lon)
          );
      }
    );
    return jsonResponse({ stations: value }, 200, 3600);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Fire station lookup failed",
      502
    );
  }
}
