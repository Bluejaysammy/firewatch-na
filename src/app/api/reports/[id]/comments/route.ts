import { getSessionUser, originAllowed } from "@/lib/server/auth";
import {
  addComment,
  canPostComment,
  commentSchema,
  listComments,
  reportExists,
} from "@/lib/server/community";
import { errorResponse, jsonResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, "data", 120);
  if (limited) return limited;
  const id = parseId((await ctx.params).id);
  if (!id || !reportExists(id)) return errorResponse("Report not found", 404);
  return jsonResponse({ comments: listComments(id) });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, "post", 30);
  if (limited) return limited;
  if (!originAllowed(req)) return errorResponse("Bad origin", 403);

  const user = getSessionUser(req);
  if (!user) return errorResponse("Sign in to comment", 401);
  if (!canPostComment(user.id)) {
    return errorResponse("Comment limit reached (30 per hour)", 429);
  }

  const id = parseId((await ctx.params).id);
  if (!id || !reportExists(id)) return errorResponse("Report not found", 404);

  const parsed = commentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse("Comments must be 1–500 characters", 400);

  return jsonResponse({ comment: addComment(user, id, parsed.data.body) }, 201);
}
