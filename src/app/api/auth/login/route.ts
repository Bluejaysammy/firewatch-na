import { z } from "zod";
import {
  checkCredentials,
  createSession,
  originAllowed,
  sessionCookie,
} from "@/lib/server/auth";
import { errorResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
});

export async function POST(req: Request) {
  const limited = rateLimit(req, "auth", 10);
  if (limited) return limited;
  if (!originAllowed(req)) return errorResponse("Bad origin", 403);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid input", 400);

  const user = checkCredentials(parsed.data.username, parsed.data.password);
  if (!user) return errorResponse("Incorrect username or password", 401);

  const token = createSession(user.id);
  return new Response(
    JSON.stringify({ user: { username: user.username, role: user.role } }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": sessionCookie(token),
        "Cache-Control": "no-store",
      },
    }
  );
}
