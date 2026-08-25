import Fastify from "fastify";
import path from "node:path";
import { pathToFileURL } from "node:url";
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
import { startAutoAcceptScheduler } from "./jobs/autoAccept.js";

const CRON_INTERVAL_MS = 15 * 60 * 1000;

export async function buildApp(
  db = createDb(config.databaseUrl),
  opts: { migrations?: boolean } = {}
) {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });

  app.decorateRequest("db", { getter: () => db });

  await initDb(db, opts);

  await app.register(helmet);
  await app.register(rateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX ?? 100),
    timeWindow: "1 minute",
  });

  app.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
  });

  app.register(authPlugin);

  // Observabilidad básica: línea JSON estructurada por petición API con
  // duración, para poder derivar p50/p95 desde los logs agregados.
  app.addHook("onResponse", async (request, reply) => {
    const url = request.raw.url ?? "";
    if (!url.startsWith("/api")) return;
    request.log.info(
      {
        method: request.method,
        url,
        statusCode: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime * 100) / 100,
      },
      "api_request"
    );
  });

  app.get("/api/health", async () => {
    await db.ping();
    return { ok: true, time: new Date().toISOString() };
  });

  app.get("/api/debug/cache-metrics", async () => {
    const { getCacheMetrics } = await import("./cache.js");
    const { getBalanceCacheMetrics } = await import("./balanceCache.js");
    return {
      expenses: getCacheMetrics(),
      balances: getBalanceCacheMetrics(),
    };
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

  startAutoAcceptScheduler(config.databaseUrl);

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

// Solo arranca el servidor cuando este archivo es el punto de entrada
// (permite importar buildApp desde tests sin abrir puertos ni requerir BD).
const isEntrypoint =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isEntrypoint) {
  main();
}
