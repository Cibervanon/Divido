import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import {
  createGroup,
  getGroup,
  getMemberRow,
  listGroupsForUser,
  listMembers,
  removeMember,
  setMemberStatus,
  setRole,
  updateGroup,
} from "../store.js";
import type { Group, GroupType } from "@divido/shared";
import { badRequest, conflict, forbidden, notFound } from "../errors.js";
import { requireActiveMember, requireAdmin, requireAuth, requireGroup } from "../plugins.js";
import { getGroupBalances } from "../services.js";

const VALID_CURRENCIES = new Set([
  "EUR", "USD", "GBP", "JPY", "MXN", "ARS", "COP", "CLP", "PEN", "BRL", "CHF", "CAD", "AUD", "CNY", "INR",
]);

export const groupRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/groups", async (request) => {
    const user = requireAuth(request);
    const groups = listGroupsForUser(request.db, user.id);
    return {
      groups: groups.map((g) => {
        const b = getGroupBalances(request.db, g.id);
        const mine = b.balances.find((x) => x.userId === user.id);
        return {
          ...g,
          membership: undefined,
          myRole: g.membership.role,
          myBalance: mine?.net ?? 0,
          totalOwedToMe: b.totalOwedToMe,
          totalOwedByMe: b.totalOwedByMe,
          memberCount: b.balances.length + b.exMembers.length,
        };
      }),
    };
  });

  app.post("/api/groups", async (request) => {
    const user = requireAuth(request);
    const { name, currency, type } = request.body as {
      name?: string;
      currency?: string;
      type?: GroupType;
    };
    if (!name?.trim()) throw badRequest("El nombre del grupo es obligatorio");
    const cur = (currency ?? "EUR").toUpperCase();
    if (!VALID_CURRENCIES.has(cur)) throw badRequest("Moneda no soportada");
    const t: GroupType = type === "closed" ? "closed" : "open";
    const group = createGroup(request.db, {
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
    const group = requireGroup(request, groupId);
    const membership = getMemberRow(request.db, groupId, user.id);
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
    requireAdmin(request, groupId);
    const { name, currency, type } = request.body as {
      name?: string;
      currency?: string;
      type?: GroupType;
    };
    const cur = currency ? currency.toUpperCase() : undefined;
    if (cur && !VALID_CURRENCIES.has(cur)) throw badRequest("Moneda no soportada");
    const patch: { name?: string; currency?: string; type?: GroupType } = {};
    if (name?.trim()) patch.name = name.trim();
    if (cur) patch.currency = cur;
    if (type === "open" || type === "closed") patch.type = type;
    if (Object.keys(patch).length === 0) throw badRequest("Sin cambios");
    const group = updateGroup(request.db, groupId, patch);
    return { group: await groupDetail(request.db, group, requireAuth(request).id) };
  });

  app.get("/api/groups/:groupId/invite", async (request) => {
    const user = requireAuth(request);
    const { groupId } = request.params as { groupId: string };
    const group = requireGroup(request, groupId);
    const member = getMemberRow(request.db, groupId, user.id);
    if (!member || member.status !== "active") throw forbidden("Debes ser miembro activo");
    return { inviteToken: group.inviteToken, inviteUrl: buildInviteUrl(group.inviteToken) };
  });

  app.post("/api/groups/:groupId/invite", async (request) => {
    const user = requireAuth(request);
    const { groupId } = request.params as { groupId: string };
    const group = requireGroup(request, groupId);
    const member = getMemberRow(request.db, groupId, user.id);
    if (!member || member.status !== "active") throw forbidden("Debes ser miembro activo");
    if (group.type === "closed" && member.role !== "admin") {
      throw forbidden("Solo administradores pueden invitar en grupos cerrados");
    }
    const token = randomUUID().replace(/-/g, "").slice(0, 16);
    request.db.prepare("UPDATE groups SET invite_token = ? WHERE id = ?").run(token, groupId);
    return { inviteToken: token, inviteUrl: buildInviteUrl(token) };
  });

  app.post("/api/groups/:groupId/members/:userId/role", async (request) => {
    const { groupId, userId } = request.params as { groupId: string; userId: string };
    requireAdmin(request, groupId);
    const { role } = request.body as { role?: string };
    if (role !== "admin" && role !== "member") throw badRequest("Rol inválido");
    const target = getMemberRow(request.db, groupId, userId);
    if (!target || target.status !== "active") throw notFound("Miembro no encontrado");
    setRole(request.db, groupId, userId, role);
    return { ok: true };
  });

  app.delete("/api/groups/:groupId/members/:userId", async (request) => {
    const { groupId, userId } = request.params as { groupId: string; userId: string };
    const admin = requireAdmin(request, groupId);
    if (admin.user_id === userId) throw badRequest("No puedes expulsarte a ti mismo; usa abandonar grupo");
    const target = getMemberRow(request.db, groupId, userId);
    if (!target) throw notFound("Miembro no encontrado");
    const bal = getGroupBalances(request.db, groupId);
    const frozen = bal.balances.find((b) => b.userId === userId)?.net ?? null;
    setMemberStatus(request.db, groupId, userId, "ex_member", new Date().toISOString(), frozen);
    return { ok: true };
  });

  app.post("/api/groups/:groupId/leave", async (request) => {
    const { groupId } = request.params as { groupId: string };
    const user = requireAuth(request);
    const { member } = requireActiveMember(request, groupId);
    const bal = getGroupBalances(request.db, groupId);
    const frozen = bal.balances.find((b) => b.userId === user.id)?.net ?? null;
    const admins = listMembers(request.db, groupId).filter(
      (m) => m.status === "active" && m.role === "admin" && m.user_id !== user.id
    );
    setMemberStatus(request.db, groupId, user.id, "ex_member", new Date().toISOString(), frozen);
    if (member.role === "admin" && admins.length === 0) {
      const remaining = listMembers(request.db, groupId).filter((m) => m.status === "active");
      if (remaining.length > 0) {
        setRole(request.db, groupId, remaining[0].user_id, "admin");
      }
    }
    return { ok: true };
  });

  app.delete("/api/groups/:groupId", async (request) => {
    const { groupId } = request.params as { groupId: string };
    const user = requireAuth(request);
    const group = requireGroup(request, groupId);
    if (group.creatorId !== user.id) throw forbidden("Solo el creador puede eliminar el grupo");
    request.db.prepare("DELETE FROM groups WHERE id = ?").run(groupId);
    return { ok: true };
  });
};

function buildInviteUrl(token: string): string {
  const base = process.env.WEB_ORIGIN ?? "http://localhost:5173";
  return `${base}/join/${token}`;
}

function groupToPublic(group: Group) {
  return {
    id: group.id,
    name: group.name,
    currency: group.currency,
    type: group.type,
    createdAt: group.createdAt,
  };
}

async function groupDetail(
  db: import("node:sqlite").DatabaseSync,
  group: Group,
  userId: string,
  membership?: { role: string; status: string }
) {
  const members = listMembers(db, group.id);
  const balances = getGroupBalances(db, group.id);
  return {
    group: groupToPublic(group),
    inviteUrl: buildInviteUrl(group.inviteToken),
    membership: membership ?? { role: "admin", status: "active" },
    myRole: membership?.role ?? "admin",
    members: members.map((m) => ({
      userId: m.user_id,
      name: m.name,
      email: m.email,
      avatarUrl: m.avatar_url,
      role: m.role,
      status: m.status,
      joinedAt: m.joined_at,
      leftAt: m.left_at,
      frozenBalance: m.frozen_balance,
    })),
    balances: balances.balances.map((b) => ({ ...b, isMe: b.userId === userId })),
    transfers: balances.transfers,
    exMembers: balances.exMembers,
  };
}
