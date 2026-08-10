try {
  process.loadEnvFile();
} catch {
  // Sin archivo .env: usamos las variables de entorno del sistema.
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? "0.0.0.0",
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "divido-dev-secret-change-me",
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
};

export const EDIT_WINDOW_MS = config.editWindowHours * 60 * 60 * 1000;
export const VERIFY_TOKEN_MS = config.verifyTokenHours * 60 * 60 * 1000;
export const RESET_TOKEN_MS = config.resetTokenHours * 60 * 60 * 1000;
