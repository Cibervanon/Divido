import { z } from "zod";

export const createExpenseSchema = z.object({
  description: z.string().trim().min(1, "La descripción es obligatoria").max(200),
  amount: z.number().positive("Importe inválido"),
  currency: z.string().length(3).optional(),
  exchangeRate: z.number().positive().optional(),
  participants: z.array(z.string().uuid()).min(1, "Debes seleccionar al menos un participante"),
  payerId: z.string().uuid().optional(),
  shares: z.record(z.string(), z.number().nonnegative()).optional(),
  paidFromPot: z.boolean().optional(),
  category: z.string().regex(/^[a-z0-9_-]{1,40}$/).optional(),
  iconName: z.string().regex(/^[a-z0-9-]{1,40}$/i).optional(),
  isCustomIcon: z.boolean().optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = z.object({
  description: z.string().trim().min(1).max(200).optional(),
  amount: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  exchangeRate: z.number().positive().optional(),
  participants: z.array(z.string().uuid()).min(1).optional(),
  payerId: z.string().uuid().nullable().optional(),
  shares: z.record(z.string(), z.number().nonnegative()).optional(),
  paidFromPot: z.boolean().optional(),
  category: z.string().regex(/^[a-z0-9_-]{1,40}$/).optional(),
  iconName: z.string().regex(/^[a-z0-9-]{1,40}$/i).optional(),
  isCustomIcon: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, "Al menos un campo debe ser proporcionado");

export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(100),
  currency: z.string().length(3).optional(),
  type: z.enum(["open", "closed"]).optional(),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  currency: z.string().length(3).optional(),
  type: z.enum(["open", "closed"]).optional(),
  simplifyDebts: z.boolean().optional(),
  logoUrl: z.string().url().nullable().optional(),
  enabledExtras: z.array(z.string()).optional(),
}).refine((data) => Object.keys(data).length > 0, "Al menos un campo debe ser proporcionado");

export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

export const createPaymentSchema = z.object({
  fromUserId: z.string().uuid(),
  toUserId: z.string().uuid(),
  amount: z.number().positive("Importe inválido"),
  note: z.string().max(500).optional(),
  proofUrl: z.string().url().optional().nullable(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const createPiqueSchema = z.object({
  kind: z.enum(["money", "prize"]),
  amount: z.number().nonnegative().optional(),
  prize: z.string().max(200).optional(),
  winnerIds: z.array(z.string().uuid()).min(1),
  loserIds: z.array(z.string().uuid()).min(1),
  title: z.string().trim().min(1).max(200),
}).refine((data) => data.kind !== "money" || (data.amount != null && data.amount > 0), {
  message: "Los piques de dinero requieren un importe positivo",
  path: ["amount"],
}).refine((data) => data.kind !== "prize" || data.prize?.trim(), {
  message: "Los piques de premio requieren una descripción",
  path: ["prize"],
});

export type CreatePiqueInput = z.infer<typeof createPiqueSchema>;

export const updateMemberSchema = z.object({
  role: z.enum(["admin", "member"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
}).refine((data) => Object.keys(data).length > 0, "Al menos un campo debe ser proporcionado");

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const createPotContributionSchema = z.object({
  userId: z.string().uuid().optional(),
  amount: z.number().positive("El importe debe ser positivo"),
  note: z.string().max(500).optional(),
  expenseId: z.string().uuid().optional(),
});

export type CreatePotContributionInput = z.infer<typeof createPotContributionSchema>;

export const createRecurringExpenseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  amount: z.number().positive(),
  currency: z.string().length(3).optional(),
  frequency: z.enum(["weekly", "monthly"]).optional(),
  responsibleId: z.string().uuid(),
  payerId: z.string().uuid().optional(),
  participants: z.array(z.string().uuid()).optional(),
  nextRunAt: z.string().optional(),
  autoCreate: z.boolean().optional(),
});

export type CreateRecurringExpenseInput = z.infer<typeof createRecurringExpenseSchema>;