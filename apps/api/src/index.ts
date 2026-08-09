import Fastify from "fastify";
import cors from "@fastify/cors";
import { createDb, initDb } from "./db.js";
import { config } from "./config.js";
import { authPlugin } from "./plugins.js";
import { HttpError } from "./errors.js";
import { authRoutes } from "./routes/auth.js";
import { groupRoutes } from "./routes/groups.js";
import { joinRoutes } from "./routes/join.js";
import { expenseRoutes } from "./routes/expenses.js";
import { paymentRoutes } from "./routes/payments.js";
import { requestRoutes } from "./routes/requests.js";
import { balanceRoutes } from "./routes/balances.js";
import { userRoutes } from "./routes/users.js";

export async function buildApp(db = createDb(config.databaseUrl)) {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });

  app.decorateRequest("db", { getter: () => db });

  await initDb(db);

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
  app.register(groupRoutes);
  app.register(expenseRoutes);
  app.register(paymentRoutes);
  app.register(requestRoutes);
  app.register(balanceRoutes);
  app.register(userRoutes);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.status).send({ error: error.message, code: error.code });
    }
    request.log.error(error);
    return reply.code(500).send({ error: "Error interno del servidor", code: "INTERNAL" });
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
