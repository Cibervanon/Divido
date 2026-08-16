import type { Db } from "./db.js";
import {
  computeNetBalances,
  simplifyDebts,
  round2,
  type MemberBalance,
  type SettlementTransfer,
} from "@divido/shared";
import {
  expenseParticipantIds,
  expenseParticipantShares,
  listExpenses,
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
  exMembers: ExMemberBalance[];
  totalOwedToMe: number;
  totalOwedByMe: number;
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
  const payments = (await listPayments(db, groupId)).map((p) => ({
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

  const exMembers: ExMemberBalance[] = ex.map((m) => {
    const full = fullBalances.find((b) => b.userId === m.user_id);
    return {
      userId: m.user_id,
      name: m.name,
      frozenBalance: m.frozen_balance ?? full?.net ?? null,
      leftAt: m.left_at,
    };
  });

  const totalOwedToMe = balances.filter((b) => b.net > 0).reduce((s, b) => s + b.net, 0);
  const totalOwedByMe = balances.filter((b) => b.net < 0).reduce((s, b) => s - b.net, 0);

  return {
    balances: balances.sort((a, b) => b.net - a.net),
    transfers,
    exMembers,
    totalOwedToMe: round2(totalOwedToMe),
    totalOwedByMe: round2(totalOwedByMe),
  };
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
