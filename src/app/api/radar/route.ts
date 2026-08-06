import { cached } from "@/lib/server/cache";
import { errorResponse, fetchJson, jsonResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RainViewerIndex {
  host?: string;
  radar?: { past?: { time: number; path: string }[] };
}

/** Latest RainViewer composite radar frame (tiles load directly client-side). */
export async function GET(req: Request) {
  const limited = rateLimit(req, "data", 120);
  if (limited) return limited;
  try {
    const { value } = await cached("radar", 5 * 60 * 1000, async () => {
      const d = await fetchJson<RainViewerIndex>(
        "https://api.rainviewer.com/public/weather-maps.json"
      );
      const past = d.radar?.past ?? [];
      const latest = past[past.length - 1];
      if (!latest || !d.host) throw new Error("No radar frames available");
      return { host: d.host, path: latest.path, time: latest.time };
    });
    return jsonResponse(value, 200, 120);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Radar index unavailable",
      502
    );
  }
}
