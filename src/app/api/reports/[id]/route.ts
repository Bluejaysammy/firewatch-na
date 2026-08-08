import { getSessionUser, originAllowed } from "@/lib/server/auth";
import { removeReport } from "@/lib/server/community";
import { errorResponse, jsonResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, "post", 30);
  if (limited) return limited;
  if (!originAllowed(req)) return errorResponse("Bad origin", 403);

  const user = getSessionUser(req);
  if (!user) return errorResponse("Sign in required", 401);

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return errorResponse("Report not found", 404);

  if (!removeReport(user, id)) {
    return errorResponse("You can only remove your own reports", 403);
  }
  return jsonResponse({ ok: true });
}
