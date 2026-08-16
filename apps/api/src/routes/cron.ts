import type { FastifyPluginAsync } from "fastify";
import { processRecurringExpenses } from "../recurring.js";
import { unauthorized } from "../errors.js";
import { config } from "../config.js";

export const cronRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/cron/process-recurring", async (request) => {
    if (config.cronSecret) {
      const header = request.headers["x-cron-secret"] ?? request.headers.authorization?.replace(/^Bearer /i, "");
      if (header !== config.cronSecret) throw unauthorized("Acceso denegado");
    }
    const result = await processRecurringExpenses(request.db);
    return { ok: true, ...result };
  });
};
