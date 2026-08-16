import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import type { Db } from "../db.js";
import {
  addMember,
  addPotContribution,
  createGhostUser,
  createGroup,
  createGroupEvent,
  createInformalDebt,
  createRecurringExpense,
  deletePotContribution,
  deleteRecurringExpense,
  getGroup,
  getInformalDebt,
  getMemberRow,
  getPotBalance,
  getRecurringExpense,
  listGroupsForUser,
  listInformalDebts,
  listMembers,
  listPotContributions,
  listRecurringExpenses,
  removeMember,
  setMemberStatus,
  setRecurringExpenseActive,
  setRole,
  updateGroup,
  updateInformalDebtStatus,
} from "../store.js";
import type { Group, GroupType, InformalDebtStatus, PiqueKind } from "@divido/shared";
import { round2 } from "@divido/shared";
import { badRequest, conflict, forbidden, notFound } from "../errors.js";
import { requireActiveMember, requireAdmin, requireAuth, requireGroup } from "../plugins.js";
import { createAndPushNotification } from "../push.js";
import { getGroupBalances } from "../services.js";
import { config } from "../config.js";

const VALID_CURRENCIES = new Set([
  "EUR", "USD", "GBP", "JPY", "MXN", "ARS", "COP", "CLP", "PEN", "BRL", "CHF", "CAD", "AUD", "CNY", "INR",
]);

const HTTP_URL_RE = /^https?:\/\//i;
const DATA_IMAGE_RE = /^data:image\/[a-z+]+;base64,/i;
const MAX_LOGO_BYTES = 4 * 1024 * 1024;

const VALID_EXTRAS = new Set(["informal_debts", "common_pot", "recurring_expenses"]);
const VALID_DEBT_STATUSES = new Set<InformalDebtStatus>(["pending", "accepted", "rejected", "settled"]);

function parseGroupLogo(raw: string | null): string | null {
  const url = (raw ?? "").trim();
  if (url === "") return null;
  if (HTTP_URL_RE.test(url)) return url.slice(0, 2048);
  if (DATA_IMAGE_RE.test(url)) {
    const size = Math.ceil((url.length - url.indexOf(",") - 1) * 0.75);
    if (size > MAX_LOGO_BYTES) throw badRequest("El logo es demasiado grande (máximo 4 MB)");
    return url;
  }
  throw badRequest("URL de logo inválida");
}

