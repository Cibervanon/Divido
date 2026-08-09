import type { FastifyPluginAsync } from "fastify";
import {
  addMember,
  getGroupByInviteToken,
  getMemberRow,
  listMembers,
  setMemberStatus,
} from "../store.js";
import type { InvitePreview } from "@divido/shared";
import { notFound } from "../errors.js";
import { requireAuth } from "../plugins.js";

export const joinRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/join/:token", async (request) => {
    const { token } = request.params as { token: string };
    const group = getGroupByInviteToken(request.db, token);
    if (!group) throw notFound("Enlace de invitación inválido o caducado");
    const memberCount = listMembers(request.db, group.id).filter((m) => m.status === "active").length;
    const existingMember = Boolean(request.user && getMemberRow(request.db, group.id, request.user.id));
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
    const group = getGroupByInviteToken(request.db, token);
    if (!group) throw notFound("Enlace de invitación inválido o caducado");
    const existing = getMemberRow(request.db, group.id, user.id);
    if (existing) {
      if (existing.status === "ex_member") {
        setMemberStatus(request.db, group.id, user.id, "active", null, null);
        return { groupId: group.id, rejoin: true };
      }
      return { groupId: group.id, alreadyMember: true };
    }
    addMember(request.db, {
      groupId: group.id,
      userId: user.id,
      role: "member",
      status: "active",
    });
    return { groupId: group.id };
  });
};
