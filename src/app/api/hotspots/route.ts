import { cached } from "@/lib/server/cache";
import { errorResponse, jsonResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";
import { fetchHotspots } from "@/lib/server/sources/cwfis";
import { fetchFirmsHotspots, firmsEnabled } from "@/lib/server/sources/firms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = Number(process.env.HOTSPOTS_TTL_SECONDS ?? 300) * 1000;

export async function GET(req: Request) {
  const limited = rateLimit(req, "data", 120);
  if (limited) return limited;
  try {
    const { value } = await cached("hotspots", TTL_MS, async () =>
      firmsEnabled() ? fetchFirmsHotspots() : fetchHotspots()
    );
    return jsonResponse(
      { hotspots: value, source: firmsEnabled() ? "FIRMS" : "CWFIS" },
      200,
      120
    );
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load hotspots",
      502
    );
  }
}