export const groupRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/groups", async (request) => {
    const user = requireAuth(request);
    const groups = await listGroupsForUser(request.db, user.id);
    return {
      groups: await Promise.all(
        groups.map(async (g) => {
          const b = await getGroupBalances(request.db, g.id);
          const mine = b.balances.find((x) => x.userId === user.id);
          return {
            ...g,
            membership: undefined,
            myRole: g.membership.role,
            myBalance: mine?.net ?? 0,
            totalOwedToMe: round2(Math.max(mine?.net ?? 0, 0)),
            totalOwedByMe: round2(Math.max(-(mine?.net ?? 0), 0)),
            memberCount: b.balances.length + b.exMembers.length,
            lastActivity: g.lastActivity,
          };
        })
      ),
    };
  });

  app.post("/api/groups", async (request) => {
    const user = requireAuth(request);
    if (!user.emailVerified) {
      throw forbidden("Verifica tu email para poder crear grupos");
    }
    const { name, currency, type } = request.body as {
      name?: string;
      currency?: string;
      type?: GroupType;
    };
    if (!name?.trim()) throw badRequest("El nombre del grupo es obligatorio");
    const cur = (currency ?? "EUR").toUpperCase();
    if (!VALID_CURRENCIES.has(cur)) throw badRequest("Moneda no soportada");
    const t: GroupType = type === "closed" ? "closed" : "open";
    const group = await createGroup(request.db, {
      name: name.trim(),
      currency: cur,
      type: t,
      creatorId: user.id,
    });
    return { group: await groupDetail(request.db, group, user.id) };
  });

  app.get("/api/groups/:groupId", async (request, reply) => {
    const user = requireAuth(request);
    const { groupId } = request.params as { groupId: string };
    const group = await requireGroup(request, groupId);
    const membership = await getMemberRow(request.db, groupId, user.id);
    if (!membership) {
      return reply.code(200).send({
        group: groupToPublic(group),
        membership: null,
        canPreview: true,
      });
    }
    return groupDetail(request.db, group, user.id, membership);
  });

  app.patch("/api/groups/:groupId", async (request) => {
    const { groupId } = request.params as { groupId: string };
    await requireAdmin(request, groupId);
    const { name, currency, type, logoUrl, enabledExtras, simplifyDebts } = request.body as {
      name?: string;
      currency?: string;
      type?: GroupType;
      logoUrl?: string | null;
      enabledExtras?: string[];
      simplifyDebts?: boolean;
    };
    const cur = currency ? currency.toUpperCase() : undefined;
    if (cur && !VALID_CURRENCIES.has(cur)) throw badRequest("Moneda no soportada");
    const patch: {
      name?: string;
      currency?: string;
      type?: GroupType;
      logoUrl?: string | null;
      enabledExtras?: string[];
      simplifyDebts?: boolean;
    } = {};
    if (name?.trim()) patch.name = name.trim();
    if (cur) patch.currency = cur;
    if (type === "open" || type === "closed") patch.type = type;
    if (logoUrl !== undefined) patch.logoUrl = parseGroupLogo(logoUrl);
    if (enabledExtras !== undefined) {
      if (!Array.isArray(enabledExtras)) throw badRequest("enabledExtras debe ser una lista");
      for (const extra of enabledExtras) {
        if (typeof extra !== "string" || !VALID_EXTRAS.has(extra)) throw badRequest("Extra no soportado");
      }
      patch.enabledExtras = [...new Set(enabledExtras)];
    }
    if (simplifyDebts !== undefined) patch.simplifyDebts = Boolean(simplifyDebts);
    if (Object.keys(patch).length === 0) throw badRequest("Sin cambios");
    const group = await updateGroup(request.db, groupId, patch);
    return { group: await groupDetail(request.db, group, requireAuth(request).id) };
  });

  app.get("/api/groups/:groupId/invite", async (request) => {
    const { groupId } = request.params as { groupId: string };
    const group = await requireGroup(request, groupId);
    await requireAdmin(request, groupId);
    return { inviteToken: group.inviteToken, inviteUrl: buildInviteUrl(group.inviteToken) };
  });

  app.post("/api/groups/:groupId/invite", async (request) => {
    const user = requireAuth(request);
    const { groupId } = request.params as { groupId: string };
    const group = await requireGroup(request, groupId);
    const member = await getMemberRow(request.db, groupId, user.id);
    if (!member || member.status !== "active") throw forbidden("Debes ser miembro activo");
    if (group.type === "closed" && member.role !== "admin") {
      throw forbidden("Solo administradores pueden invitar en grupos cerrados");
    }
    const token = randomUUID().replace(/-/g, "").slice(0, 16);
    await request.db.prepare("UPDATE groups SET invite_token = ? WHERE id = ?").run(token, groupId);
    return { inviteToken: token, inviteUrl: buildInviteUrl(token) };
  });

  app.post("/api/groups/:groupId/members/:userId/role", async (request) => {
    const { groupId, userId } = request.params as { groupId: string; userId: string };
    await requireAdmin(request, groupId);
    const { role } = request.body as { role?: string };
    if (role !== "admin" && role !== "member") throw badRequest("Rol inválido");
    const target = await getMemberRow(request.db, groupId, userId);
    if (!target || target.status !== "active") throw notFound("Miembro no encontrado");
    await setRole(request.db, groupId, userId, role);
    return { ok: true };
  });

  app.post("/api/groups/:groupId/ghost-members", async (request) => {
    const { groupId } = request.params as { groupId: string };
    await requireAdmin(request, groupId);
    const { name } = request.body as { name?: string };
    const clean = name?.trim();
    if (!clean) throw badRequest("El nombre es obligatorio");
    if (clean.length > 100) throw badRequest("El nombre es demasiado largo");
    const user = await createGhostUser(request.db, { name: clean });
    const member = await addMember(request.db, {
      groupId,
      userId: user.id,
      role: "member",
      status: "active",
    });
    await createGroupEvent(request.db, {
      groupId,
      type: "member_joined",
      userId: user.id,
      userName: user.name,
    });
    return {
      member: {
        userId: user.id,
        name: user.name,
        email: null,
        avatarUrl: null,
        emailVerified: false,
        isGhost: true,
        role: member.role,
        status: member.status,
        joinedAt: member.joinedAt,
        leftAt: member.leftAt,
        frozenBalance: member.frozenBalance,
      },
    };
  });

  app.delete("/api/groups/:groupId/members/:userId", async (request) => {
    const { groupId, userId } = request.params as { groupId: string; userId: string };
    const admin = await requireAdmin(request, groupId);
    if (admin.user_id === userId) throw badRequest("No puedes expulsarte a ti mismo; usa abandonar grupo");
    const group = await requireGroup(request, groupId);
    if (userId === group.creatorId) throw forbidden("No puedes expulsar al creador del grupo");
    const target = await getMemberRow(request.db, groupId, userId);
    if (!target) throw notFound("Miembro no encontrado");
    const bal = await getGroupBalances(request.db, groupId);
    const frozen = bal.balances.find((b) => b.userId === userId)?.net ?? null;
    await setMemberStatus(request.db, groupId, userId, "ex_member", new Date().toISOString(), frozen);
    await createGroupEvent(request.db, {
      groupId,
      type: "member_removed",
      userId,
      userName: target.name,
    });
    return { ok: true };
  });

  app.post("/api/groups/:groupId/leave", async (request) => {
    const { groupId } = request.params as { groupId: string };
    const user = requireAuth(request);
    const { member } = await requireActiveMember(request, groupId);
    const bal = await getGroupBalances(request.db, groupId);
    const frozen = bal.balances.find((b) => b.userId === user.id)?.net ?? null;
    const admins = (await listMembers(request.db, groupId)).filter(
      (m) => m.status === "active" && m.role === "admin" && m.user_id !== user.id
    );
    await setMemberStatus(request.db, groupId, user.id, "ex_member", new Date().toISOString(), frozen);
    await createGroupEvent(request.db, {
      groupId,
      type: "member_left",
      userId: user.id,
      userName: user.name,
    });
    if (member.role === "admin" && admins.length === 0) {
      const remaining = (await listMembers(request.db, groupId)).filter((m) => m.status === "active");
      if (remaining.length > 0) {
        await setRole(request.db, groupId, remaining[0].user_id, "admin");
      }
    }
    return { ok: true };
  });

  app.get("/api/groups/:groupId/informal-debts", async (request) => {
    const { groupId } = request.params as { groupId: string };
    await requireActiveMember(request, groupId);
    const [debts, members] = await Promise.all([
      listInformalDebts(request.db, groupId),
      listMembers(request.db, groupId),
    ]);
    const names: Record<string, string> = {};
    const ghost: Record<string, boolean> = {};
    for (const m of members) {
      names[m.user_id] = m.name;
      ghost[m.user_id] = Boolean(m.is_ghost);
    }
    return {
      debts: debts.map((d) => ({
        ...d,
        winnerNames: d.winnerIds.map((id) => names[id] ?? "Usuario"),
        loserNames: d.loserIds.map((id) => names[id] ?? "Usuario"),
        winnerIsGhost: d.winnerIds.map((id) => Boolean(ghost[id])),
        loserIsGhost: d.loserIds.map((id) => Boolean(ghost[id])),
      })),
    };
  });

  app.post("/api/groups/:groupId/informal-debts", async (request) => {
    const { groupId } = request.params as { groupId: string };
    const user = requireAuth(request);
    const { group } = await requireActiveMember(request, groupId);
    if (!group.enabledExtras.includes("informal_debts")) {
      throw badRequest("El extra de piques y apuestas no está activo en este grupo");
    }
    const body = request.body as {
      kind?: string;
      winnerIds?: string[];
      loserIds?: string[];
      creditorId?: string;
      debtorId?: string;
      amount?: number;
      prize?: string;
      title?: string;
    };
    // Compatibilidad con la antigua forma de un único par (acreedor/deudor).
    const winners = body.winnerIds ?? (body.creditorId ? [body.creditorId] : []);
    const losers = body.loserIds ?? (body.debtorId ? [body.debtorId] : []);
    const kind: PiqueKind = body.kind === "prize" ? "prize" : "money";
    const cleanTitle = body.title?.trim() ?? "";
    if (!cleanTitle) throw badRequest("Escribe un concepto para el pique");
    if (cleanTitle.length > 140) throw badRequest("El concepto es demasiado largo");
    if (!Array.isArray(winners) || winners.length === 0 || !Array.isArray(losers) || losers.length === 0) {
      throw badRequest("Debes elegir quiénes ganan y quiénes deben");
    }
    const winnersSet = new Set(winners.map(String));
    const losersSet = new Set(losers.map(String));
    for (const id of [...winnersSet, ...losersSet]) {
      if (winnersSet.has(id) && losersSet.has(id)) {
        throw badRequest("Una persona no puede ser ganadora y perdedora a la vez");
      }
    }
    const members = await listMembers(request.db, groupId);
    const activeIds = new Set(members.filter((m) => m.status === "active").map((m) => m.user_id));
    for (const id of [...winnersSet, ...losersSet]) {
      if (!activeIds.has(id)) throw badRequest("Todos los participantes deben ser miembros activos");
    }
    let amount = 0;
    let prize: string | null = null;
    if (kind === "money") {
      const amountNum = Number(body.amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) throw badRequest("El importe debe ser mayor que 0");
      amount = Math.round(amountNum * 100) / 100;
    } else {
      const cleanPrize = body.prize?.trim() ?? "";
      if (!cleanPrize) throw badRequest("Describe el premio (ej. Una comida, Un café)");
      if (cleanPrize.length > 140) throw badRequest("El premio es demasiado largo");
      prize = cleanPrize;
    }
    const debt = await createInformalDebt(request.db, {
      groupId,
      creatorId: user.id,
      winnerIds: [...winnersSet],
      loserIds: [...losersSet],
      kind,
      amount,
      prize,
      title: cleanTitle,
    });
    const ghost: Record<string, boolean> = {};
    for (const m of members) ghost[m.user_id] = Boolean(m.is_ghost);
    const nameOf = (id: string) => members.find((m) => m.user_id === id)?.name ?? "Usuario";
    const winnerNames = debt.winnerIds.map(nameOf);
    const loserNames = debt.loserIds.map(nameOf);
    const linkUrl = `/groups/${groupId}?tab=debts`;
    for (const loserId of debt.loserIds) {
      if (loserId !== user.id && !ghost[loserId]) {
        await createAndPushNotification(request.db, {
          userId: loserId,
          type: "PIQUE_CREATED",
          title: `Nuevo pique en ${group.name}`,
          body:
            kind === "money"
              ? `${user.name} te lanzó un pique de ${debt.amount.toFixed(2)} ${group.currency}: "${cleanTitle}".`
              : `${user.name} te lanzó un pique: deberéis "${cleanTitle}" (premio: ${prize}).`,
          linkUrl,
        });
      }
    }
    for (const winnerId of debt.winnerIds) {
      if (winnerId !== user.id && !ghost[winnerId]) {
        await createAndPushNotification(request.db, {
          userId: winnerId,
          type: "PIQUE_CREATED",
          title: `Nuevo pique en ${group.name}`,
          body:
            kind === "money"
              ? `${user.name} te apuntó como ganador de ${debt.amount.toFixed(2)} ${group.currency}: "${cleanTitle}".`
              : `${user.name} te apuntó como ganador: "${prize}" por "${cleanTitle}".`,
          linkUrl,
        });
      }
    }
    return {
      debt: {
        ...debt,
        winnerNames,
        loserNames,
        winnerIsGhost: debt.winnerIds.map((id) => Boolean(ghost[id])),
        loserIsGhost: debt.loserIds.map((id) => Boolean(ghost[id])),
      },
    };
  });

  app.patch("/api/groups/:groupId/informal-debts/:debtId/status", async (request) => {
    const { groupId, debtId } = request.params as { groupId: string; debtId: string };
    const user = requireAuth(request);
    await requireActiveMember(request, groupId);
    const { status } = request.body as { status?: string };
    if (!status || !VALID_DEBT_STATUSES.has(status as InformalDebtStatus)) throw badRequest("Estado inválido");
    const debt = await getInformalDebt(request.db, debtId);
    if (!debt || debt.groupId !== groupId) throw notFound("Pique no encontrado");
    const next = status as InformalDebtStatus;
    if (debt.status === "pending" && (next === "accepted" || next === "rejected")) {
      if (!debt.loserIds.includes(user.id)) throw forbidden("Solo los perdedores pueden aceptar o rechazar el pique");
    } else if (debt.status === "accepted" && next === "settled") {
      if (!debt.winnerIds.includes(user.id)) throw forbidden("Solo los ganadores pueden marcar el pique como pagado");
    } else {
      throw badRequest("No se puede pasar a ese estado");
    }
    await updateInformalDebtStatus(request.db, debtId, next);
    return { ok: true };
  });

  // ---------- Bote común ----------

  app.get("/api/groups/:groupId/common-pot", async (request) => {
    const { groupId } = request.params as { groupId: string };
    const { group } = await requireActiveMember(request, groupId);
    if (!group.enabledExtras.includes("common_pot")) {
      throw badRequest("El extra de bote común no está activo en este grupo");
    }
    const [balance, contributions] = await Promise.all([
      getPotBalance(request.db, groupId),
      listPotContributions(request.db, groupId),
    ]);
    return { balance, contributions };
  });

  app.post("/api/groups/:groupId/common-pot/contributions", async (request) => {
    const { groupId } = request.params as { groupId: string };
    const user = requireAuth(request);
    const { group } = await requireActiveMember(request, groupId);
    if (!group.enabledExtras.includes("common_pot")) {
      throw badRequest("El extra de bote común no está activo en este grupo");
    }
    const { amount, note } = request.body as { amount?: number; note?: string };
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) throw badRequest("El importe debe ser mayor que 0");
    const cleanNote = note?.trim() ?? "";
    if (cleanNote.length > 140) throw badRequest("La nota es demasiado larga");
    const contribution = await addPotContribution(request.db, {
      groupId,
      userId: user.id,
      amount: Math.round(amountNum * 100) / 100,
      note: cleanNote || null,
    });
    return { contribution };
  });

  app.delete("/api/groups/:groupId/common-pot/contributions/:contributionId", async (request) => {
    const { groupId, contributionId } = request.params as { groupId: string; contributionId: string };
    const user = requireAuth(request);
    const { member } = await requireActiveMember(request, groupId);
    const contributions = await listPotContributions(request.db, groupId);
    const contribution = contributions.find((c) => c.id === contributionId);
    if (!contribution) throw notFound("Aportación no encontrada");
    if (contribution.expenseId) {
      throw conflict("No puedes eliminar la retirada vinculada a un gasto");
    }
    if (contribution.userId !== user.id && member.role !== "admin") {
      throw forbidden("Solo puedes eliminar tus propias aportaciones");
    }
    await deletePotContribution(request.db, contributionId);
    return { ok: true };
  });

  // ---------- Gastos fijos ----------

  app.get("/api/groups/:groupId/recurring", async (request) => {
    const { groupId } = request.params as { groupId: string };
    const { group } = await requireActiveMember(request, groupId);
    if (!group.enabledExtras.includes("recurring_expenses")) {
      throw badRequest("El extra de gastos fijos no está activo en este grupo");
    }
    return { expenses: await listRecurringExpenses(request.db, groupId) };
  });

  app.post("/api/groups/:groupId/recurring", async (request) => {
    const { groupId } = request.params as { groupId: string };
    const user = requireAuth(request);
    const { group } = await requireActiveMember(request, groupId);
    if (!group.enabledExtras.includes("recurring_expenses")) {
      throw badRequest("El extra de gastos fijos no está activo en este grupo");
    }
    const { title, amount, frequency, responsibleId, payerId, participants, autoCreate } = request.body as {
      title?: string;
      amount?: number;
      frequency?: string;
      responsibleId?: string;
      payerId?: string;
      participants?: string[];
      autoCreate?: boolean;
    };
    const cleanTitle = title?.trim() ?? "";
    if (!cleanTitle) throw badRequest("Escribe un título para el gasto fijo");
    if (cleanTitle.length > 140) throw badRequest("El título es demasiado largo");
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) throw badRequest("El importe debe ser mayor que 0");
    if (frequency !== "weekly" && frequency !== "monthly" && frequency !== "yearly") {
      throw badRequest("Periodicidad inválida");
    }
    if (!responsibleId) throw badRequest("Elige el miembro responsable");
    const members = await listMembers(request.db, groupId);
    const activeIds = new Set(members.filter((m) => m.status === "active").map((m) => m.user_id));
    if (!activeIds.has(responsibleId)) throw badRequest("El responsable no es un miembro activo");
    if (payerId && !activeIds.has(payerId)) throw badRequest("El pagador no es un miembro activo");
    if (participants !== undefined) {
      if (!Array.isArray(participants) || participants.length === 0) {
        throw badRequest("Selecciona al menos un participante");
      }
      for (const p of participants) {
        if (!activeIds.has(p)) throw badRequest("Hay participantes que no son miembros activos");
      }
    }
    const expense = await createRecurringExpense(request.db, {
      groupId,
      title: cleanTitle,
      amount: Math.round(amountNum * 100) / 100,
      currency: group.currency,
      frequency,
      responsibleId,
      payerId,
      participants,
      autoCreate: Boolean(autoCreate),
      createdById: user.id,
    });
    return { expense };
  });

  app.patch("/api/recurring/:expenseId/toggle", async (request) => {
    const user = requireAuth(request);
    const { expenseId } = request.params as { expenseId: string };
    const { active } = request.body as { active?: unknown };
    if (typeof active !== "boolean") throw badRequest("Falta el estado activo");
    const expense = await getRecurringExpense(request.db, expenseId);
    if (!expense) throw notFound("Gasto fijo no encontrado");
    const { member } = await requireActiveMember(request, expense.groupId);
    if (expense.responsibleId !== user.id && member.role !== "admin") {
      throw forbidden("Solo el responsable o un administrador puede cambiar el estado");
    }
    const updated = await setRecurringExpenseActive(request.db, expenseId, active);
    return { expense: updated };
  });

  app.delete("/api/recurring/:expenseId", async (request) => {
    const user = requireAuth(request);
    const { expenseId } = request.params as { expenseId: string };
    const expense = await getRecurringExpense(request.db, expenseId);
    if (!expense) throw notFound("Gasto fijo no encontrado");
    const { member } = await requireActiveMember(request, expense.groupId);
    if (expense.responsibleId !== user.id && member.role !== "admin") {
      throw forbidden("Solo el responsable o un administrador puede eliminar el gasto fijo");
    }
    await deleteRecurringExpense(request.db, expenseId);
    return { ok: true };
  });

  app.delete("/api/groups/:groupId", async (request) => {
    const { groupId } = request.params as { groupId: string };
    const user = requireAuth(request);
    const group = await requireGroup(request, groupId);
    if (group.creatorId !== user.id) throw forbidden("Solo el creador puede eliminar el grupo");
    await request.db.prepare("DELETE FROM groups WHERE id = ?").run(groupId);
    return { ok: true };
  });
};

