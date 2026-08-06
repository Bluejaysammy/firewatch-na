import { computeStats, getFires } from "@/lib/server/fires";
import { errorResponse, jsonResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = rateLimit(req, "data", 120);
  if (limited) return limited;
  try {
    const { value } = await getFires();
    return jsonResponse(computeStats(value), 200, 30);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to compute stats",
      502
    );
  }
}
