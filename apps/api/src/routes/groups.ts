import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import type { Db } from "../db.js";
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
import { config } from "../config.js";

const VALID_CURRENCIES = new Set([
  "EUR", "USD", "GBP", "JPY", "MXN", "ARS", "COP", "CLP", "PEN", "BRL", "CHF", "CAD", "AUD", "CNY", "INR",
]);

const HTTP_URL_RE = /^https?:\/\//i;
const DATA_IMAGE_RE = /^data:image\/[a-z+]+;base64,/i;
const MAX_LOGO_BYTES = 4 * 1024 * 1024;

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
            totalOwedToMe: b.totalOwedToMe,
            totalOwedByMe: b.totalOwedByMe,
            memberCount: b.balances.length + b.exMembers.length,
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
    const { name, currency, type, logoUrl } = request.body as {
      name?: string;
      currency?: string;
      type?: GroupType;
      logoUrl?: string | null;
    };
    const cur = currency ? currency.toUpperCase() : undefined;
    if (cur && !VALID_CURRENCIES.has(cur)) throw badRequest("Moneda no soportada");
    const patch: { name?: string; currency?: string; type?: GroupType; logoUrl?: string | null } = {};
    if (name?.trim()) patch.name = name.trim();
    if (cur) patch.currency = cur;
    if (type === "open" || type === "closed") patch.type = type;
    if (logoUrl !== undefined) patch.logoUrl = parseGroupLogo(logoUrl);
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
    if (member.role === "admin" && admins.length === 0) {
      const remaining = (await listMembers(request.db, groupId)).filter((m) => m.status === "active");
      if (remaining.length > 0) {
        await setRole(request.db, groupId, remaining[0].user_id, "admin");
      }
    }
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
