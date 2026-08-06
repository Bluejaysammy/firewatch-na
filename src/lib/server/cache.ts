import "server-only";

interface Entry<T> {
  value: T;
  fetchedAt: number;
  ttlMs: number;
}

/**
 * In-memory TTL cache with stale-while-error semantics: when an upstream
 * refresh fails and a stale value exists, the stale value is served (up to
 * maxStaleMs) instead of surfacing the error to every client.
 *
 * Survives dev-mode HMR via globalThis. For multi-instance deployments put a
 * shared cache (e.g. Redis) behind the same interface — see README.
 */
const store: Map<string, Entry<unknown>> = ((globalThis as Record<string, unknown>)
  .__firewatchCache as Map<string, Entry<unknown>>) ?? new Map();
(globalThis as Record<string, unknown>).__firewatchCache = store;

const inflight: Map<string, Promise<unknown>> = ((globalThis as Record<string, unknown>)
  .__firewatchInflight as Map<string, Promise<unknown>>) ?? new Map();
(globalThis as Record<string, unknown>).__firewatchInflight = inflight;

export interface CachedResult<T> {
  value: T;
  fetchedAt: number;
  stale: boolean;
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  maxStaleMs = 6 * 60 * 60 * 1000
): Promise<CachedResult<T>> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && now - hit.fetchedAt < hit.ttlMs) {
    return { value: hit.value, fetchedAt: hit.fetchedAt, stale: false };
  }

  const existing = inflight.get(key) as Promise<CachedResult<T>> | undefined;
  if (existing) return existing;

  const p = (async (): Promise<CachedResult<T>> => {
    try {
      const value = await fetcher();
      const fetchedAt = Date.now();
      store.set(key, { value, fetchedAt, ttlMs });
      return { value, fetchedAt, stale: false };
    } catch (err) {
      if (hit && now - hit.fetchedAt < maxStaleMs) {
        return { value: hit.value, fetchedAt: hit.fetchedAt, stale: true };
      }
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

export function cachePeek<T>(key: string): T | undefined {
  return (store.get(key) as Entry<T> | undefined)?.value;
}

/** Simple pub/sub used by the SSE stream to announce data refreshes. */
type Listener = (event: string, data: string) => void;
const listeners: Set<Listener> = ((globalThis as Record<string, unknown>)
  .__firewatchListeners as Set<Listener>) ?? new Set();
(globalThis as Record<string, unknown>).__firewatchListeners = listeners;

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function broadcast(event: string, data: string): void {
  for (const fn of listeners) {
    try {
      fn(event, data);
    } catch {
      listeners.delete(fn);
    }
  }
}
