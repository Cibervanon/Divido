import type { FastifyPluginAsync } from "fastify";
import {
  createUser,
  findUserByEmail,
  findUserByGoogleSub,
  findUserById,
  linkGoogleToUser,
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
    if (findUserByEmail(request.db, normalized)) throw conflict("Ya existe una cuenta con ese email");
    const user = createUser(request.db, {
      email: normalized,
      passwordHash: hashPassword(password),
      name: name.trim(),
    });
    return { token: signToken(toAuthUser(user)), user: toAuthUser(user) };
  });

  app.post("/api/auth/login", async (request) => {
    const { email, password } = request.body as { email?: string; password?: string };
    if (!email || !password) throw badRequest("Email y contraseña son obligatorios");
    const user = findUserByEmail(request.db, email.toLowerCase().trim());
    if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
      throw unauthorized("Credenciales incorrectas");
    }
    return { token: signToken(toAuthUser(user)), user: toAuthUser(user) };
  });

  app.get("/api/auth/me", async (request) => {
    const user = requireAuth(request);
    return { user };
  });

  app.get("/api/auth/google/url", async (request) => {
    const redirectUri =
      ((request.query as { redirect_uri?: string }).redirect_uri) ??
      "http://localhost:5173/auth/google/callback";
    return { url: googleAuthUrl(redirectUri) };
  });

  app.post("/api/auth/google", async (request) => {
    const { code, redirect_uri } = request.body as { code?: string; redirect_uri?: string };
    if (!code) throw badRequest("Falta el código de autorización");
    const profile = await exchangeGoogleCode(code, redirect_uri ?? "http://localhost:5173/auth/google/callback");
    const existingBySub = findUserByGoogleSub(request.db, profile.sub);
    if (existingBySub) {
      return { token: signToken(toAuthUser(existingBySub)), user: toAuthUser(existingBySub) };
    }
    const existingByEmail = profile.email ? findUserByEmail(request.db, profile.email) : undefined;
    if (existingByEmail) {
      linkGoogleToUser(request.db, existingByEmail.id, profile.sub, profile.picture);
      return { token: signToken(toAuthUser(existingByEmail)), user: toAuthUser(existingByEmail) };
    }
    const user = createUser(request.db, {
      email: profile.email,
      name: profile.name ?? profile.email.split("@")[0],
      avatarUrl: profile.picture,
      googleSub: profile.sub,
    });
    return { token: signToken(toAuthUser(user)), user: toAuthUser(user) };
  });
};

function toAuthUser(user: {
  id: string;
  email: string | null;
  name: string;
  avatar_url: string | null;
}) {
  return {
    id: user.id,
    email: user.email ?? "",
    name: user.name,
    avatarUrl: user.avatar_url,
  };
}
