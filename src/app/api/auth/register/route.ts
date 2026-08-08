import { z } from "zod";
import {
  createSession,
  createUser,
  originAllowed,
  sessionCookie,
  PASSWORD_MAX,
  PASSWORD_MIN,
  USERNAME_RE,
} from "@/lib/server/auth";
import { errorResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  username: z.string().toLowerCase().regex(USERNAME_RE, "3–24 chars: a-z, 0-9, - or _"),
  password: z.string().min(PASSWORD_MIN, `at least ${PASSWORD_MIN} characters`).max(PASSWORD_MAX),
});

export async function POST(req: Request) {
  const limited = rateLimit(req, "register", 5);
  if (limited) return limited;
  if (!originAllowed(req)) return errorResponse("Bad origin", 403);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const user = createUser(parsed.data.username, parsed.data.password);
  if (user === "taken") return errorResponse("That username is taken", 409);

  const token = createSession(user.id);
  return new Response(
    JSON.stringify({ user: { username: user.username, role: user.role } }),
    {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": sessionCookie(token),
        "Cache-Control": "no-store",
      },
    }
  );
}
