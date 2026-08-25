import { createDb } from "../db.js";
import { autoAcceptPendingPayments, findUserById } from "../store.js";
import { createAndPushNotification } from "../push.js";
import { invalidateBalanceCache } from "../balanceCache.js";
import { publishGroupEvent } from "../lib/supabase.js";
import { logAudit } from "../audit.js";

const AUTO_ACCEPT_INTERVAL_MS = 60 * 60 * 1000;

export async function runAutoAcceptJob(dbUrl: string): Promise<void> {
  const db = createDb(dbUrl);
  try {
    const accepted = await autoAcceptPendingPayments(db);
    if (accepted.length === 0) return;

    const groupIds = new Set<string>(accepted.map((p) => p.group_id));
    for (const p of accepted) {
      const [payer, recipient, group] = await Promise.all([
        findUserById(db, p.from_user_id),
        findUserById(db, p.to_user_id),
        db.prepare("SELECT name, currency FROM groups WHERE id = ?").get(p.group_id) as Promise<{ name: string; currency: string } | undefined>,
      ]);
      if (!payer || !recipient || !group) continue;

      if (!payer.is_ghost) {
        await createAndPushNotification(db, {
          userId: p.from_user_id,
          type: "PAYMENT_SETTLED",
          title: `Pago auto-confirmado en ${group.name}`,
          body: `Tu pago de ${p.amount.toFixed(2)} ${group.currency} a ${recipient.name} se ha confirmado automáticamente tras 3 días sin respuesta.`,
          linkUrl: `/groups/${p.group_id}`,
        });
      }
      if (!recipient.is_ghost) {
        await createAndPushNotification(db, {
          userId: p.to_user_id,
          type: "PAYMENT_SETTLED",
          title: `Pago auto-confirmado en ${group.name}`,
          body: `El pago de ${p.amount.toFixed(2)} ${group.currency} de ${payer.name} se ha confirmado automáticamente tras 3 días sin respuesta.`,
          linkUrl: `/groups/${p.group_id}`,
        });
      }
      await logAudit(db, {
        groupId: p.group_id,
        entityType: "payment",
        entityId: p.id,
        action: "auto_accepted",
        actorId: "system",
        actorName: "Sistema",
        before: { status: "pending" },
        after: { status: "accepted" },
      });
    }
    for (const gid of groupIds) {
      invalidateBalanceCache(gid);
      publishGroupEvent(gid, "payment.changed");
    }
  } finally {
    await db.close();
  }
}

function startAutoAcceptScheduler(dbUrl: string): void {
  setInterval(() => {
    runAutoAcceptJob(dbUrl).catch((err) => {
      console.error("[auto-accept] Error en job automático:", err);
    });
  }, AUTO_ACCEPT_INTERVAL_MS);

  runAutoAcceptJob(dbUrl).catch((err) => {
    console.error("[auto-accept] Error en ejecución inicial:", err);
  });

  console.log(`[auto-accept] Scheduler iniciado (intervalo: ${AUTO_ACCEPT_INTERVAL_MS / 1000 / 60} min)`);
}

export { startAutoAcceptScheduler };