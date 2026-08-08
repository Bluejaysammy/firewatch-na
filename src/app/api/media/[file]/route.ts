import fs from "node:fs";
import path from "node:path";
import { UPLOADS_DIR } from "@/lib/server/db";
import { errorResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Serves community photos. Names are server-generated UUIDs only. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ file: string }> }
) {
  const limited = rateLimit(req, "tiles", 240);
  if (limited) return limited;

  const { file } = await ctx.params;
  if (!/^[a-f0-9][a-f0-9-]{10,40}\.jpg$/.test(file)) {
    return errorResponse("Not found", 404);
  }
  const full = path.join(UPLOADS_DIR, file);
  if (!full.startsWith(UPLOADS_DIR) || !fs.existsSync(full)) {
    return errorResponse("Not found", 404);
  }
  const data = fs.readFileSync(full);
  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
