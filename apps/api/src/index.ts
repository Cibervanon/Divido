import Fastify from "fastify";
import cors from "@fastify/cors";
import { openDb } from "./db.js";
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

export function buildApp(db = openDb()) {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });

  app.decorateRequest("db", { getter: () => db });

  app.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
  });

  app.register(authPlugin);

  app.get("/api/health", async () => ({ ok: true, time: new Date().toISOString() }));

  app.register(authRoutes);
  app.register(joinRoutes);
  app.register(groupRoutes);
  app.register(expenseRoutes);
  app.register(paymentRoutes);
  app.register(requestRoutes);
  app.register(balanceRoutes);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.status).send({ error: error.message, code: error.code });
    }
    request.log.error(error);
    return reply.code(500).send({ error: "Error interno del servidor", code: "INTERNAL" });
  });

  app.addHook("onClose", () => db.close());

  return app;
}

async function main() {
  const app = buildApp();
  try {
    await app.listen({ port: config.port, host: config.host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
