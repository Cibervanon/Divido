import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import helmet from "@fastify/helmet";
import { createDb, initDb } from "./db.js";
import { config } from "./config.js";
import { authPlugin } from "./plugins.js";
import { HttpError } from "./errors.js";
import { authRoutes } from "./routes/auth.js";
import { groupRoutes } from "./routes/groups.js";
import { joinRoutes } from "./routes/join.js";
import { claimRoutes } from "./routes/claim.js";
import { expenseRoutes } from "./routes/expenses.js";
import { paymentRoutes } from "./routes/payments.js";
import { requestRoutes } from "./routes/requests.js";
import { balanceRoutes } from "./routes/balances.js";
import { userRoutes } from "./routes/users.js";
import { notificationRoutes } from "./routes/notifications.js";
import { cronRoutes } from "./routes/cron.js";
import { exportRoutes } from "./routes/exports.js";
import { processRecurringExpenses } from "./recurring.js";

const CRON_INTERVAL_MS = 15 * 60 * 1000;

export async function buildApp(db = createDb(config.databaseUrl)) {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });

  app.decorateRequest("db", { getter: () => db });

  await initDb(db);

  await app.register(helmet);
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });

  app.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
  });

  app.register(authPlugin);

  app.get("/api/health", async () => {
    await db.ping();
    return { ok: true, time: new Date().toISOString() };
  });

  app.register(authRoutes);
  app.register(joinRoutes);
  app.register(claimRoutes);
  app.register(groupRoutes);
  app.register(expenseRoutes);
  app.register(paymentRoutes);
  app.register(requestRoutes);
  app.register(balanceRoutes);
  app.register(userRoutes);
app.register(notificationRoutes);
app.register(cronRoutes);
app.register(exportRoutes);

  const recurringTimer = setInterval(() => {
    processRecurringExpenses(db).catch((err) => {
      app.log.error({ err }, "Recurring expenses processing failed");
    });
  }, CRON_INTERVAL_MS);
  recurringTimer.unref();

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      request.log.warn({ code: error.code, reqId: request.id }, error.message);
      return reply.code(error.status).send({ error: error.message, code: error.code, reqId: request.id });
    }
    request.log.error({ err: error, reqId: request.id });
    return reply.code(500).send({ error: "Error interno del servidor", code: "INTERNAL", reqId: request.id });
  });

  app.addHook("onClose", async () => {
    await db.close();
  });

  return app;
}

async function main() {
  const app = await buildApp();
  try {
    await app.listen({ port: config.port, host: config.host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
