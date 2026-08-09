export const config = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? "0.0.0.0",
  jwtSecret: process.env.JWT_SECRET ?? "divido-dev-secret-change-me",
  jwtExpiresIn: "30d",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  editWindowHours: 24,
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim()),
};

export const EDIT_WINDOW_MS = config.editWindowHours * 60 * 60 * 1000;
