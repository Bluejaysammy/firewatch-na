import { getSessionUser } from "@/lib/server/auth";
import { jsonResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = rateLimit(req, "data", 120);
  if (limited) return limited;
  const user = getSessionUser(req);
  return jsonResponse({
    user: user ? { username: user.username, role: user.role } : null,
  });
}
