import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { config } from "./config.js";
import { unauthorized } from "./errors.js";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ sub: user.id }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): { sub: string } {
  try {
    return jwt.verify(token, config.jwtSecret) as { sub: string };
  } catch {
    throw unauthorized("Sesión inválida o expirada");
  }
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<GoogleProfile> {
  if (!config.googleClientId || !config.googleClientSecret) {
    throw unauthorized("Google OAuth no está configurado en el servidor");
  }
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    throw unauthorized("No se pudo intercambiar el código de Google");
  }
  const tokens = (await tokenRes.json()) as { id_token?: string };
  if (!tokens.id_token) {
    throw unauthorized("Google no devolvió un id_token");
  }
  const payload = decodeJwtPayload(tokens.id_token);
  if (!payload?.email || !payload.sub) {
    throw unauthorized("Perfil de Google inválido");
  }
  return {
    sub: String(payload.sub),
    email: String(payload.email),
    name: typeof payload.name === "string" ? payload.name : undefined,
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
  };
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}

export function googleAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
