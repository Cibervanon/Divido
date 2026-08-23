import type { Db } from "./db.js";

type CacheEntry<T> = { data: T; computedAt: number };
const caches = new Map<string, Map<string, CacheEntry<unknown>>>();
const inFlight = new Map<string, Map<string, Promise<unknown>>>();
const DEFAULT_TTL_MS = 60_000;

function isTestEnv(): boolean {
  return process.env.VITEST === "true" || process.env.NODE_ENV === "test";
}

function getCache(name: string): Map<string, CacheEntry<unknown>> {
  let cache = caches.get(name);
  if (!cache) {
    cache = new Map();
    caches.set(name, cache);
  }
  return cache;
}

function getInFlight(name: string): Map<string, Promise<unknown>> {
  let map = inFlight.get(name);
  if (!map) {
    map = new Map();
    inFlight.set(name, map);
  }
  return map;
}

export function invalidateCache(name: string, key: string): void {
  getCache(name).delete(key);
  getInFlight(name).delete(key);
}

export function invalidateAllCache(name: string, groupId: string): void {
  if (isTestEnv()) return;
  const cache = caches.get(name);
  if (cache) {
    for (const key of cache.keys()) {
      if (key.startsWith(`${groupId}:`)) cache.delete(key);
    }
  }
  const flight = inFlight.get(name);
  if (flight) {
    for (const key of flight.keys()) {
      if (key.startsWith(`${groupId}:`)) flight.delete(key);
    }
  }
}

export async function getCached<T>(
  name: string,
  key: string,
  compute: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS
): Promise<T> {
  if (isTestEnv()) return compute();

  const cache = getCache(name);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.computedAt < ttlMs) {
    return hit.data as T;
  }

  const flight = getInFlight(name);
  const existing = flight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = (async () => {
    try {
      const data = await compute();
      cache.set(key, { data, computedAt: Date.now() });
      return data;
    } finally {
      flight.delete(key);
    }
  })();

  flight.set(key, promise);
  return promise as Promise<T>;
}

export function getCacheStats(): Record<string, { size: number; inFlight: number }> {
  const result: Record<string, { size: number; inFlight: number }> = {};
  for (const [name, cache] of caches) {
    result[name] = { size: cache.size, inFlight: (inFlight.get(name)?.size ?? 0) };
  }
  return result;
}