import { randomUUID } from "node:crypto";
import type { Db } from "./db.js";

export async function logAudit(
  db: Db,
  params: {
    groupId: string;
    entityType: "expense" | "payment" | "informal_debt" | "modification_request";
    entityId: string;
    action: "created" | "updated" | "deleted" | "approved" | "rejected" | "edited" | "cancelled" | "auto_accepted";
    actorId: string;
    actorName: string;
    before?: unknown;
    after?: unknown;
  }
) {
  const diff = JSON.stringify({ before: params.before ?? null, after: params.after ?? null });
  await db
    .prepare(
      `INSERT INTO audit_log (id, group_id, entity_type, entity_id, action, actor_id, actor_name, diff, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      randomUUID(),
      params.groupId,
      params.entityType,
      params.entityId,
      params.action,
      params.actorId,
      params.actorName,
      diff,
      new Date().toISOString()
    );
}

export interface AuditEntry {
  id: string;
  group_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string;
  actor_name: string;
  diff: string | null;
  created_at: string;
}