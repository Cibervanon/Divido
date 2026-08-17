import type { ZodSchema } from "zod";
import { badRequest } from "./errors.js";

export function parseBody<T>(schema: ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    throw badRequest(first?.message ?? "Datos inválidos");
  }
  return result.data;
}