import { getGroupBalances } from "./services.js";
import type { Db } from "./db.js";

type GroupBalances = Awaited<ReturnType<typeof getGroupBalances>>;

const balanceCache = new Map<string, { data: GroupBalances; computedAt: number }>();
const inFlight = new Map<string, Promise<GroupBalances>>();
const CACHE_TTL_MS = 60_000;

const metrics = {
  hits: 0,
  misses: 0,
  coalesced: 0,
  invalidations: 0,
  computeDurationMs: 0,
};

export function invalidateBalanceCache(groupId: string): void {
  balanceCache.delete(groupId);
  inFlight.delete(groupId);
  metrics.invalidations++;
}

export async function getCachedBalances(db: Db, groupId: string): Promise<GroupBalances> {
  const hit = balanceCache.get(groupId);
  if (hit && Date.now() - hit.computedAt < CACHE_TTL_MS) {
    metrics.hits++;
    return hit.data;
  }

  metrics.misses++;
  const existing = inFlight.get(groupId);
  if (existing) {
    metrics.coalesced++;
    return existing;
  }

  const start = Date.now();
  const promise = (async () => {
    try {
      const data = await getGroupBalances(db, groupId);
      metrics.computeDurationMs += Date.now() - start;
      balanceCache.set(groupId, { data, computedAt: Date.now() });
      return data;
    } finally {
      inFlight.delete(groupId);
    }
  })();

  inFlight.set(groupId, promise);
  return promise;
}

export function getBalanceCacheMetrics() {
  const total = metrics.hits + metrics.misses;
  return {
    hits: metrics.hits,
    misses: metrics.misses,
    coalesced: metrics.coalesced,
    invalidations: metrics.invalidations,
    computeDurationMs: metrics.computeDurationMs,
    hitRate: total > 0 ? metrics.hits / total : 0,
    size: balanceCache.size,
    inFlight: inFlight.size,
  };
}

export function resetBalanceCacheMetrics() {
  metrics.hits = 0;
  metrics.misses = 0;
  metrics.coalesced = 0;
  metrics.invalidations = 0;
  metrics.computeDurationMs = 0;
}