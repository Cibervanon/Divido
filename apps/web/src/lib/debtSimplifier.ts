import { round2 } from "@divido/shared";

export interface SimplifiedTransfer {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amount: number;
  reason: string;
}

export interface SimplifiedDebt {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  originalAmount: number;
  newAmount: number;
  reason: string;
}

export interface SimplifyResult {
  originalCount: number;
  changedCount: number;
  transfers: SimplifiedTransfer[];
  debts: SimplifiedDebt[];
}

interface Debt {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amount: number;
  reason?: string;
}

function buildTransfers(
  balances: Array<{ userId: string; name: string; net: number }>
): SimplifiedTransfer[] {
  const debtors = balances
    .filter((b) => b.net < -0.005)
    .map((b) => ({ ...b, amount: round2(-b.net) }))
    .sort((a, b) => b.amount - a.amount);
  const creditors = balances
    .filter((b) => b.net > 0.005)
    .map((b) => ({ ...b, amount: round2(b.net) }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: SimplifiedTransfer[] = [];
  let di = 0;
  let ci = 0;
  while (di < debtors.length && ci < creditors.length) {
    const amount = Math.min(round2(debtors[di].amount), round2(creditors[ci].amount));
    if (amount < 0.005) break;
    transfers.push({
      fromUserId: debtors[di].userId,
      fromName: debtors[di].name,
      toUserId: creditors[ci].userId,
      toName: creditors[ci].name,
      amount,
      reason: "Saldo",
    });
    debtors[di].amount = round2(debtors[di].amount - amount);
    creditors[ci].amount = round2(creditors[ci].amount - amount);
  }
  return transfers;
}

export function simplifyDebts(
  originalDebts: Debt[],
  balances: Array<{ userId: string; name: string; net: number }>
): SimplifyResult {
  const nameById = new Map(balances.map((b) => [b.userId, b.name]));
  const debts = originalDebts.map((d) => ({
    fromUserId: d.fromUserId,
    fromName: nameById.get(d.fromUserId) ?? d.fromName,
    toUserId: d.toUserId,
    toName: nameById.get(d.toUserId) ?? d.toName,
    amount: round2(d.amount),
    reason: d.reason ?? "",
  }));

  const finalBalance = new Map<string, number>(balances.map((b) => [b.userId, round2(b.net)]));
  for (const d of debts) {
    finalBalance.set(d.fromUserId, round2((finalBalance.get(d.fromUserId) ?? 0) - d.amount));
    finalBalance.set(d.toUserId, round2((finalBalance.get(d.toUserId) ?? 0) + d.amount));
  }
  for (const d of debts) {
    if (!finalBalance.has(d.fromUserId)) finalBalance.set(d.fromUserId, 0);
    if (!finalBalance.has(d.toUserId)) finalBalance.set(d.toUserId, 0);
  }

  const nodes: Array<{ userId: string; name: string; net: number }> = [];
  for (const [userId, net] of finalBalance) {
    nodes.push({ userId, name: nameById.get(userId) ?? userId, net });
  }

  const transfers = buildTransfers(nodes);

  const consumable = transfers.map((t) => ({ ...t }));

  const result: SimplifiedDebt[] = [];
  for (const d of debts) {
    let remaining = d.amount;
    for (const s of consumable) {
      if (s.fromUserId !== d.fromUserId || s.toUserId !== d.toUserId) continue;
      const applied = Math.min(remaining, round2(s.amount));
      if (applied < 0.005) continue;
      s.amount = round2(s.amount - applied);
      remaining = round2(remaining - applied);
    }
    result.push({
      fromUserId: d.fromUserId,
      fromName: d.fromName,
      toUserId: d.toUserId,
      toName: d.toName,
      originalAmount: d.amount,
      newAmount: remaining,
      reason: d.reason,
    });
  }

  return {
    originalCount: debts.length,
    changedCount: result.filter((r) => round2(r.newAmount) < r.originalAmount - 0.005).length,
    transfers,
    debts: result,
  };
}
