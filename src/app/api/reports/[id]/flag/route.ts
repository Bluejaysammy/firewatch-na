import { getSessionUser, originAllowed } from "@/lib/server/auth";
import { flagReport, reportExists } from "@/lib/server/community";
import { errorResponse, jsonResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, "post", 30);
  if (limited) return limited;
  if (!originAllowed(req)) return errorResponse("Bad origin", 403);

  const user = getSessionUser(req);
  if (!user) return errorResponse("Sign in to flag a report", 401);

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0 || !reportExists(id)) {
    return errorResponse("Report not found", 404);
  }
  const flags = flagReport(user.id, id);
  return jsonResponse({ ok: true, flags });
}
