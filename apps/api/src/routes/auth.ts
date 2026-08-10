import type { FastifyPluginAsync } from "fastify";
import {
  createUser,
  findUserByEmail,
  findUserByGoogleSub,
  findUserById,
  findUserByResetToken,
  findUserByVerifyToken,
  linkGoogleToUser,
  markEmailVerified,
  updatePassword,
} from "../store.js";
import {
  exchangeGoogleCode,
  googleAuthUrl,
  hashPassword,
  signToken,
  verifyPassword,
} from "../auth.js";
import { badRequest, conflict, unauthorized } from "../errors.js";
import { requireAuth } from "../plugins.js";
import { config } from "../config.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../email.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/auth/register", async (request) => {
    const { email, password, name } = request.body as {
      email?: string;
      password?: string;
      name?: string;
    };
    if (!email || !EMAIL_RE.test(email)) throw badRequest("Email inválido");
    if (!password || password.length < 6) throw badRequest("La contraseña debe tener al menos 6 caracteres");
    if (!name?.trim()) throw badRequest("El nombre es obligatorio");
    const normalized = email.toLowerCase().trim();
    if (await findUserByEmail(request.db, normalized)) throw conflict("Ya existe una cuenta con ese email");
    const user = await createUser(request.db, {
      email: normalized,
      passwordHash: hashPassword(password),
      name: name.trim(),
    });
    const verification = await sendVerificationEmail(request.db, normalized);
    return {
      token: signToken(toAuthUser(user)),
      user: toAuthUser(user),
      emailSent: verification.sent,
      verificationUrl: verification.verificationUrl,
    };
  });

  app.post("/api/auth/login", async (request) => {
    const { email, password } = request.body as { email?: string; password?: string };
    if (!email || !password) throw badRequest("Email y contraseña son obligatorios");
    const user = await findUserByEmail(request.db, email.toLowerCase().trim());
    if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
      throw unauthorized("Credenciales incorrectas");
    }
    return { token: signToken(toAuthUser(user)), user: toAuthUser(user) };
  });

  app.post("/api/auth/forgot-password", async (request) => {
    const { email } = request.body as { email?: string };
    if (!email) throw badRequest("El email es obligatorio");
    await sendPasswordResetEmail(request.db, email.toLowerCase().trim());
    return { ok: true };
  });

  app.post("/api/auth/reset-password", async (request) => {
    const { token, password } = request.body as { token?: string; password?: string };
    if (!token) throw badRequest("Falta el token de restablecimiento");
    if (!password || password.length < 6) {
      throw badRequest("La contraseña debe tener al menos 6 caracteres");
    }
    const user = await findUserByResetToken(request.db, token);
    if (!user || !user.reset_token_expires || new Date(user.reset_token_expires).getTime() < Date.now()) {
      throw badRequest("Enlace de restablecimiento inválido o expirado");
    }
    await updatePassword(request.db, user.id, hashPassword(password));
    return { ok: true };
  });

  app.get("/api/auth/me", async (request) => {
    const user = requireAuth(request);
    return { user };
  });

  app.post("/api/auth/verify-email", async (request) => {
    const { token } = request.body as { token?: string };
    if (!token) throw badRequest("Falta el token de verificación");
    const user = await findUserByVerifyToken(request.db, token);
    if (!user || !user.verify_token_expires || new Date(user.verify_token_expires).getTime() < Date.now()) {
      throw badRequest("Enlace de verificación inválido o expirado");
    }
    await markEmailVerified(request.db, user.id);
    return { ok: true };
  });

  app.get("/api/auth/google/url", async (request) => {
    const redirectUri =
      ((request.query as { redirect_uri?: string }).redirect_uri) ??
      `${config.webOrigin}/auth/google/callback`;
    return { url: googleAuthUrl(redirectUri) };
  });

  app.post("/api/auth/google", async (request) => {
    const { code, redirect_uri } = request.body as { code?: string; redirect_uri?: string };
    if (!code) throw badRequest("Falta el código de autorización");
    const profile = await exchangeGoogleCode(code, redirect_uri ?? `${config.webOrigin}/auth/google/callback`);
    const existingBySub = await findUserByGoogleSub(request.db, profile.sub);
    if (existingBySub) {
      const user = await markEmailVerified(request.db, existingBySub.id);
      return { token: signToken(toAuthUser(user)), user: toAuthUser(user) };
    }
    const existingByEmail = profile.email ? await findUserByEmail(request.db, profile.email) : undefined;
    if (existingByEmail) {
      await linkGoogleToUser(request.db, existingByEmail.id, profile.sub, profile.picture);
      const user = await markEmailVerified(request.db, existingByEmail.id);
      return { token: signToken(toAuthUser(user)), user: toAuthUser(user) };
    }
    const created = await createUser(request.db, {
      email: profile.email,
      name: profile.name ?? profile.email.split("@")[0],
      avatarUrl: profile.picture,
      googleSub: profile.sub,
    });
    const user = await markEmailVerified(request.db, created.id);
    return { token: signToken(toAuthUser(user)), user: toAuthUser(user) };
  });
};

function toAuthUser(user: {
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
