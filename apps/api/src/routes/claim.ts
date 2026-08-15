import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import {
  claimGhostUser,
  findMembershipByClaimToken,
  getMemberRow,
  setMembershipClaimToken,
} from "../store.js";
import { badRequest, notFound } from "../errors.js";
import { requireActiveMember, requireAdmin, requireAuth } from "../plugins.js";
import { config } from "../config.js";

export const claimRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/groups/:groupId/claim-ghost", async (request) => {
    const { groupId } = request.params as { groupId: string };
    const user = requireAuth(request);
    await requireActiveMember(request, groupId);
    const { ghostUserId } = request.body as { ghostUserId?: string };
    if (!ghostUserId) throw badRequest("Falta el miembro a reclamar");
    if (ghostUserId === user.id) throw badRequest("No puedes reclamar tu propio perfil");
    const ghost = await getMemberRow(request.db, groupId, ghostUserId);
    if (!ghost || ghost.status !== "active" || !ghost.is_ghost) {
      throw notFound("Miembro sin cuenta no encontrado");
    }
    await claimGhostUser(request.db, ghostUserId, user.id);
    return { ok: true, groupId };
  });

  app.post("/api/groups/:groupId/ghost-members/:ghostUserId/claim-token", async (request) => {
    const { groupId, ghostUserId } = request.params as { groupId: string; ghostUserId: string };
    await requireAdmin(request, groupId);
    const ghost = await getMemberRow(request.db, groupId, ghostUserId);
    if (!ghost || ghost.status !== "active" || !ghost.is_ghost) {
      throw notFound("Miembro sin cuenta no encontrado");
    }
    const token = randomUUID().replace(/-/g, "").slice(0, 20);
    await setMembershipClaimToken(request.db, groupId, ghostUserId, token);
    return { claimUrl: `${config.webOrigin}/claim/${token}` };
  });

  app.get("/api/claim/:token", async (request) => {
    const { token } = request.params as { token: string };
    const row = await findMembershipByClaimToken(request.db, token);
    if (!row) throw notFound("Enlace de reclamación inválido o ya utilizado");
    return {
      preview: {
        groupId: row.group_id,
        groupName: row.group_name,
        currency: row.currency,
        ghostName: row.user_name,
      },
    };
  });

  app.post("/api/claim/:token", async (request) => {
    const { token } = request.params as { token: string };
    const user = requireAuth(request);
    const row = await findMembershipByClaimToken(request.db, token);
    if (!row) throw notFound("Enlace de reclamación inválido o ya utilizado");
    if (row.user_id === user.id) throw badRequest("Este perfil ya es tuyo");
    await claimGhostUser(request.db, row.user_id, user.id);
    return { ok: true, groupId: row.group_id };
  });
};
