import { z } from "zod";
import { getFires } from "@/lib/server/fires";
import { errorResponse, jsonResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";
import type { Country, FireStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  country: z
    .string()
    .regex(/^(CA|US|MX)(,(CA|US|MX))*$/i)
    .optional(),
  status: z
    .string()
    .regex(/^[a-z_]+(,[a-z_]+)*$/i)
    .optional(),
  minSizeHa: z.coerce.number().min(0).max(10_000_000).optional(),
  admin: z
    .string()
    .regex(/^[A-Za-z-]{2,8}(,[A-Za-z-]{2,8})*$/)
    .optional(),
  since: z.string().datetime({ offset: true }).optional(),
});

export async function GET(req: Request) {
  const limited = rateLimit(req, "data", 120);
  if (limited) return limited;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return errorResponse("Invalid query parameters", 400);
  }
  const q = parsed.data;

  try {
    const { value, stale } = await getFires();
    let fires = value.fires;
    if (q.country) {
      const set = new Set(q.country.toUpperCase().split(",") as Country[]);
      fires = fires.filter((f) => set.has(f.country));
    }
    if (q.status) {
      const set = new Set(q.status.toLowerCase().split(",") as FireStatus[]);
      fires = fires.filter((f) => set.has(f.status));
    }
    if (q.minSizeHa !== undefined) {
      fires = fires.filter((f) => (f.sizeHa ?? 0) >= q.minSizeHa!);
    }
    if (q.admin) {
      const set = new Set(q.admin.toUpperCase().split(","));
      fires = fires.filter((f) => set.has(f.admin.toUpperCase()));
    }
    if (q.since) {
      fires = fires.filter((f) => f.updated !== null && f.updated >= q.since!);
    }
    return jsonResponse(
      { ...value, fires, stale },
      200,
      30
    );
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load fire data",
      502
    );
  }
}
