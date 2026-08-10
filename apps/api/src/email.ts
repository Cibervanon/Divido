import { randomBytes } from "node:crypto";
import type { Db } from "./db.js";
import { config, RESET_TOKEN_MS, VERIFY_TOKEN_MS } from "./config.js";
import { findUserByEmail, setResetToken, setVerifyToken } from "./store.js";

const RESEND_URL = "https://api.resend.com/emails";

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html: string
): Promise<boolean> {
  if (!config.resendApiKey) return false;
  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: config.emailFrom, to, subject, text, html }),
  });
  return res.ok;
}

export async function sendVerificationEmail(
  db: Db,
  email: string
): Promise<{ sent: boolean; alreadyVerified: boolean; verificationUrl: string | null; expiresAt: string | null }> {
  const user = await findUserByEmail(db, email);
  if (!user) return { sent: false, alreadyVerified: false, verificationUrl: null, expiresAt: null };
  if (user.email_verified) return { sent: false, alreadyVerified: true, verificationUrl: null, expiresAt: null };
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + VERIFY_TOKEN_MS).toISOString();
  await setVerifyToken(db, user.id, token, expires);
  const verificationUrl = `${config.webOrigin}/verify-email?token=${token}`;
  const sent = await sendEmail(
    user.email ?? email,
    "Verifica tu email en Divido",
    `Haz clic en este enlace para verificar tu email:\n${verificationUrl}`,
    `<p>Haz clic en <a href="${verificationUrl}">este enlace</a> para verificar tu email.</p>`
  );
  return { sent, alreadyVerified: false, verificationUrl, expiresAt: expires };
}

export async function sendPasswordResetEmail(
  db: Db,
  email: string
): Promise<{ sent: boolean; demoUrl: string | null }> {
  const user = await findUserByEmail(db, email);
  if (!user) return { sent: false, demoUrl: null };
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + RESET_TOKEN_MS).toISOString();
  await setResetToken(db, user.id, token, expires);
  const url = `${config.webOrigin}/reset-password?token=${token}`;
  const sent = await sendEmail(
    user.email ?? email,
    "Restablece tu contraseña en Divido",
    `Haz clic en este enlace para restablecer tu contraseña:\n${url}`,
    `<p>Haz clic en <a href="${url}">este enlace</a> para restablecer tu contraseña.</p>`
  );
  return { sent, demoUrl: sent ? null : url };
}
