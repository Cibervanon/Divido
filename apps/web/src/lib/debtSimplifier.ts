import { round2, simplifyDebts as sharedSimplifyDebts } from "@divido/shared";

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
  // Delegate to the proven, tested algorithm in @divido/shared (the same one the
  // backend uses). The local duplicate was buggy: it stopped as soon as a debtor
  // was exhausted instead of advancing, leaving creditors unrepaid and doubling
  // debts when re-applied on top of net balances.
  return sharedSimplifyDebts(
    balances.map((b) => ({
      userId: b.userId,
      name: b.name,
      net: round2(b.net),
      paidForOthers: 0,
      owesOthers: 0,
    }))
  ).map((t) => ({ ...t, reason: "Saldo" }));
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

  // balances[].net YA es el balance final correcto (incluye gastos y pagos), no
  // se re-aplica nada encima: los rawTransfers son un desglose de esos mismos
  // datos, así que restarlos/sumarlos aquí duplicaría cada deuda.
  const nodes = balances.map((b) => ({ userId: b.userId, name: b.name, net: round2(b.net) }));
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
