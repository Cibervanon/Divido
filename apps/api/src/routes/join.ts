import type { FastifyPluginAsync } from "fastify";
import {
  addMember,
  countActiveMemberships,
  getGroupByInviteToken,
  getMemberRow,
  listMembers,
  setMemberStatus,
} from "../store.js";
import type { InvitePreview } from "@divido/shared";
import { forbidden, notFound } from "../errors.js";
import { requireAuth } from "../plugins.js";

export const joinRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/join/:token", async (request) => {
    const { token } = request.params as { token: string };
    const group = await getGroupByInviteToken(request.db, token);
    if (!group) throw notFound("Enlace de invitación inválido o caducado");
    const memberCount = (await listMembers(request.db, group.id)).filter((m) => m.status === "active").length;
    const existingMember = Boolean(request.user && (await getMemberRow(request.db, group.id, request.user.id)));
    const preview: InvitePreview = {
      groupId: group.id,
      groupName: group.name,
      currency: group.currency,
      memberCount,
      existingMember,
    };
    return { preview };
  });

  app.post("/api/join/:token", async (request) => {
    const { token } = request.params as { token: string };
    const user = requireAuth(request);
    const group = await getGroupByInviteToken(request.db, token);
    if (!group) throw notFound("Enlace de invitación inválido o caducado");
    const existing = await getMemberRow(request.db, group.id, user.id);
    if (existing) {
      if (existing.status === "ex_member") {
        await setMemberStatus(request.db, group.id, user.id, "active", null, null);
        return { groupId: group.id, rejoin: true };
      }
      return { groupId: group.id, alreadyMember: true };
    }
    if (!user.emailVerified) {
      const active = await countActiveMemberships(request.db, user.id);
      if (active >= 3) {
        throw forbidden("Verifica tu email para unirte a más de 3 grupos");
      }
    }
    await addMember(request.db, {
      groupId: group.id,
      userId: user.id,
      role: "member",
      status: "active",
    });
    return { groupId: group.id };
  });
};
