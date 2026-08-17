try {
  process.loadEnvFile();
} catch {
  // Sin archivo .env: usamos las variables de entorno del sistema.
}

const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET es obligatorio en producción");
  }
  if (!process.env.CRON_SECRET) {
    throw new Error("CRON_SECRET es obligatorio en producción");
  }
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    throw new Error("VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY son obligatorios en producción");
  }
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? "0.0.0.0",
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret: isProduction ? process.env.JWT_SECRET! : (process.env.JWT_SECRET ?? "divido-dev-secret-change-me"),
  jwtExpiresIn: "30d",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  editWindowHours: 24,
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
  verifyTokenHours: 24,
  resetTokenHours: 24,
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim()),
  cronSecret: process.env.CRON_SECRET ?? "",
};

export const EDIT_WINDOW_MS = config.editWindowHours * 60 * 60 * 1000;
export const VERIFY_TOKEN_MS = config.verifyTokenHours * 60 * 60 * 1000;
export const RESET_TOKEN_MS = config.resetTokenHours * 60 * 60 * 1000;
