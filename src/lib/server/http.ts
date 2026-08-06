import "server-only";

const UA =
  process.env.UPSTREAM_USER_AGENT ??
  "FireWatch-NA/1.0 (open-source wildfire dashboard; contact via repository)";

export async function fetchUpstream(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 25000, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: { "User-Agent": UA, ...(rest.headers ?? {}) },
    signal: AbortSignal.timeout(timeoutMs),
    // Route handlers must not let Next's fetch cache mask our TTL logic.
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Upstream ${res.status} from ${new URL(url).host}`);
  }
  return res;
}

export async function fetchJson<T>(url: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const res = await fetchUpstream(url, init);
  return (await res.json()) as T;
}

export async function fetchText(url: string, init?: RequestInit & { timeoutMs?: number }): Promise<string> {
  const res = await fetchUpstream(url, init);
  return await res.text();
}

export function jsonResponse(body: unknown, status = 200, cacheSeconds = 0): Response {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cacheSeconds > 0) {
    headers["Cache-Control"] = `public, max-age=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`;
  } else {
    headers["Cache-Control"] = "no-store";
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}
