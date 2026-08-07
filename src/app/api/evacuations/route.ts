import { getEvacZones } from "@/lib/server/sources/evac";
import { errorResponse, jsonResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Canadian evacuation orders/alerts as GeoJSON (plus source health). */
export async function GET(req: Request) {
  const limited = rateLimit(req, "data", 120);
  if (limited) return limited;
  try {
    const { value, stale } = await getEvacZones();
    return jsonResponse(
      {
        type: "FeatureCollection",
        features: value.zones.map((z) => ({
          type: "Feature",
          id: z.id,
          geometry: z.geometry,
          properties: {
            name: z.name,
            status: z.status,
            eventType: z.eventType,
            agency: z.agency,
            sourceLabel: z.sourceLabel,
            updated: z.updated,
          },
        })),
        sources: value.sources,
        stale,
      },
      200,
      120
    );
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load evacuation zones",
      502
    );
  }
}
