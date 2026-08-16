import {
  createExpense,
  getGroup,
  listDueRecurringExpenses,
  listMembers,
  setRecurringExpenseNextRun,
  type RecurringFrequency,
} from "./store.js";
import { createAndPushNotification } from "./push.js";
import type { Db } from "./db.js";

export function nextRun(fromIso: string, frequency: RecurringFrequency): string {
  const d = new Date(fromIso);
  if (frequency === "weekly") d.setDate(d.getDate() + 7);
  else if (frequency === "monthly") d.setMonth(d.getMonth() + 1);
  else if (frequency === "yearly") d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Genera los gastos vencidos de las cuotas fijas con autoregistro activo. */
export async function processRecurringExpenses(db: Db): Promise<{ created: number; failed: number }> {
  const now = new Date().toISOString();
  const due = await listDueRecurringExpenses(db, now);
  let created = 0;
  let failed = 0;

  for (const rec of due) {
    try {
      const group = await getGroup(db, rec.groupId);
      if (!group) {
        await setRecurringExpenseNextRun(db, rec.id, nextRun(now, rec.frequency));
        continue;
      }
      const members = await listMembers(db, rec.groupId);
      const active = members.filter((m) => m.status === "active");
      const activeIds = new Set(active.map((m) => m.user_id));
      let participants = rec.participants.filter((p) => activeIds.has(p));
      if (participants.length === 0) participants = active.map((m) => m.user_id);
      if (participants.length === 0) {
        // Sin miembros activos: se pospone el cobro.
        await setRecurringExpenseNextRun(db, rec.id, nextRun(now, rec.frequency));
        continue;
      }
      const payerId = rec.payerId ?? rec.responsibleId;
      const currency = rec.currency && rec.currency !== "" ? rec.currency : group.currency;
      const amount = round2(rec.amount);
      await createExpense(db, {
        groupId: rec.groupId,
        payerId,
        description: rec.title,
        amount,
        currency,
        exchangeRate: 1,
        amountGroup: amount,
        createdById: payerId,
        participants,
        category: "recurring",
        iconName: "repeat",
      });
      const ghostIds = new Set(active.filter((m) => m.is_ghost).map((m) => m.user_id));
      for (const p of new Set(participants)) {
        if (p !== payerId && !ghostIds.has(p)) {
          await createAndPushNotification(db, {
            userId: p,
            type: "RECURRING_EXPENSE",
            title: `Gasto recurrente en ${group.name}`,
            body: `${rec.title} · ${amount.toFixed(2)} ${currency}.`,
            linkUrl: `/groups/${rec.groupId}`,
          });
        }
      }
      await setRecurringExpenseNextRun(db, rec.id, nextRun(now, rec.frequency));
      created += 1;
    } catch {
      // Se avanza la fecha para no quedarse en bucle y seguir con el resto.
      failed += 1;
      await setRecurringExpenseNextRun(db, rec.id, nextRun(now, rec.frequency)).catch(() => {});
    }
  }
  return { created, failed };
}
