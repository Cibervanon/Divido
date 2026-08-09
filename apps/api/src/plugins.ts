import type { FastifyInstance, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import type { DatabaseSync } from "node:sqlite";
import type { AuthUser } from "./auth.js";
import { verifyToken } from "./auth.js";
import { findUserById, getGroup, getMemberRow, type MemberRow } from "./store.js";
import { forbidden, notFound, unauthorized } from "./errors.js";
import type { Group } from "@divido/shared";

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
    db: DatabaseSync;
  }
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  app.decorateRequest("user");
  app.addHook("preHandler", async (request) => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) return;
    try {
      const { sub } = verifyToken(header.slice(7));
      const row = findUserById(request.db, sub);
      if (row) {
        request.user = {
          id: row.id,
          email: row.email ?? "",
          name: row.name,
          avatarUrl: row.avatar_url,
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

export function requireGroup(request: FastifyRequest, groupId: string): Group {
  const group = getGroup(request.db, groupId);
  if (!group) throw notFound("Grupo no encontrado");
  return group;
}

export function requireActiveMember(
  request: FastifyRequest,
  groupId: string
): { member: MemberRow; group: Group } {
  const group = requireGroup(request, groupId);
  const user = requireAuth(request);
  const member = getMemberRow(request.db, groupId, user.id);
  if (!member) throw notFound("No eres miembro de este grupo");
  if (member.status !== "active") throw forbidden("Tu membresía en este grupo está inactiva");
  return { member, group };
}

export function requireAdmin(request: FastifyRequest, groupId: string): MemberRow {
  const { member } = requireActiveMember(request, groupId);
  if (member.role !== "admin") throw forbidden("Requiere rol de administrador");
  return member;
}

export function isActiveMember(request: FastifyRequest, groupId: string, userId: string): boolean {
  const member = getMemberRow(request.db, groupId, userId);
  return Boolean(member && member.status === "active");
}
