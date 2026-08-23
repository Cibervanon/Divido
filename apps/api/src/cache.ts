import type { Db } from "./db.js";

type CacheEntry<T> = { data: T; computedAt: number };
const caches = new Map<string, Map<string, CacheEntry<unknown>>>();
const inFlight = new Map<string, Map<string, Promise<unknown>>>();
const DEFAULT_TTL_MS = 60_000;

const metrics = new Map<string, {
  hits: number;
  misses: number;
  coalesced: number;
  invalidations: number;
  computeDurationMs: number;
}>();

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

function getMetrics(name: string) {
  let m = metrics.get(name);
  if (!m) {
    m = { hits: 0, misses: 0, coalesced: 0, invalidations: 0, computeDurationMs: 0 };
    metrics.set(name, m);
  }
  return m;
}

export function invalidateCache(name: string, key: string): void {
  getCache(name).delete(key);
  getInFlight(name).delete(key);
}

export function invalidateAllCache(name: string, groupId: string): void {
  if (isTestEnv()) return;
  const cache = caches.get(name);
  if (cache) {
    let count = 0;
    for (const key of cache.keys()) {
      if (key.startsWith(`${groupId}:`)) {
        cache.delete(key);
        count++;
      }
    }
    if (count > 0) getMetrics(name).invalidations += count;
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
  const m = getMetrics(name);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.computedAt < ttlMs) {
    m.hits++;
    return hit.data as T;
  }

  m.misses++;
  const flight = getInFlight(name);
  const existing = flight.get(key);
  if (existing) {
    m.coalesced++;
    return existing as Promise<T>;
  }

  const start = Date.now();
  const promise = (async () => {
    try {
      const data = await compute();
      m.computeDurationMs += Date.now() - start;
      cache.set(key, { data, computedAt: Date.now() });
      return data;
    } finally {
      flight.delete(key);
    }
  })();

  flight.set(key, promise);
  return promise as Promise<T>;
}

export function getCacheMetrics(): Record<string, {
  hits: number;
  misses: number;
  coalesced: number;
  invalidations: number;
  computeDurationMs: number;
  hitRate: number;
  size: number;
  inFlight: number;
}> {
  const result: Record<string, any> = {};
  for (const [name, cache] of caches) {
    const m = metrics.get(name) ?? { hits: 0, misses: 0, coalesced: 0, invalidations: 0, computeDurationMs: 0 };
    const total = m.hits + m.misses;
    result[name] = {
      hits: m.hits,
      misses: m.misses,
      coalesced: m.coalesced,
      invalidations: m.invalidations,
      computeDurationMs: m.computeDurationMs,
      hitRate: total > 0 ? m.hits / total : 0,
      size: cache.size,
      inFlight: (inFlight.get(name)?.size ?? 0),
    };
  }
  return result;
}

export function resetCacheMetrics(): void {
  metrics.clear();
}