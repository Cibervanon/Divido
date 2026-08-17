const balanceCache = new Map<string, { data: any; computedAt: number }>();
const CACHE_TTL_MS = 60_000; // 1 minuto

export function invalidateBalanceCache(groupId: string): void {
  balanceCache.delete(groupId);
}

export async function getCachedBalances(db: any, groupId: string) {
  const hit = balanceCache.get(groupId);
  if (hit && Date.now() - hit.computedAt < CACHE_TTL_MS) {
    return hit.data;
  }
  
  const { getGroupBalances } = await import("./services.js");
  const data = await getGroupBalances(db, groupId);
  
  balanceCache.set(groupId, { data, computedAt: Date.now() });
  return data;
}