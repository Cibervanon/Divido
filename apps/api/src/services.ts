import type { DatabaseSync } from "node:sqlite";
import {
  computeNetBalances,
  simplifyDebts,
  round2,
  type MemberBalance,
  type SettlementTransfer,
} from "@divido/shared";
import {
  expenseParticipantIds,
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
    payerId: string;
    paidByMe: boolean;
  }>;
  payments: Array<{ id: string; amount: number; date: string; receivedByMe: boolean }>;
}

const isActive = (m: MemberRow) => m.status === "active";

function expensePairs(db: DatabaseSync, groupId: string) {
  return listExpenses(db, groupId).map((e) => ({
    ...e,
    participants: expenseParticipantIds(db, e.id),
  }));
}

export function getGroupBalances(db: DatabaseSync, groupId: string): GroupBalances {
  const members = listMembers(db, groupId);
  const active = members.filter(isActive);
  const ex = members.filter((m) => m.status === "ex_member");
  const activeIds = new Set(active.map((m) => m.user_id));
  const allIds = members.map((m) => m.user_id);
  const names: Record<string, string> = {};
  for (const m of members) names[m.user_id] = m.name;

  const expenses = expensePairs(db, groupId).map((e) => ({
    payerId: e.payer_id,
    amountGroup: e.amount_group,
    participants: e.participants,
    deleted: Boolean(e.deleted),
  }));
  const payments = listPayments(db, groupId).map((p) => ({
    fromUserId: p.from_user_id,
    toUserId: p.to_user_id,
    amount: p.amount,
  }));

  const balances = computeNetBalances(
    { memberIds: activeIds.size ? [...activeIds] : [], names, expenses, payments },
    (payer, participant) => activeIds.has(payer) && activeIds.has(participant)
  );

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

export function getPersonBreakdown(db: DatabaseSync, groupId: string, userId: string): PersonBreakdownItem[] {
  const members = listMembers(db, groupId).filter(isActive);
  const expenses: Array<ExpenseRow & { participants: string[] }> = expensePairs(db, groupId);
  const payments = listPayments(db, groupId);

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
    const share = e.amount_group / e.participants.length;
    if (e.payer_id === userId) {
      for (const p of e.participants) {
        if (p === userId) continue;
        const item = index.get(p);
        if (!item) continue;
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
    } else if (e.participants.includes(userId)) {
      const item = index.get(e.payer_id);
      if (!item) continue;
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
    if (pay.from_user_id === userId) item.net -= pay.amount;
    if (pay.to_user_id === userId) item.net += pay.amount;
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
