import { getCameras } from "@/lib/server/sources/closures";
import { errorResponse, jsonResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Highway cameras (511 feeds) within ~60 km of an active fire. */
export async function GET(req: Request) {
  const limited = rateLimit(req, "data", 120);
  if (limited) return limited;
  try {
    const { value, stale } = await getCameras();
    return jsonResponse({ ...value, stale }, 200, 300);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load highway cameras",
      502
    );
  }
}
