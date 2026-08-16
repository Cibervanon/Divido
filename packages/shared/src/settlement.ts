import type { SettlementTransfer } from "./types.js";

export const EPS = 0.004;

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface BalanceInput {
  memberIds: string[];
  names: Record<string, string>;
  expenses: Array<{
    payerId: string | null;
    amountGroup: number;
    participants: string[];
    /**
     * Importe (en moneda del grupo) que debe cada participante.
     * Si falta una clave, esa persona se reparte a partes iguales.
     */
    participantShares?: Record<string, number>;
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
  emailVerified?: boolean;
  isGhost?: boolean;
}

export function computeNetBalances(
  input: BalanceInput,
  shouldInclude?: (payerId: string | null, participantId: string) => boolean
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
    const equalShare = e.amountGroup / e.participants.length;
    const shares = e.participantShares ?? {};
    for (const p of e.participants) {
      if (e.payerId != null && p === e.payerId) continue;
      if (shouldInclude && !shouldInclude(e.payerId, p)) continue;
      const share = shares[p] != null ? shares[p] : equalShare;
      if (e.payerId != null) {
        net[e.payerId] = (net[e.payerId] ?? 0) + share;
        paid[e.payerId] = (paid[e.payerId] ?? 0) + share;
      }
      net[p] = (net[p] ?? 0) - share;
      owed[p] = (owed[p] ?? 0) + share;
    }
  }

  for (const pay of input.payments) {
    if (shouldInclude && !shouldInclude(pay.fromUserId, pay.toUserId)) continue;
    net[pay.fromUserId] = (net[pay.fromUserId] ?? 0) + pay.amount;
    net[pay.toUserId] = (net[pay.toUserId] ?? 0) - pay.amount;
  }

  return input.memberIds.map((id) => ({
    userId: id,
    name: input.names[id] ?? "Usuario",
    net: round2(net[id] ?? 0),
    paidForOthers: round2(paid[id] ?? 0),
    owesOthers: round2(owed[id] ?? 0),
  }));
}

/**
 * Calcula el conjunto mínimo (en la práctica) de transferencias para liquidar
 * las deudas del grupo aplicando "liquidación en cadena":
 *
 * Ejemplo: A debe 10 € a B y B debe 10 € a C. Los saldos netos quedan
 * A = -10, B = 0, C = +10, y la app propone el pago directo A -> C.
 *
 * Algoritmo:
 *  1. Iguala primero deudas que encajan exactamente (1 transferencia cada una).
 *  2. Con el resto, empareja el mayor deudor con el mayor acreedor (voraz),
 *     lo que garantiza a lo sumo n-1 transferencias.
 */
export function simplifyDebts(balances: MemberBalance[]): SettlementTransfer[] {
  const nameOf = (id: string) => balances.find((b) => b.userId === id)?.name ?? "Usuario";

  const debtors = balances
    .filter((b) => b.net < -EPS)
    .map((b) => ({ id: b.userId, amount: -b.net }))
    .sort((a, b) => b.amount - a.amount);
  const creditors = balances
    .filter((b) => b.net > EPS)
    .map((b) => ({ id: b.userId, amount: b.net, settled: false }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: SettlementTransfer[] = [];

  const byAmount = new Map<number, Array<(typeof creditors)[number]>>();
  for (const c of creditors) {
    const list = byAmount.get(c.amount) ?? [];
    list.push(c);
    byAmount.set(c.amount, list);
  }

  const pendingDebtors: Array<{ id: string; amount: number }> = [];
  for (const d of debtors) {
    const list = byAmount.get(d.amount);
    let matched: (typeof creditors)[number] | undefined;
    while (list && list.length > 0) {
      const c = list.pop()!;
      if (!c.settled) {
        matched = c;
        c.settled = true;
        break;
      }
    }
    if (matched) {
      transfers.push({
        fromUserId: d.id,
        fromName: nameOf(d.id),
        toUserId: matched.id,
        toName: nameOf(matched.id),
        amount: d.amount,
      });
    } else {
      pendingDebtors.push(d);
    }
  }

  const pendingCreditors = creditors.filter((c) => !c.settled);

  let i = 0;
  let j = 0;
  while (i < pendingDebtors.length && j < pendingCreditors.length) {
    const d = pendingDebtors[i];
    const c = pendingCreditors[j];
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
