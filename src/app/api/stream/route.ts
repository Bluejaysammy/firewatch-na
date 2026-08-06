import { subscribe } from "@/lib/server/cache";
import { getFires, FIRES_TTL_MS } from "@/lib/server/fires";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream. Emits a `fires` event each time the server-side
 * fire cache is refreshed, so connected clients can refetch immediately
 * instead of waiting for their polling interval. A background refresh loop
 * keeps the cache warm while at least one client is connected.
 */
declare global {
  var __firewatchRefreshLoop: ReturnType<typeof setInterval> | undefined;
  var __firewatchStreamClients: number | undefined;
}

function ensureRefreshLoop() {
  if (globalThis.__firewatchRefreshLoop) return;
  globalThis.__firewatchRefreshLoop = setInterval(() => {
    if ((globalThis.__firewatchStreamClients ?? 0) > 0) {
      getFires().catch(() => {});
    }
  }, Math.max(FIRES_TTL_MS, 60_000));
}

export async function GET(req: Request) {
  const limited = rateLimit(req, "stream", 20);
  if (limited) return limited;

  ensureRefreshLoop();
  globalThis.__firewatchStreamClients = (globalThis.__firewatchStreamClients ?? 0) + 1;

  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: string) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
        } catch {
          /* stream already closed */
        }
      };
      send("hello", JSON.stringify({ connectedAt: new Date().toISOString() }));
      unsubscribe = subscribe(send);
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* stream already closed */
        }
      }, 25000);
    },
    cancel() {
      unsubscribe();
      if (heartbeat) clearInterval(heartbeat);
      globalThis.__firewatchStreamClients = Math.max(
        0,
        (globalThis.__firewatchStreamClients ?? 1) - 1
      );
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
