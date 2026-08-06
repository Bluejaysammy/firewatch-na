import { z } from "zod";
import { cached } from "@/lib/server/cache";
import { errorResponse, jsonResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";
import { fetchUsPerimeters } from "@/lib/server/sources/wfigs";
import { fetchCaPerimeters } from "@/lib/server/sources/cwfis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = Number(process.env.PERIMETERS_TTL_SECONDS ?? 300) * 1000;

const querySchema = z.object({ country: z.enum(["us", "ca"]) });

export async function GET(req: Request) {
  const limited = rateLimit(req, "data", 120);
  if (limited) return limited;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return errorResponse("country must be 'us' or 'ca'", 400);
  }
  try {
    const { value } = await cached(
      `perimeters:${parsed.data.country}`,
      TTL_MS,
      parsed.data.country === "us" ? fetchUsPerimeters : fetchCaPerimeters
    );
    return jsonResponse(value, 200, 120);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load perimeters",
      502
    );
  }
}