function buildInviteUrl(token: string): string {
  return `${config.webOrigin}/join/${token}`;
}

function groupToPublic(group: Group) {
  return {
    id: group.id,
    name: group.name,
    currency: group.currency,
    type: group.type,
    creatorId: group.creatorId,
    logoUrl: group.logoUrl,
    enabledExtras: group.enabledExtras,
    simplifyDebts: group.simplifyDebts,
    createdAt: group.createdAt,
  };
}

async function groupDetail(
  db: Db,
  group: Group,
  userId: string,
  membership?: { role: string; status: string }
) {
  const members = await listMembers(db, group.id);
  const balances = await getGroupBalances(db, group.id);
  const isAdmin = (membership?.role ?? "admin") === "admin";
  return {
    group: groupToPublic(group),
    inviteUrl: isAdmin ? buildInviteUrl(group.inviteToken) : null,
    membership: membership ?? { role: "admin", status: "active" },
    myRole: membership?.role ?? "admin",
    members: members.map((m) => ({
      userId: m.user_id,
      name: m.name,
      email: m.email,
      avatarUrl: m.avatar_url,
      emailVerified: Boolean(m.email_verified),
      isGhost: Boolean(m.is_ghost),
      phone: m.phone,
      revolut: m.revolut,
      paypal: m.paypal,
      role: m.role,
      status: m.status,
      joinedAt: m.joined_at,
      leftAt: m.left_at,
      frozenBalance: m.frozen_balance,
    })),
    balances: balances.balances.map((b) => ({ ...b, isMe: b.userId === userId })),
    transfers: balances.transfers,
    rawTransfers: balances.rawTransfers,
    exMembers: balances.exMembers,
  };
}
