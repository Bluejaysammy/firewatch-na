import { z } from "zod";
import { cached } from "@/lib/server/cache";
import { errorResponse, fetchJson, jsonResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";
import type { GeocodeResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({ q: z.string().trim().min(2).max(120) });

interface NominatimRow {
  display_name?: string;
  lat?: string;
  lon?: string;
  type?: string;
  addresstype?: string;
}

// Nominatim usage policy: absolute maximum 1 request/second.
let lastCall = 0;
async function politeDelay() {
  const wait = lastCall + 1100 - Date.now();
  lastCall = Math.max(Date.now(), lastCall + 1100);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

export async function GET(req: Request) {
  const limited = rateLimit(req, "geocode", 30);
  if (limited) return limited;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return errorResponse("Invalid query", 400);
  const q = parsed.data.q;

  try {
    const { value } = await cached(`geocode:${q.toLowerCase()}`, 60 * 60 * 1000, async () => {
      await politeDelay();
      const rows = await fetchJson<NominatimRow[]>(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=ca,us,mx&q=${encodeURIComponent(q)}`
      );
      const results: GeocodeResult[] = [];
      for (const r of rows) {
        const lat = Number(r.lat);
        const lon = Number(r.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || !r.display_name) continue;
        results.push({
          label: r.display_name,
          lat,
          lon,
          type: r.addresstype ?? r.type ?? "place",
        });
      }
      return results;
    });
    return jsonResponse({ results: value }, 200, 3600);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Geocoding failed",
      502
    );
  }
}
