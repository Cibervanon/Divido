import { getGroupBalances } from "./services.js";
import type { Db } from "./db.js";

type GroupBalances = Awaited<ReturnType<typeof getGroupBalances>>;

const balanceCache = new Map<string, { data: GroupBalances; computedAt: number }>();
const CACHE_TTL_MS = 60_000;

export function invalidateBalanceCache(groupId: string): void {
  balanceCache.delete(groupId);
}

export async function getCachedBalances(db: Db, groupId: string): Promise<GroupBalances> {
  const hit = balanceCache.get(groupId);
  if (hit && Date.now() - hit.computedAt < CACHE_TTL_MS) {
    return hit.data;
  }

  const data = await getGroupBalances(db, groupId);
  balanceCache.set(groupId, { data, computedAt: Date.now() });
  return data;
}