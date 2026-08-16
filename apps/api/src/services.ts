import type { Db } from "./db.js";
import {
  computeNetBalances,
  simplifyDebts,
  round2,
  EPS,
  type MemberBalance,
  type SettlementTransfer,
} from "@divido/shared";
import {
  expenseParticipantIds,
  expenseParticipantShares,
  listExpenses,
  listInformalDebts,
  listMembers,
  listPayments,
  type ExpenseRow,
  type MemberRow,
  type PaymentRow,
} from "./store.js";

export interface ExMemberBalance {
  userId: string;
  name: string;
  frozenBalance: number | null;
  leftAt: string | null;
}

export interface GroupBalances {
  balances: MemberBalance[];
  transfers: SettlementTransfer[];
  rawTransfers: SettlementTransfer[];
  exMembers: ExMemberBalance[];
}

export interface PersonBreakdownItem {
  userId: string;
  name: string;
  net: number;
  expenses: Array<{
    id: string;
    description: string;
    amountGroup: number;
    share: number;
    currency: string;
    exchangeRate: number;
    amount: number;
    date: string;
    payerId: string | null;
    paidByMe: boolean;
  }>;
  payments: Array<{ id: string; amount: number; date: string; receivedByMe: boolean }>;
}

const isActive = (m: MemberRow) => m.status === "active";

async function expensePairs(db: Db, groupId: string) {
  const expenses = await listExpenses(db, groupId);
  const result: Array<ExpenseRow & { participants: string[]; shares: Record<string, number> }> = [];
  for (const e of expenses) {
    result.push({
      ...e,
      participants: await expenseParticipantIds(db, e.id),
      shares: await expenseParticipantShares(db, e.id),
    });
  }
  return result;
}

export async function getGroupBalances(db: Db, groupId: string): Promise<GroupBalances> {
  const members = await listMembers(db, groupId);
  const active = members.filter(isActive);
  const ex = members.filter((m) => m.status === "ex_member");
  const activeIds = new Set(active.map((m) => m.user_id));
  const allIds = members.map((m) => m.user_id);
  const names: Record<string, string> = {};
  const verified: Record<string, boolean> = {};
  const ghosts: Record<string, boolean> = {};
  for (const m of members) {
    names[m.user_id] = m.name;
    verified[m.user_id] = Boolean(m.email_verified);
    ghosts[m.user_id] = Boolean(m.is_ghost);
  }

  // Los gastos pagados con el bote común se aíslan del balance personal entre
  // miembros: solo reducen el saldo del bote (common_pot_contributions) y no
  // generan deudas ni créditos entre las personas.
  const expenses = (await expensePairs(db, groupId))
    .filter((e) => !e.paid_from_pot)
    .map((e) => ({
      payerId: e.payer_id,
      amountGroup: e.amount_group,
      participants: e.participants,
      participantShares: Object.keys(e.shares).length ? e.shares : undefined,
      deleted: Boolean(e.deleted),
    }));

  // Los piques de dinero se integran en el balance como micro-gastos SOLO
  // mientras están "accepted": cada ganador cobra su parte a cada perdedor.
  // Cuando el ganador los marca como "cobrados" (settled) es porque ya se ha
  // pagado por fuera, así que la deuda se salda y desaparece del balance.
  // Los piques pendientes y los de premio (no monetarios) nunca afectan a los
  // saldos. Estos micro-gastos son sintéticos: no se guardan como gastos en la
  // BD, por lo que no aparecen en la lista principal de gastos ni en el
  // historial del grupo.
  for (const p of (await listInformalDebts(db, groupId)).filter(
    (d) => d.kind === "money" && d.status === "accepted"
  )) {
    const pairs = p.winnerIds.length * p.loserIds.length;
    if (pairs === 0) continue;
    const share = p.amount / pairs;
    for (const loser of p.loserIds) {
      for (const winner of p.winnerIds) {
        expenses.push({
          payerId: winner,
          amountGroup: share,
          participants: [loser],
          participantShares: undefined,
          deleted: false,
        });
      }
    }
  }
  const payments = (await listPayments(db, groupId))
    .filter((p) => p.status === "confirmed")
    .map((p) => ({
      fromUserId: p.from_user_id,
      toUserId: p.to_user_id,
      amount: p.amount,
    }));

  const balances = computeNetBalances(
    { memberIds: activeIds.size ? [...activeIds] : [], names, expenses, payments },
    (payer, participant) => (payer === null || activeIds.has(payer)) && activeIds.has(participant)
  ).map((b) => ({ ...b, emailVerified: verified[b.userId], isGhost: ghosts[b.userId] }));

  const fullBalances = computeNetBalances(
    { memberIds: allIds, names, expenses, payments }
  );

  const transfers = simplifyDebts(balances);
  const rawTransfers = buildRawTransfers(expenses, payments, activeIds, names);

  const exMembers: ExMemberBalance[] = ex.map((m) => {
    const full = fullBalances.find((b) => b.userId === m.user_id);
    return {
      userId: m.user_id,
      name: m.name,
      frozenBalance: m.frozen_balance ?? full?.net ?? null,
      leftAt: m.left_at,
    };
  });

  return {
    balances: balances.sort((a, b) => b.net - a.net),
    transfers,
    rawTransfers,
    exMembers,
  };
}

