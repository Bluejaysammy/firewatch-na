import { cachePeek } from "@/lib/server/cache";
import { jsonResponse } from "@/lib/server/http";
import type { FiresResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const fires = cachePeek<FiresResponse>("fires");
  return jsonResponse({
    status: "ok",
    uptimeSeconds: Math.round(process.uptime()),
    firesCached: fires ? fires.fires.length : 0,
    firesFetchedAt: fires?.fetchedAt ?? null,
  });
}
