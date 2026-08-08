import {
  destroySession,
  originAllowed,
  readSessionToken,
  sessionCookie,
} from "@/lib/server/auth";
import { errorResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limited = rateLimit(req, "auth", 30);
  if (limited) return limited;
  if (!originAllowed(req)) return errorResponse("Bad origin", 403);

  const token = readSessionToken(req);
  if (token) destroySession(token);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": sessionCookie("", 0),
      "Cache-Control": "no-store",
    },
  });
}