// Deudas crudas por pares, sin optimizar: cada participante debe al pagador su
// parte, y los pagos ya registrados descuentan esa deuda. Es la vista "sin
// simplificar" antes de aplicar la liquidación en cadena.
function buildRawTransfers(
  expenses: Array<{
    payerId: string | null;
    amountGroup: number;
    participants: string[];
    participantShares?: Record<string, number>;
    deleted?: boolean;
  }>,
  payments: Array<{ fromUserId: string; toUserId: string; amount: number }>,
  activeIds: Set<string>,
  names: Record<string, string>
): SettlementTransfer[] {
  const pairDebt = new Map<string, Map<string, number>>();
  const add = (from: string, to: string, amount: number) => {
    if (!activeIds.has(from) || !activeIds.has(to) || amount === 0) return;
    let m = pairDebt.get(from);
    if (!m) {
      m = new Map();
      pairDebt.set(from, m);
    }
    m.set(to, round2((m.get(to) ?? 0) + amount));
  };

  for (const e of expenses) {
    if (e.deleted || e.participants.length === 0 || e.payerId == null) continue;
    const equalShare = e.amountGroup / e.participants.length;
    for (const p of e.participants) {
      if (p === e.payerId) continue;
      const share = e.participantShares && e.participantShares[p] != null ? e.participantShares[p] : equalShare;
      add(p, e.payerId, share);
    }
  }
  for (const pay of payments) {
    add(pay.fromUserId, pay.toUserId, -pay.amount);
  }

  const result: SettlementTransfer[] = [];
  for (const [from, m] of pairDebt) {
    for (const [to, amount] of m) {
      if (amount > EPS) {
        result.push({
          fromUserId: from,
          fromName: names[from] ?? "Usuario",
          toUserId: to,
          toName: names[to] ?? "Usuario",
          amount,
        });
      }
    }
  }
  return result.sort((a, b) => b.amount - a.amount);
}

export async function getPersonBreakdown(db: Db, groupId: string, userId: string): Promise<PersonBreakdownItem[]> {
  const members = (await listMembers(db, groupId)).filter(isActive);
  const expenses = await expensePairs(db, groupId);
  const payments = await listPayments(db, groupId);

  const others = members.filter((m) => m.user_id !== userId);
  const result: PersonBreakdownItem[] = others.map((m) => ({
    userId: m.user_id,
    name: m.name,
    net: 0,
    expenses: [],
    payments: [],
  }));
  const index = new Map(result.map((r) => [r.userId, r]));

  for (const e of expenses) {
    if (e.deleted) continue;
    if (e.participants.length === 0) continue;
    const shareOf = (p: string) =>
      e.shares[p] ?? e.amount_group / e.participants.length;
    if (e.payer_id === userId) {
      for (const p of e.participants) {
        if (p === userId) continue;
        const item = index.get(p);
        if (!item) continue;
        const share = shareOf(p);
        item.net += share;
        item.expenses.push({
          id: e.id,
          description: e.description,
          amountGroup: e.amount_group,
          share: round2(share),
          currency: e.currency,
          exchangeRate: e.exchange_rate,
          amount: e.amount,
          date: e.created_at,
          payerId: e.payer_id,
          paidByMe: true,
        });
      }
    } else if (e.payer_id !== null && e.participants.includes(userId)) {
      const item = index.get(e.payer_id);
      if (!item) continue;
      const share = shareOf(userId);
      item.net -= share;
      item.expenses.push({
        id: e.id,
        description: e.description,
        amountGroup: e.amount_group,
        share: round2(share),
        currency: e.currency,
        exchangeRate: e.exchange_rate,
        amount: e.amount,
        date: e.created_at,
        payerId: e.payer_id,
        paidByMe: false,
      });
    }
  }

  for (const pay of payments) {
    const involvedOther = pay.from_user_id === userId ? pay.to_user_id : pay.to_user_id === userId ? pay.from_user_id : null;
    if (!involvedOther) continue;
    const item = index.get(involvedOther);
    if (!item) continue;
    if (pay.from_user_id === userId) item.net += pay.amount;
    if (pay.to_user_id === userId) item.net -= pay.amount;
    item.payments.push({
      id: pay.id,
      amount: pay.amount,
      date: pay.created_at,
      receivedByMe: pay.to_user_id === userId,
    });
  }

  for (const item of result) item.net = round2(item.net);
  return result;
}
