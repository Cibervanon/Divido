import type { FastifyPluginAsync } from "fastify";
import { updateUser } from "../store.js";
import { badRequest } from "../errors.js";
import { requireAuth } from "../plugins.js";
import { sendVerificationEmail } from "../email.js";

const HTTP_URL_RE = /^https?:\/\//i;
const DATA_IMAGE_RE = /^data:image\/[a-z+]+;base64,/i;
const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

const PHONE_RE = /^[0-9+\s().-]{5,20}$/;
const USERNAME_RE = /^[A-Za-z0-9_.-]{2,50}$/;

function normalizeHandle(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (value === "") return null;
  const cleaned = value.replace(/^@/, "").replace(/^https?:\/\/(revolut\.me|paypal\.me)\//i, "").split("?")[0];
  if (!USERNAME_RE.test(cleaned)) throw badRequest("El usuario solo puede contener letras, números y . _ -");
  return cleaned;
}

export const userRoutes: FastifyPluginAsync = async (app) => {
  app.patch("/api/users/me", async (request) => {
    const user = requireAuth(request);
    const body = request.body as {
      name?: string;
      avatarUrl?: string | null;
      phone?: string | null;
      revolut?: string | null;
      paypal?: string | null;
    };
    const patch: {
      name?: string;
      avatarUrl?: string | null;
      phone?: string | null;
      revolut?: string | null;
      paypal?: string | null;
    } = {};

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

    if (body.phone !== undefined) {
      const phone = body.phone?.trim() ?? "";
      if (phone !== "" && !PHONE_RE.test(phone)) throw badRequest("Número de teléfono inválido");
      patch.phone = phone === "" ? null : phone;
    }

    if (body.revolut !== undefined) patch.revolut = normalizeHandle(body.revolut);
    if (body.paypal !== undefined) patch.paypal = normalizeHandle(body.paypal);

    if (Object.keys(patch).length === 0) throw badRequest("Sin cambios");
    const updated = await updateUser(request.db, user.id, patch);
    return { user: toPublicUser(updated) };
  });

  app.post("/api/users/me/send-verification-email", async (request) => {
    const user = requireAuth(request);
    if (user.emailVerified) return { alreadyVerified: true };
    if (!user.email) throw badRequest("Tu cuenta no tiene email asociado");
    const result = await sendVerificationEmail(request.db, user.email);
    return {
      alreadyVerified: result.alreadyVerified,
      sent: result.sent,
      verificationUrl: result.verificationUrl,
      expiresAt: result.expiresAt,
    };
  });
};

function toPublicUser(user: {
  id: string;
  email: string | null;
  name: string;
  avatar_url: string | null;
  email_verified: number;
  phone: string | null;
  revolut: string | null;
  paypal: string | null;
}) {
  return {
    id: user.id,
    email: user.email ?? "",
    name: user.name,
    avatarUrl: user.avatar_url,
    emailVerified: Boolean(user.email_verified),
    phone: user.phone,
    revolut: user.revolut,
    paypal: user.paypal,
  };
}
