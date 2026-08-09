import { randomBytes } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { setVerifyToken, updateUser } from "../store.js";
import { badRequest } from "../errors.js";
import { requireAuth } from "../plugins.js";
import { config } from "../config.js";

const HTTP_URL_RE = /^https?:\/\//i;
const DATA_IMAGE_RE = /^data:image\/[a-z+]+;base64,/i;
const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

export const userRoutes: FastifyPluginAsync = async (app) => {
  app.patch("/api/users/me", async (request) => {
    const user = requireAuth(request);
    const body = request.body as { name?: string; avatarUrl?: string | null };
    const patch: { name?: string; avatarUrl?: string | null } = {};

    if (body.name !== undefined) {
      if (!body.name.trim()) throw badRequest("El nombre no puede estar vacío");
      patch.name = body.name.trim().slice(0, 80);
    }

    if (body.avatarUrl !== undefined) {
      const url = (body.avatarUrl ?? "").trim();
      if (url === "") {
        patch.avatarUrl = null;
      } else if (HTTP_URL_RE.test(url)) {
        patch.avatarUrl = url.slice(0, 2048);
      } else if (DATA_IMAGE_RE.test(url)) {
        const size = Math.ceil((url.length - url.indexOf(",") - 1) * 0.75);
        if (size > MAX_AVATAR_BYTES) {
          throw badRequest("La imagen es demasiado grande (máximo 4 MB)");
        }
        patch.avatarUrl = url;
      } else {
        throw badRequest("URL de avatar inválida");
      }
    }

    if (Object.keys(patch).length === 0) throw badRequest("Sin cambios");
    const updated = updateUser(request.db, user.id, patch);
    return { user: toPublicUser(updated) };
  });

  app.post("/api/users/me/send-verification-email", async (request) => {
    const user = requireAuth(request);
    if (user.emailVerified) return { alreadyVerified: true };
    if (!user.email) throw badRequest("Tu cuenta no tiene email asociado");
    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    setVerifyToken(request.db, user.id, token, expires);
    return {
      verificationUrl: `${config.webOrigin}/verify-email?token=${token}`,
      expiresAt: expires,
    };
  });
};

function toPublicUser(user: {
  id: string;
  email: string | null;
  name: string;
  avatar_url: string | null;
  email_verified: number;
}) {
  return {
    id: user.id,
    email: user.email ?? "",
    name: user.name,
    avatarUrl: user.avatar_url,
    emailVerified: Boolean(user.email_verified),
  };
}
