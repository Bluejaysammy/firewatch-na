import { getAffectedRoads } from "@/lib/server/sources/roads";
import { errorResponse, jsonResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = rateLimit(req, "data", 120);
  if (limited) return limited;
  try {
    const { value, stale } = await getAffectedRoads();
    return jsonResponse({ ...value, stale }, 200, 120);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to compute affected roads",
      502
    );
  }
}
