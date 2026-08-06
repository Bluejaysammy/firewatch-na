import { getClosures } from "@/lib/server/sources/closures";
import { errorResponse, jsonResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = rateLimit(req, "data", 120);
  if (limited) return limited;
  try {
    const { value, stale } = await getClosures();
    return jsonResponse({ ...value, stale }, 200, 60);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load road closures",
      502
    );
  }
}
