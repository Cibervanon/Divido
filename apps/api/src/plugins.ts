import type { FastifyInstance, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import type { Db } from "./db.js";
import type { AuthUser } from "./auth.js";
import { verifyToken } from "./auth.js";
import { findUserById, getGroup, getMemberRow, type MemberRow } from "./store.js";
import { forbidden, notFound, unauthorized } from "./errors.js";
import type { Group } from "@divido/shared";

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
    db: Db;
  }
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  app.decorateRequest("user");
  app.addHook("preHandler", async (request) => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) return;
    try {
      const { sub } = verifyToken(header.slice(7));
      const row = await findUserById(request.db, sub);
      // Usuarios dados de baja: su sesión queda revocada de facto.
      if (row && !Number(row.deleted)) {
        request.user = {
          id: row.id,
          email: row.email ?? "",
          name: row.name,
          avatarUrl: row.avatar_url,
          emailVerified: Boolean(row.email_verified),
          phone: row.phone,
          revolut: row.revolut,
          paypal: row.paypal,
        };
      }
    } catch {
      // Token inválido: dejamos al usuario como anónimo.
    }
  });
});

export function requireAuth(request: FastifyRequest): AuthUser {
  if (!request.user) throw unauthorized();
  return request.user;
}

export async function requireGroup(request: FastifyRequest, groupId: string): Promise<Group> {
  const group = await getGroup(request.db, groupId);
  if (!group) throw notFound("Grupo no encontrado");
  return group;
}

export async function requireActiveMember(
  request: FastifyRequest,
  groupId: string
): Promise<{ member: MemberRow; group: Group }> {
  const group = await requireGroup(request, groupId);
  const user = requireAuth(request);
  const member = await getMemberRow(request.db, groupId, user.id);
  if (!member) throw notFound("No eres miembro de este grupo");
  if (member.status !== "active") throw forbidden("Tu membresía en este grupo está inactiva");
  return { member, group };
}

export async function requireAdmin(request: FastifyRequest, groupId: string): Promise<MemberRow> {
  const { member } = await requireActiveMember(request, groupId);
  if (member.role !== "admin") throw forbidden("Requiere rol de administrador");
  return member;
}

export async function isActiveMember(request: FastifyRequest, groupId: string, userId: string): Promise<boolean> {
  const member = await getMemberRow(request.db, groupId, userId);
  return Boolean(member && member.status === "active");
}
