import type { SettlementTransfer } from "./types.js";

export const EPS = 0.004;

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface BalanceInput {
  memberIds: string[];
  names: Record<string, string>;
  expenses: Array<{
    payerId: string;
    amountGroup: number;
    participants: string[];
    deleted?: boolean;
  }>;
  payments: Array<{
    fromUserId: string;
    toUserId: string;
    amount: number;
  }>;
}

export interface MemberBalance {
  userId: string;
  name: string;
  net: number;
  paidForOthers: number;
  owesOthers: number;
}

export function computeNetBalances(
  input: BalanceInput,
  shouldInclude?: (payerId: string, participantId: string) => boolean
): MemberBalance[] {
  const net: Record<string, number> = {};
  const paid: Record<string, number> = {};
  const owed: Record<string, number> = {};

  for (const id of input.memberIds) {
    net[id] = 0;
    paid[id] = 0;
    owed[id] = 0;
  }

  for (const e of input.expenses) {
    if (e.deleted) continue;
    if (e.participants.length === 0) continue;
    const share = e.amountGroup / e.participants.length;
    for (const p of e.participants) {
      if (p === e.payerId) continue;
      if (shouldInclude && !shouldInclude(e.payerId, p)) continue;
      net[e.payerId] = (net[e.payerId] ?? 0) + share;
      net[p] = (net[p] ?? 0) - share;
      paid[e.payerId] = (paid[e.payerId] ?? 0) + share;
      owed[p] = (owed[p] ?? 0) + share;
    }
  }

  for (const pay of input.payments) {
    if (shouldInclude && !shouldInclude(pay.fromUserId, pay.toUserId)) continue;
    net[pay.fromUserId] = (net[pay.fromUserId] ?? 0) - pay.amount;
    net[pay.toUserId] = (net[pay.toUserId] ?? 0) + pay.amount;
  }

  return input.memberIds.map((id) => ({
    userId: id,
    name: input.names[id] ?? "Usuario",
    net: round2(net[id] ?? 0),
    paidForOthers: round2(paid[id] ?? 0),
    owesOthers: round2(owed[id] ?? 0),
  }));
}

export function simplifyDebts(balances: MemberBalance[]): SettlementTransfer[] {
  const debtors = balances
    .filter((b) => b.net < -EPS)
    .map((b) => ({ id: b.userId, amount: -b.net }))
    .sort((a, b) => b.amount - a.amount);
  const creditors = balances
    .filter((b) => b.net > EPS)
    .map((b) => ({ id: b.userId, amount: b.net }))
    .sort((a, b) => b.amount - a.amount);

  const nameOf = (id: string) => balances.find((b) => b.userId === id)?.name ?? "Usuario";

  const transfers: SettlementTransfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const amount = Math.min(d.amount, c.amount);
    transfers.push({
      fromUserId: d.id,
      fromName: nameOf(d.id),
      toUserId: c.id,
      toName: nameOf(c.id),
      amount: round2(amount),
    });
    d.amount -= amount;
    c.amount -= amount;
    if (d.amount < EPS) i++;
    if (c.amount < EPS) j++;
  }
  return transfers;
}

const SYMBOLS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  JPY: "¥",
  MXN: "$",
  ARS: "$",
  COP: "$",
  CLP: "$",
  PEN: "S/",
  BRL: "R$",
  CHF: "Fr",
  CAD: "C$",
  AUD: "A$",
  CNY: "¥",
  INR: "₹",
};

export function currencySymbol(code: string): string {
  return SYMBOLS[code.toUpperCase()] ?? code.toUpperCase();
}

export function formatMoney(amount: number, currency: string): string {
  const sym = currencySymbol(currency);
  const abs = Math.abs(amount).toFixed(2);
  const sign = amount < 0 ? "-" : "";
  return `${sign}${sym}${abs}`;
}
