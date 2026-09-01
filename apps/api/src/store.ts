import { randomUUID } from "node:crypto";
import type {
  Group,
  GroupMember,
  GroupType,
  InformalDebt,
  InformalDebtStatus,
  MemberRole,
  MemberStatus,
  PaymentStatus,
  PiqueKind,
} from "@divido/shared";
import type { Db, SqlValue } from "./db.js";

export type Row = Record<string, unknown>;

export interface UserRow {
  id: string;
  email: string | null;
  password_hash: string | null;
  name: string;
  avatar_url: string | null;
  google_sub: string | null;
  email_verified: number;
  is_ghost: number;
  phone: string | null;
  revolut: string | null;
  paypal: string | null;
  verify_token: string | null;
  verify_token_expires: string | null;
  reset_token: string | null;
  reset_token_expires: string | null;
  pinned_group_ids: string;
  auto_confirm_payments: number;
  deleted: number;
  created_at: string;
}

export interface GroupRow {
  id: string;
  name: string;
  currency: string;
  type: GroupType;
  invite_token: string;
  creator_id: string;
  logo_url: string | null;
  enabled_extras: string;
  simplify_debts: number;
  created_at: string;
}

export interface MembershipRow {
  group_id: string;
  user_id: string;
  role: MemberRole;
  status: MemberStatus;
  joined_at: string;
  left_at: string | null;
  frozen_balance: number | null;
  claim_token: string | null;
}

export interface MemberRow extends MembershipRow {
  name: string;
  email: string | null;
  avatar_url: string | null;
  email_verified: number;
  is_ghost: number;
  phone: string | null;
  revolut: string | null;
  paypal: string | null;
}

export interface ExpenseRow {
  id: string;
  group_id: string;
  payer_id: string | null;
  description: string;
  amount: number;
  currency: string;
  exchange_rate: number;
  amount_group: number;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  deleted: number;
  paid_from_pot: number;
  receipt_url: string | null;
  category: string;
  icon_name: string;
  is_custom_icon: number;
  payer_name: string | null;
}

export interface PaymentRow {
  id: string;
  group_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  note: string | null;
  proof_url: string | null;
  status: string;
  created_by_id: string;
  created_at: string;
  auto_accept_at: string | null;
  from_name: string;
  to_name: string;
}

export interface RequestRow {
  id: string;
  group_id: string;
  expense_id: string;
  requester_id: string;
  action: "edit" | "delete";
  payload: string;
  status: string;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
  requester_name: string;
}

export function toGroup(r: GroupRow): Group {
  return {
    id: r.id,
    name: r.name,
    currency: r.currency,
    type: r.type === "closed" ? "closed" : "open",
    inviteToken: r.invite_token,
    creatorId: r.creator_id,
    logoUrl: r.logo_url,
    enabledExtras: parseExtras(r.enabled_extras),
    simplifyDebts: Boolean(r.simplify_debts),
    createdAt: r.created_at,
  };
}

function parseExtras(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

export function parseStringArray(raw: string | null | undefined): string[] {
  return parseExtras(raw);
}

export function toMember(r: MemberRow): GroupMember {
  return {
    groupId: r.group_id,
    userId: r.user_id,
    role: r.role,
    status: r.status,
    joinedAt: r.joined_at,
    leftAt: r.left_at,
    frozenBalance: r.frozen_balance,
  };
}

// ---------- Users ----------

export async function findUserById(db: Db, id: string): Promise<UserRow | undefined> {
  return (await db.prepare("SELECT * FROM users WHERE id = ?").get(id)) as UserRow | undefined;
}

export async function findUserByEmail(db: Db, email: string): Promise<UserRow | undefined> {
  return (await db.prepare("SELECT * FROM users WHERE email = ?").get(email)) as UserRow | undefined;
}

export async function findUserByGoogleSub(db: Db, sub: string): Promise<UserRow | undefined> {
  return (await db.prepare("SELECT * FROM users WHERE google_sub = ?").get(sub)) as UserRow | undefined;
}

export async function findUserByVerifyToken(db: Db, token: string): Promise<UserRow | undefined> {
  return (await db.prepare("SELECT * FROM users WHERE verify_token = ?").get(token)) as UserRow | undefined;
}

export async function findUserByResetToken(db: Db, token: string): Promise<UserRow | undefined> {
  return (await db.prepare("SELECT * FROM users WHERE reset_token = ?").get(token)) as UserRow | undefined;
}

/** Grupos en los que el usuario tiene membresía activa. */
export async function listUserActiveGroupIds(db: Db, userId: string): Promise<string[]> {
  const rows = await db
    .prepare(`SELECT group_id FROM group_members WHERE user_id = ? AND status = 'active'`)
    .all(userId);
  return rows.map((r) => String(r.group_id));
}

/**
 * Baja de cuenta (GDPR): elimina todos los datos personales conservando la
 * integridad contable (la fila sobrevive porque gastos/pagos/audit la referencian).
 * El flag `deleted` revoca de facto cualquier sesión abierta.
 */
export async function anonymizeUser(db: Db, userId: string): Promise<void> {
  await db
    .prepare(
      `UPDATE users SET
        email = NULL, password_hash = NULL, name = 'Usuario eliminado',
        avatar_url = NULL, google_sub = NULL, email_verified = 0,
        phone = NULL, revolut = NULL, paypal = NULL,
        verify_token = NULL, verify_token_expires = NULL,
        reset_token = NULL, reset_token_expires = NULL,
        pinned_group_ids = '[]', deleted = 1
       WHERE id = ?`
    )
    .run(userId);
  await db.prepare("DELETE FROM push_subscriptions WHERE user_id = ?").run(userId);
  await db.prepare("DELETE FROM notifications WHERE user_id = ?").run(userId);
}

export async function updateUser(
  db: Db,
  userId: string,
  patch: {
    name?: string;
    avatarUrl?: string | null;
    phone?: string | null;
    revolut?: string | null;
    paypal?: string | null;
    pinnedGroupIds?: string[];
    autoConfirmPayments?: boolean;
  }
): Promise<UserRow> {
  const current = (await findUserById(db, userId))!;
  await db
    .prepare(
      "UPDATE users SET name = ?, avatar_url = ?, phone = ?, revolut = ?, paypal = ?, pinned_group_ids = ?, auto_confirm_payments = ? WHERE id = ?"
    )
    .run(
      patch.name?.trim() ?? current.name,
      patch.avatarUrl === undefined ? current.avatar_url : patch.avatarUrl,
      patch.phone === undefined ? current.phone : patch.phone,
      patch.revolut === undefined ? current.revolut : patch.revolut,
      patch.paypal === undefined ? current.paypal : patch.paypal,
      patch.pinnedGroupIds === undefined ? current.pinned_group_ids : JSON.stringify(patch.pinnedGroupIds),
      patch.autoConfirmPayments === undefined ? current.auto_confirm_payments : patch.autoConfirmPayments ? 1 : 0,
      userId
    );
  return (await findUserById(db, userId))!;
}

export async function setVerifyToken(
  db: Db,
  userId: string,
  token: string,
  expires: string
): Promise<void> {
  await db.prepare("UPDATE users SET verify_token = ?, verify_token_expires = ? WHERE id = ?").run(
    token,
    expires,
    userId
  );
}

export async function setResetToken(
  db: Db,
  userId: string,
  token: string,
  expires: string
): Promise<void> {
  await db.prepare("UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?").run(
    token,
    expires,
    userId
  );
}

export async function updatePassword(db: Db, userId: string, passwordHash: string): Promise<void> {
  await db
    .prepare("UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?")
    .run(passwordHash, userId);
}

export async function markEmailVerified(db: Db, userId: string): Promise<UserRow> {
  await db
    .prepare("UPDATE users SET email_verified = 1, verify_token = NULL, verify_token_expires = NULL WHERE id = ?")
    .run(userId);
  return (await findUserById(db, userId))!;
}

export async function createUser(
  db: Db,
  input: {
    email: string | null;
    passwordHash?: string;
    name: string;
    avatarUrl?: string | null;
    googleSub?: string;
    isGhost?: boolean;
  }
): Promise<UserRow> {
  const id = randomUUID();
  await db
    .prepare(
      `INSERT INTO users (id, email, password_hash, name, avatar_url, google_sub, is_ghost, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.email,
      input.passwordHash ?? null,
      input.name,
      input.avatarUrl ?? null,
      input.googleSub ?? null,
      input.isGhost ? 1 : 0,
      new Date().toISOString()
    );
  return (await findUserById(db, id))!;
}

export async function createGhostUser(
  db: Db,
  input: { name: string; avatarUrl?: string | null }
): Promise<UserRow> {
  return createUser(db, { email: null, name: input.name, avatarUrl: input.avatarUrl, isGhost: true });
}

export async function claimGhostUser(db: Db, ghostId: string, realUserId: string): Promise<void> {
  if (ghostId === realUserId) return;

  await db.prepare("UPDATE expenses SET payer_id = ? WHERE payer_id = ?").run(realUserId, ghostId);
  await db.prepare("UPDATE expenses SET created_by_id = ? WHERE created_by_id = ?").run(realUserId, ghostId);
  await db.prepare("UPDATE expense_comments SET author_id = ? WHERE author_id = ?").run(realUserId, ghostId);
  await db
    .prepare(
      "DELETE FROM expense_participants WHERE user_id = ? AND expense_id IN (SELECT expense_id FROM expense_participants WHERE user_id = ?)"
    )
    .run(ghostId, realUserId);
  await db.prepare("UPDATE expense_participants SET user_id = ? WHERE user_id = ?").run(realUserId, ghostId);
  await db.prepare("UPDATE payments SET from_user_id = ? WHERE from_user_id = ?").run(realUserId, ghostId);
  await db.prepare("UPDATE payments SET to_user_id = ? WHERE to_user_id = ?").run(realUserId, ghostId);
  await db.prepare("UPDATE payments SET created_by_id = ? WHERE created_by_id = ?").run(realUserId, ghostId);
  await db.prepare("UPDATE modification_requests SET requester_id = ? WHERE requester_id = ?").run(realUserId, ghostId);
  await db.prepare("UPDATE informal_debts SET creator_id = ? WHERE creator_id = ?").run(realUserId, ghostId);
  await db.prepare("UPDATE informal_debts SET creditor_id = ? WHERE creditor_id = ?").run(realUserId, ghostId);
  await db.prepare("UPDATE informal_debts SET debtor_id = ? WHERE debtor_id = ?").run(realUserId, ghostId);
  await db
    .prepare("UPDATE informal_debts SET winner_ids = replace(winner_ids, ?, ?) WHERE winner_ids LIKE ?")
    .run(`"${ghostId}"`, `"${realUserId}"`, `%"${ghostId}"%`);
  await db
    .prepare("UPDATE informal_debts SET loser_ids = replace(loser_ids, ?, ?) WHERE loser_ids LIKE ?")
    .run(`"${ghostId}"`, `"${realUserId}"`, `%"${ghostId}"%`);
  await db.prepare("UPDATE group_events SET user_id = ? WHERE user_id = ?").run(realUserId, ghostId);
  await db.prepare("UPDATE groups SET creator_id = ? WHERE creator_id = ?").run(realUserId, ghostId);

  const ghostMemberships = (await db
    .prepare("SELECT group_id, status FROM group_members WHERE user_id = ?")
    .all(ghostId)) as unknown as Array<{ group_id: string; status: MemberStatus }>;
  for (const gm of ghostMemberships) {
    const existing = (await db
      .prepare("SELECT user_id, status FROM group_members WHERE group_id = ? AND user_id = ?")
      .get(gm.group_id, realUserId)) as { user_id: string; status: MemberStatus } | undefined;
    if (existing) {
      await db.prepare("DELETE FROM group_members WHERE group_id = ? AND user_id = ?").run(gm.group_id, ghostId);
      if (existing.status !== "active") {
        await db
          .prepare(
            "UPDATE group_members SET status = 'active', left_at = NULL, frozen_balance = NULL, claim_token = NULL WHERE group_id = ? AND user_id = ?"
          )
          .run(gm.group_id, realUserId);
      }
    } else {
      await db
        .prepare("UPDATE group_members SET user_id = ?, claim_token = NULL WHERE group_id = ? AND user_id = ?")
        .run(realUserId, gm.group_id, ghostId);
    }
  }

  await db.prepare("DELETE FROM users WHERE id = ?").run(ghostId);
}

export async function setMembershipClaimToken(
  db: Db,
  groupId: string,
  userId: string,
  token: string | null
): Promise<void> {
  await db.prepare("UPDATE group_members SET claim_token = ? WHERE group_id = ? AND user_id = ?").run(
    token,
    groupId,
    userId
  );
}

export interface MembershipClaimRow {
  group_id: string;
  user_id: string;
  role: MemberRole;
  status: MemberStatus;
  joined_at: string;
  claim_token: string;
  group_name: string;
  currency: string;
  user_name: string;
}

export async function findMembershipByClaimToken(db: Db, token: string): Promise<MembershipClaimRow | undefined> {
  return (await db
    .prepare(
      `SELECT m.*, g.name AS group_name, g.currency, u.name AS user_name
       FROM group_members m
       JOIN groups g ON g.id = m.group_id
       JOIN users u ON u.id = m.user_id
       WHERE m.claim_token = ? AND m.status = 'active'`
    )
    .get(token)) as MembershipClaimRow | undefined;
}

export async function linkGoogleToUser(
  db: Db,
  userId: string,
  googleSub: string,
  avatarUrl?: string
): Promise<void> {
  await db
    .prepare("UPDATE users SET google_sub = ?, avatar_url = COALESCE(?, avatar_url) WHERE id = ?")
    .run(googleSub, avatarUrl ?? null, userId);
}

// ---------- Groups ----------

export async function createGroup(
  db: Db,
  input: {
    name: string;
    currency: string;
    type: GroupType;
    creatorId: string;
    logoUrl?: string | null;
    enabledExtras?: string[];
    simplifyDebts?: boolean;
  }
): Promise<Group> {
  const id = randomUUID();
  const inviteToken = randomUUID().replace(/-/g, "").slice(0, 16);
  await db
    .prepare(
      `INSERT INTO groups (id, name, currency, type, invite_token, creator_id, logo_url, enabled_extras, simplify_debts, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.name,
      input.currency,
      input.type,
      inviteToken,
      input.creatorId,
      input.logoUrl ?? null,
      JSON.stringify(input.enabledExtras ?? []),
      input.simplifyDebts ? 1 : 0,
      new Date().toISOString()
    );
  await addMember(db, {
    groupId: id,
    userId: input.creatorId,
    role: "admin",
    status: "active",
  });
  return (await getGroup(db, id))!;
}

export async function getGroup(db: Db, groupId: string): Promise<Group | undefined> {
  const row = (await db.prepare("SELECT * FROM groups WHERE id = ?").get(groupId)) as GroupRow | undefined;
  return row ? toGroup(row) : undefined;
}

export async function getGroupByInviteToken(db: Db, token: string): Promise<Group | undefined> {
  const row = (await db.prepare("SELECT * FROM groups WHERE invite_token = ?").get(token)) as
    | GroupRow
    | undefined;
  return row ? toGroup(row) : undefined;
}

export async function listGroupsForUser(
  db: Db,
  userId: string
): Promise<Array<Group & { membership: GroupMember; lastActivity: string }>> {
  const rows = (await db
    .prepare(
      `SELECT g.* FROM groups g
       JOIN group_members m ON m.group_id = g.id
       WHERE m.user_id = ? AND m.status = 'active'
       ORDER BY g.created_at DESC`
    )
    .all(userId)) as unknown as GroupRow[];
  const activityRows = (await db
    .prepare(
      `SELECT g.id AS group_id,
              COALESCE(MAX(a.last), g.created_at) AS last_activity
       FROM groups g
       JOIN group_members m ON m.group_id = g.id AND m.user_id = ? AND m.status = 'active'
       LEFT JOIN (
         SELECT group_id, created_at AS last FROM group_events
         UNION ALL SELECT group_id, created_at FROM expenses
         UNION ALL SELECT group_id, created_at FROM informal_debts
         UNION ALL SELECT group_id, created_at FROM common_pot_contributions
       ) a ON a.group_id = g.id
       GROUP BY g.id, g.created_at`
    )
    .all(userId)) as unknown as Array<{ group_id: string; last_activity: string }>;
  const activityById = new Map(activityRows.map((r) => [r.group_id, r.last_activity]));
  const result: Array<Group & { membership: GroupMember; lastActivity: string }> = [];
  for (const r of rows) {
    const g = toGroup(r);
    const membership = (await getMembership(db, g.id, userId))!;
    result.push({ ...g, membership, lastActivity: activityById.get(g.id) ?? g.createdAt });
  }
  return result;
}

export async function updateGroup(
  db: Db,
  groupId: string,
  patch: {
    name?: string;
    currency?: string;
    type?: GroupType;
    logoUrl?: string | null;
    enabledExtras?: string[];
    simplifyDebts?: boolean;
  }
): Promise<Group> {
  const current = (await getGroup(db, groupId))!;
  await db.prepare("UPDATE groups SET name = ?, currency = ?, type = ?, logo_url = ?, enabled_extras = ?, simplify_debts = ? WHERE id = ?").run(
    patch.name ?? current.name,
    patch.currency ?? current.currency,
    patch.type ?? current.type,
    patch.logoUrl === undefined ? current.logoUrl : patch.logoUrl,
    patch.enabledExtras === undefined ? JSON.stringify(current.enabledExtras) : JSON.stringify(patch.enabledExtras),
    patch.simplifyDebts === undefined ? (current.simplifyDebts ? 1 : 0) : patch.simplifyDebts ? 1 : 0,
    groupId
  );
  return (await getGroup(db, groupId))!;
}

// ---------- Members ----------

export async function addMember(
  db: Db,
  input: { groupId: string; userId: string; role: MemberRole; status: MemberStatus }
): Promise<GroupMember> {
  await db
    .prepare(
      `INSERT INTO group_members (group_id, user_id, role, status, joined_at, left_at, frozen_balance)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(input.groupId, input.userId, input.role, input.status, new Date().toISOString(), null, null);
  return (await getMembership(db, input.groupId, input.userId))!;
}

export async function getMembership(
  db: Db,
  groupId: string,
  userId: string
): Promise<GroupMember | undefined> {
  const row = (await db
    .prepare("SELECT * FROM group_members WHERE group_id = ? AND user_id = ?")
    .get(groupId, userId)) as MembershipRow | undefined;
  return row ? toMember(row as unknown as MemberRow) : undefined;
}

export async function getMemberRow(
  db: Db,
  groupId: string,
  userId: string
): Promise<MemberRow | undefined> {
  return (await db
    .prepare(
      `SELECT m.*, u.name, u.email, u.avatar_url, u.email_verified, u.is_ghost, u.phone, u.revolut, u.paypal
       FROM group_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.group_id = ? AND m.user_id = ?`
    )
    .get(groupId, userId)) as MemberRow | undefined;
}

export async function listMembers(db: Db, groupId: string): Promise<MemberRow[]> {
  return (await db
    .prepare(
      `SELECT m.*, u.name, u.email, u.avatar_url, u.email_verified, u.is_ghost, u.phone, u.revolut, u.paypal
       FROM group_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.group_id = ?
       ORDER BY m.status = 'ex_member', m.joined_at ASC`
    )
    .all(groupId)) as unknown as MemberRow[];
}

export async function setRole(db: Db, groupId: string, userId: string, role: MemberRole): Promise<void> {
  await db.prepare("UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?").run(role, groupId, userId);
}

export async function setMemberStatus(
  db: Db,
  groupId: string,
  userId: string,
  status: MemberStatus,
  leftAt?: string | null,
  frozenBalance?: number | null
): Promise<void> {
  await db
    .prepare(
      `UPDATE group_members SET status = ?, left_at = ?, frozen_balance = ?
       WHERE group_id = ? AND user_id = ?`
    )
    .run(status, leftAt ?? null, frozenBalance ?? null, groupId, userId);
}

export async function removeMember(db: Db, groupId: string, userId: string): Promise<void> {
  await db.prepare("DELETE FROM group_members WHERE group_id = ? AND user_id = ?").run(groupId, userId);
}

export async function countActiveMemberships(db: Db, userId: string): Promise<number> {
  const row = (await db
    .prepare(
      `SELECT COUNT(*) AS count FROM group_members WHERE user_id = ? AND status = 'active'`
    )
    .get(userId)) as { count: number | string } | undefined;
  return Number(row?.count ?? 0);
}

export type GroupEventType = "member_joined" | "member_left" | "member_removed";

export interface GroupEventRow {
  id: string;
  group_id: string;
  type: GroupEventType;
  user_id: string;
  user_name: string;
  created_at: string;
}

export async function createGroupEvent(
  db: Db,
  input: { groupId: string; type: GroupEventType; userId: string; userName: string }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO group_events (id, group_id, type, user_id, user_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(randomUUID(), input.groupId, input.type, input.userId, input.userName, new Date().toISOString());
}

export async function listGroupEvents(db: Db, groupId: string): Promise<GroupEventRow[]> {
  return (await db
    .prepare("SELECT * FROM group_events WHERE group_id = ? ORDER BY created_at ASC")
    .all(groupId)) as unknown as GroupEventRow[];
}

// ---------- Notifications ----------

export type NotificationType =
  | "EXPENSE_ADDED"
  | "PAYMENT_SETTLED"
  | "PAYMENT_PENDING"
  | "PIQUE_CREATED"
  | "RECURRING_EXPENSE";

export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: number;
  link_url: string;
  created_at: string;
}

export async function createNotification(
  db: Db,
  input: { userId: string; type: NotificationType; title: string; body: string; linkUrl: string }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, read, link_url, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
    )
    .run(
      randomUUID(),
      input.userId,
      input.type,
      input.title,
      input.body,
      input.linkUrl,
      new Date().toISOString()
    );
}

export async function listNotifications(db: Db, userId: string, limit = 50): Promise<NotificationRow[]> {
  return (await db
    .prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(userId, limit)) as unknown as NotificationRow[];
}

export async function countUnreadNotifications(db: Db, userId: string): Promise<number> {
  const row = (await db
    .prepare("SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read = 0")
    .get(userId)) as { count: number | string } | undefined;
  return Number(row?.count ?? 0);
}

export async function markNotificationRead(db: Db, notificationId: string, userId: string): Promise<boolean> {
  const res = await db
    .prepare("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?")
    .run(notificationId, userId);
  return res.changes > 0;
}

export async function markAllNotificationsRead(db: Db, userId: string): Promise<void> {
  await db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0").run(userId);
}

// ---------- Notification preferences ----------

export interface NotificationPreferences {
  expense: boolean;
  payment: boolean;
  pique: boolean;
  recurring: boolean;
}

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  expense: true,
  payment: true,
  pique: true,
  recurring: true,
};

export async function getNotificationPreferences(db: Db, userId: string): Promise<NotificationPreferences> {
  const row = (await db
    .prepare("SELECT expense, payment, pique, recurring FROM notification_preferences WHERE user_id = ?")
    .get(userId)) as
    | { expense: number; payment: number; pique: number; recurring: number }
    | undefined;
  if (!row) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  return {
    expense: Boolean(row.expense),
    payment: Boolean(row.payment),
    pique: Boolean(row.pique),
    recurring: Boolean(row.recurring),
  };
}

export async function setNotificationPreferences(
  db: Db,
  userId: string,
  prefs: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const next = { ...(await getNotificationPreferences(db, userId)), ...prefs };
  await db
    .prepare(
      `INSERT INTO notification_preferences (user_id, expense, payment, pique, recurring, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET
         expense = excluded.expense,
         payment = excluded.payment,
         pique = excluded.pique,
         recurring = excluded.recurring,
         updated_at = excluded.updated_at`
    )
    .run(
      userId,
      next.expense ? 1 : 0,
      next.payment ? 1 : 0,
      next.pique ? 1 : 0,
      next.recurring ? 1 : 0,
      new Date().toISOString()
    );
  return next;
}

// ---------- Informal debts (piques/apuestas) ----------

export interface InformalDebtRow {
  id: string;
  group_id: string;
  creator_id: string;
  creditor_id: string;
  debtor_id: string;
  kind: PiqueKind;
  prize: string | null;
  winner_ids: string | null;
  loser_ids: string | null;
  amount: number;
  title: string;
  status: InformalDebtStatus;
  created_at: string;
}

export function toInformalDebt(r: InformalDebtRow): InformalDebt {
  return {
    id: r.id,
    groupId: r.group_id,
    creatorId: r.creator_id,
    kind: r.kind,
    amount: r.amount,
    prize: r.prize,
    winnerIds: r.winner_ids ? parseStringArray(r.winner_ids) : [r.creditor_id],
    loserIds: r.loser_ids ? parseStringArray(r.loser_ids) : [r.debtor_id],
    title: r.title,
    status: r.status,
    createdAt: r.created_at,
  };
}

export async function createInformalDebt(
  db: Db,
  input: {
    groupId: string;
    creatorId: string;
    winnerIds: string[];
    loserIds: string[];
    kind: PiqueKind;
    amount: number;
    prize?: string | null;
    title: string;
  }
): Promise<InformalDebt> {
  const id = randomUUID();
  const creditorId = input.winnerIds[0] ?? "";
  const debtorId = input.loserIds[0] ?? "";
  await db
    .prepare(
      `INSERT INTO informal_debts (id, group_id, creator_id, creditor_id, debtor_id, kind, prize, winner_ids, loser_ids, amount, title, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
    )
    .run(
      id,
      input.groupId,
      input.creatorId,
      creditorId,
      debtorId,
      input.kind,
      input.prize ?? null,
      JSON.stringify(input.winnerIds),
      JSON.stringify(input.loserIds),
      input.amount,
      input.title,
      new Date().toISOString()
    );
  return (await getInformalDebt(db, id))!;
}

export async function getInformalDebt(db: Db, id: string): Promise<InformalDebt | undefined> {
  const row = (await db.prepare("SELECT * FROM informal_debts WHERE id = ?").get(id)) as
    | InformalDebtRow
    | undefined;
  return row ? toInformalDebt(row) : undefined;
}

export async function listInformalDebts(db: Db, groupId: string): Promise<InformalDebt[]> {
  const rows = (await db
    .prepare("SELECT * FROM informal_debts WHERE group_id = ? ORDER BY created_at DESC")
    .all(groupId)) as unknown as InformalDebtRow[];
  return rows.map(toInformalDebt);
}

export async function listInformalDebtsForUser(db: Db, userId: string): Promise<InformalDebt[]> {
  const rows = (await db
    .prepare(
      `SELECT * FROM informal_debts
       WHERE creditor_id = ? OR debtor_id = ? OR winner_ids LIKE ? OR loser_ids LIKE ?
       ORDER BY created_at DESC`
    )
    .all(userId, userId, `%${userId}%`, `%${userId}%`)) as unknown as InformalDebtRow[];
  return rows.map(toInformalDebt);
}

export async function updateInformalDebt(
  db: Db,
  id: string,
  patch: { amount?: number; title?: string; status?: InformalDebtStatus }
): Promise<InformalDebt> {
  const current = (await getInformalDebt(db, id))!;
  await db
    .prepare("UPDATE informal_debts SET amount = ?, title = ?, status = ? WHERE id = ?")
    .run(patch.amount ?? current.amount, patch.title ?? current.title, patch.status ?? current.status, id);
  return (await getInformalDebt(db, id))!;
}

export async function updateInformalDebtStatus(db: Db, id: string, status: InformalDebtStatus): Promise<InformalDebt> {
  await db.prepare("UPDATE informal_debts SET status = ? WHERE id = ?").run(status, id);
  return (await getInformalDebt(db, id))!;
}

// ---------- Bote común ----------

export type RecurringFrequency = "weekly" | "monthly" | "yearly";

export interface PotContribution {
  id: string;
  groupId: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  amount: number;
  note: string | null;
  expenseId: string | null;
  createdAt: string;
}

interface PotContributionRow {
  id: string;
  group_id: string;
  user_id: string;
  amount: number;
  note: string | null;
  expense_id: string | null;
  created_at: string;
  user_name: string | null;
  user_avatar: string | null;
}

function toPotContribution(r: PotContributionRow): PotContribution {
  return {
    id: r.id,
    groupId: r.group_id,
    userId: r.user_id,
    userName: r.expense_id ? "Bote común" : (r.user_name ?? "Bote común"),
    userAvatar: r.expense_id ? null : r.user_avatar,
    amount: r.amount,
    note: r.note,
    expenseId: r.expense_id,
    createdAt: r.created_at,
  };
}

export async function listPotContributions(db: Db, groupId: string): Promise<PotContribution[]> {
  const rows = (await db
    .prepare(
      `SELECT c.*, u.name AS user_name, u.avatar_url AS user_avatar
       FROM common_pot_contributions c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.group_id = ?
       ORDER BY c.created_at DESC`
    )
    .all(groupId)) as unknown as PotContributionRow[];
  return rows.map(toPotContribution);
}

export async function addPotContribution(
  db: Db,
  input: { groupId: string; userId: string; amount: number; note?: string | null }
): Promise<PotContribution> {
  const id = randomUUID();
  await db
    .prepare(
      `INSERT INTO common_pot_contributions (id, group_id, user_id, amount, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(id, input.groupId, input.userId, input.amount, input.note ?? null, new Date().toISOString());
  const row = (await db
    .prepare(
      `SELECT c.*, u.name AS user_name, u.avatar_url AS user_avatar
       FROM common_pot_contributions c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = ?`
    )
    .get(id)) as unknown as PotContributionRow;
  return toPotContribution(row);
}

export async function deletePotContribution(db: Db, id: string): Promise<void> {
  await db.prepare("DELETE FROM common_pot_contributions WHERE id = ?").run(id);
}

export async function getPotBalance(db: Db, groupId: string): Promise<number> {
  const row = (await db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM common_pot_contributions WHERE group_id = ?")
    .get(groupId)) as { total: number | string } | undefined;
  return Math.round(Number(row?.total ?? 0) * 100) / 100;
}

export interface PotLedgerEntry {
  id: string;
  type: "contribution" | "withdrawal";
  amount: number;
  note: string | null;
  userId: string | null;
  userName: string | null;
  expenseId: string | null;
  expenseDescription: string | null;
  createdAt: string;
  runningBalance: number;
}

/**
 * Extracto unificado del bote común: aportaciones (+) y retiradas por gastos pagados con bote (-).
 * Ordenado cronológicamente con saldo corriente (running balance).
 */
export async function getPotLedger(db: Db, groupId: string): Promise<PotLedgerEntry[]> {
  // Aportaciones (positivas)
  const contributions = await db
    .prepare(
      `SELECT c.id, c.amount, c.note, c.user_id, u.name AS user_name, c.created_at,
              'contribution' AS type
       FROM common_pot_contributions c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.group_id = ? AND c.expense_id IS NULL
       ORDER BY c.created_at ASC`
    )
    .all(groupId);

  // Retiradas (gastos pagados con bote = negativas)
  const withdrawals = await db
    .prepare(
      `SELECT c.id, c.amount, c.note, c.expense_id, c.user_id, u.name AS user_name, c.created_at,
              'withdrawal' AS type, e.description AS expense_description
       FROM common_pot_contributions c
       LEFT JOIN users u ON u.id = c.user_id
       LEFT JOIN expenses e ON e.id = c.expense_id
       WHERE c.group_id = ? AND c.expense_id IS NOT NULL
       ORDER BY c.created_at ASC`
    )
    .all(groupId);

  const movements = [
    ...contributions.map((c: any) => ({
      id: c.id,
      type: "contribution" as const,
      amount: Number(c.amount),
      note: c.note,
      userId: c.user_id,
      userName: c.user_name,
      expenseId: null,
      expenseDescription: null,
      createdAt: c.created_at,
    })),
    ...withdrawals.map((w: any) => ({
      id: w.id,
      type: "withdrawal" as const,
      amount: Number(w.amount), // ya se almacena negativo = salida
      note: w.note,
      userId: w.user_id,
      userName: w.user_name,
      expenseId: w.expense_id,
      expenseDescription: w.expense_description,
      createdAt: w.created_at,
    })),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  let running = 0;
  return movements.map((m) => {
    running = Math.round((running + m.amount) * 100) / 100;
    return { ...m, runningBalance: running };
  });
}

export interface PotWithdrawal {
  id: string;
  groupId: string;
  amount: number;
  expenseId: string;
  note: string;
  createdAt: string;
}

export async function getPotExpenseWithdrawal(
  db: Db,
  expenseId: string
): Promise<PotWithdrawal | undefined> {
  const row = (await db
    .prepare("SELECT * FROM common_pot_contributions WHERE expense_id = ?")
    .get(expenseId)) as
    | { id: string; group_id: string; amount: number; note: string | null; created_at: string }
    | undefined;
  if (!row) return undefined;
  return {
    id: row.id,
    groupId: row.group_id,
    amount: row.amount,
    note: row.note ?? "",
    createdAt: row.created_at,
    expenseId,
  };
}

export async function upsertPotExpenseWithdrawal(
  db: Db,
  input: { groupId: string; expenseId: string; amountGroup: number; description: string }
): Promise<void> {
  const existing = await getPotExpenseWithdrawal(db, input.expenseId);
  if (existing) {
    await db
      .prepare(
        `UPDATE common_pot_contributions
         SET amount = ?, note = ?
         WHERE expense_id = ?`
      )
      .run(-input.amountGroup, `Gasto "${input.description}"`, input.expenseId);
    return;
  }
  await db
    .prepare(
      `INSERT INTO common_pot_contributions (id, group_id, user_id, amount, note, expense_id, created_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?)`
    )
    .run(
      randomUUID(),
      input.groupId,
      -input.amountGroup,
      `Gasto "${input.description}"`,
      input.expenseId,
      new Date().toISOString()
    );
}

export async function deletePotExpenseWithdrawal(db: Db, expenseId: string): Promise<void> {
  await db.prepare("DELETE FROM common_pot_contributions WHERE expense_id = ?").run(expenseId);
}

// ---------- Gastos fijos ----------

export interface RecurringExpense {
  id: string;
  groupId: string;
  title: string;
  amount: number;
  currency: string;
  frequency: RecurringFrequency;
  responsibleId: string;
  responsibleName: string;
  payerId: string | null;
  participants: string[];
  nextRunAt: string | null;
  createdAt: string;
  active: boolean;
  autoCreate: boolean;
}

interface RecurringExpenseRow {
  id: string;
  group_id: string;
  title: string;
  amount: number;
  currency: string;
  frequency: RecurringFrequency;
  responsible_id: string;
  responsible_name: string;
  payer_id: string | null;
  participants: string | null;
  created_by: string | null;
  next_run_at: string | null;
  created_at: string;
  active: number;
  auto_create: number;
}

function toRecurringExpense(r: RecurringExpenseRow): RecurringExpense {
  return {
    id: r.id,
    groupId: r.group_id,
    title: r.title,
    amount: r.amount,
    currency: r.currency,
    frequency: r.frequency,
    responsibleId: r.responsible_id,
    responsibleName: r.responsible_name,
    payerId: r.payer_id,
    participants: parseStringArray(r.participants ?? "[]"),
    nextRunAt: r.next_run_at,
    createdAt: r.created_at,
    active: Boolean(r.active),
    autoCreate: Boolean(r.auto_create),
  };
}

export async function listRecurringExpenses(db: Db, groupId: string): Promise<RecurringExpense[]> {
  const rows = (await db
    .prepare(
      `SELECT r.*, u.name AS responsible_name
       FROM recurring_expenses r
       JOIN users u ON u.id = r.responsible_id
       WHERE r.group_id = ?
       ORDER BY r.created_at DESC`
    )
    .all(groupId)) as unknown as RecurringExpenseRow[];
  return rows.map(toRecurringExpense);
}

export async function getRecurringExpense(db: Db, id: string): Promise<RecurringExpense | undefined> {
  const row = (await db
    .prepare(
      `SELECT r.*, u.name AS responsible_name
       FROM recurring_expenses r
       JOIN users u ON u.id = r.responsible_id
       WHERE r.id = ?`
    )
    .get(id)) as unknown as RecurringExpenseRow | undefined;
  return row ? toRecurringExpense(row) : undefined;
}

export async function createRecurringExpense(
  db: Db,
  input: {
    groupId: string;
    title: string;
    amount: number;
    currency: string;
    frequency: RecurringFrequency;
    responsibleId: string;
    payerId?: string | null;
    participants?: string[];
    autoCreate?: boolean;
    nextRunAt?: string;
    createdById?: string;
  }
): Promise<RecurringExpense> {
  const id = randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO recurring_expenses
         (id, group_id, title, amount, currency, frequency, responsible_id, payer_id, participants, created_by, next_run_at, created_at, active, auto_create)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
    )
    .run(
      id,
      input.groupId,
      input.title,
      input.amount,
      input.currency,
      input.frequency,
      input.responsibleId,
      input.payerId ?? null,
      JSON.stringify(input.participants ?? []),
      input.createdById ?? input.responsibleId,
      input.nextRunAt ?? now,
      now,
      input.autoCreate ? 1 : 0
    );
  return (await getRecurringExpense(db, id))!;
}

export async function setRecurringExpenseActive(db: Db, id: string, active: boolean): Promise<RecurringExpense> {
  if (active) {
    await db
      .prepare("UPDATE recurring_expenses SET active = 1, next_run_at = ? WHERE id = ?")
      .run(new Date().toISOString(), id);
  } else {
    await db.prepare("UPDATE recurring_expenses SET active = 0 WHERE id = ?").run(id);
  }
  return (await getRecurringExpense(db, id))!;
}

export async function setRecurringExpenseNextRun(db: Db, id: string, nextRunAt: string): Promise<void> {
  await db.prepare("UPDATE recurring_expenses SET next_run_at = ? WHERE id = ?").run(nextRunAt, id);
}

export async function deleteRecurringExpense(db: Db, id: string): Promise<void> {
  await db.prepare("DELETE FROM recurring_expenses WHERE id = ?").run(id);
}

export async function listDueRecurringExpenses(db: Db, now: string): Promise<RecurringExpense[]> {
  const rows = (await db
    .prepare(
      `SELECT r.*, u.name AS responsible_name
       FROM recurring_expenses r
       JOIN users u ON u.id = r.responsible_id
       WHERE r.active = 1 AND r.auto_create = 1 AND r.next_run_at IS NOT NULL AND r.next_run_at <= ?
       ORDER BY r.next_run_at ASC`
    )
    .all(now)) as unknown as RecurringExpenseRow[];
  return rows.map(toRecurringExpense);
}

// ---------- Push subscriptions ----------

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  keys: string;
  created_at: string;
}

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export async function upsertPushSubscription(
  db: Db,
  userId: string,
  endpoint: string,
  keys: PushSubscriptionKeys
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, keys, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, keys = excluded.keys`
    )
    .run(randomUUID(), userId, endpoint, JSON.stringify(keys), new Date().toISOString());
}

export async function deletePushSubscription(db: Db, endpoint: string): Promise<void> {
  await db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(endpoint);
}

export async function deletePushSubscriptionsForUser(db: Db, userId: string): Promise<void> {
  await db.prepare("DELETE FROM push_subscriptions WHERE user_id = ?").run(userId);
}

export async function listPushSubscriptions(
  db: Db,
  userId: string
): Promise<Array<{ endpoint: string; keys: PushSubscriptionKeys }>> {
  const rows = (await db
    .prepare("SELECT endpoint, keys FROM push_subscriptions WHERE user_id = ?")
    .all(userId)) as unknown as Array<{ endpoint: string; keys: string }>;
  return rows
    .filter((r) => Boolean(r.endpoint && r.keys))
    .map((r) => ({ endpoint: r.endpoint, keys: JSON.parse(r.keys) as PushSubscriptionKeys }));
}

// ---------- Expenses ----------

export interface CreateExpenseInput {
  groupId: string;
  payerId: string | null;
  description: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  amountGroup: number;
  createdById: string;
  participants: string[];
  /** Reparto personalizado en moneda del grupo (solo para participantes con share fijo). */
  shares?: Record<string, number> | null;
  paidFromPot?: boolean;
  receiptUrl?: string | null;
  category?: string;
  iconName?: string;
  isCustomIcon?: boolean;
}

export async function createExpense(db: Db, input: CreateExpenseInput): Promise<ExpenseRow> {
  const id = randomUUID();
  const now = new Date().toISOString();
  // Transacción: el gasto y sus participantes se escriben juntos o no se escriben.
  return db.transaction(async (tx) => {
    await tx
      .prepare(
        `INSERT INTO expenses (id, group_id, payer_id, description, amount, currency, exchange_rate, amount_group, created_by_id, created_at, updated_at, deleted, paid_from_pot, receipt_url, category, icon_name, is_custom_icon)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.groupId,
        input.payerId,
        input.description,
        input.amount,
        input.currency,
        input.exchangeRate,
        input.amountGroup,
        input.createdById,
        now,
        now,
        input.paidFromPot ? 1 : 0,
        input.receiptUrl ?? null,
        input.category ?? "general",
        input.iconName ?? "wallet",
        input.isCustomIcon ? 1 : 0
      );
    const ins = tx.prepare("INSERT INTO expense_participants (expense_id, user_id, share_amount) VALUES (?, ?, ?)");
    for (const p of input.participants) {
      await ins.run(id, p, input.shares?.[p] ?? null);
    }
    return (await getExpense(tx, id))!;
  });
}

export async function getExpense(db: Db, expenseId: string): Promise<ExpenseRow | undefined> {
  return (await db
    .prepare(
      `SELECT e.*, COALESCE(u.name, 'Bote común') AS payer_name
       FROM expenses e LEFT JOIN users u ON u.id = e.payer_id
       WHERE e.id = ?`
    )
    .get(expenseId)) as ExpenseRow | undefined;
}

export async function listExpenses(
  db: Db,
  groupId: string,
  includeDeleted = false
): Promise<ExpenseRow[]> {
  const sql = `SELECT e.*, COALESCE(u.name, 'Bote común') AS payer_name
    FROM expenses e LEFT JOIN users u ON u.id = e.payer_id
    WHERE e.group_id = ? ${includeDeleted ? "" : "AND e.deleted = 0"}
    ORDER BY e.created_at DESC`;
  return (await db.prepare(sql).all(groupId)) as unknown as ExpenseRow[];
}

export interface ExpenseFilters {
  category?: string;
  payerId?: string;
  from?: string;   // ISO date
  to?: string;      // ISO date
  q?: string;       // texto libre sobre description
}

/**
 * Lista gastos con filtros opcionales (categoría, pagador, rango fechas, búsqueda texto).
 * Usa la misma query optimizada que listExpensesWithDetails pero con WHERE dinámico.
 */
export async function listExpensesFiltered(
  db: Db,
  groupId: string,
  filters: ExpenseFilters,
  includeDeleted = false,
  opts: { limit?: number; offset?: number } = {}
): Promise<ExpenseDetailRow[]> {
  const conditions = includeDeleted ? ["e.group_id = ?"] : ["e.group_id = ?", "e.deleted = 0"];
  const params: any[] = [groupId];

  if (filters.category) {
    conditions.push("e.category = ?");
    params.push(filters.category);
  }
  if (filters.payerId) {
    conditions.push("e.payer_id = ?");
    params.push(filters.payerId);
  }
  if (filters.from) {
    conditions.push("e.created_at >= ?");
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push("e.created_at <= ?");
    params.push(filters.to);
  }
  if (filters.q) {
    conditions.push("LOWER(e.description) LIKE LOWER(?)");
    params.push(`%${filters.q}%`);
  }

  const sql = `
     SELECT
       e.*,
       COALESCE(u.name, 'Bote común') AS payer_name,
       COALESCE((
         SELECT json_agg(json_build_object('userId', ep.user_id, 'share', ep.share_amount))
         FROM expense_participants ep
         WHERE ep.expense_id = e.id
       ), '[]')::text AS participants_json,
       COALESCE((
         SELECT COUNT(*) FROM expense_comments c WHERE c.expense_id = e.id
       ), 0) AS comment_count
     FROM expenses e
     LEFT JOIN users u ON u.id = e.payer_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY e.created_at DESC
     ${opts.limit != null ? "LIMIT ? OFFSET ?" : ""}
   `;
  if (opts.limit != null) params.push(opts.limit, opts.offset ?? 0);
  return (await db.prepare(sql).all(...params)) as unknown as ExpenseDetailRow[];
}

export interface ExpenseDetailRow extends ExpenseRow {
  participants_json: string;
  comment_count: number;
}

/**
 * Lista gastos con participantes, shares y conteo de comentarios en una sola query.
 * Optimizado: usa JOINs en lugar de subconsultas correlacionadas.
 */
export async function listExpensesWithDetails(
   db: Db,
   groupId: string,
   includeDeleted = false,
   opts: { limit?: number; offset?: number } = {}
): Promise<ExpenseDetailRow[]> {
   const sql = `
     SELECT
       e.*,
       COALESCE(u.name, 'Bote común') AS payer_name,
       COALESCE((
         SELECT json_agg(json_build_object('userId', ep.user_id, 'share', ep.share_amount))
         FROM expense_participants ep
         WHERE ep.expense_id = e.id
       ), '[]')::text AS participants_json,
       COALESCE((
         SELECT COUNT(*) FROM expense_comments c WHERE c.expense_id = e.id
       ), 0) AS comment_count
     FROM expenses e
     LEFT JOIN users u ON u.id = e.payer_id
     WHERE e.group_id = ? ${includeDeleted ? "" : "AND e.deleted = 0"}
     ORDER BY e.created_at DESC
     ${opts.limit != null ? "LIMIT ? OFFSET ?" : ""}
   `;
   const params: SqlValue[] = [groupId];
   if (opts.limit != null) params.push(opts.limit, opts.offset ?? 0);
   return (await db.prepare(sql).all(...params)) as unknown as ExpenseDetailRow[];
}

/** Total de gastos del grupo (para paginación), respetando soft-delete. */
export async function countExpensesInGroup(db: Db, groupId: string, includeDeleted = false): Promise<number> {
  const row = (await db
    .prepare(`SELECT COUNT(*) AS total FROM expenses WHERE group_id = ? ${includeDeleted ? "" : "AND deleted = 0"}`)
    .get(groupId)) as { total: number } | undefined;
  return Number(row?.total ?? 0);
}

/** Total de gastos que cumplen los filtros dados (para paginación con filtros). */
export async function countExpensesFiltered(
  db: Db,
  groupId: string,
  filters: ExpenseFilters,
  includeDeleted = false
): Promise<number> {
  const conditions = includeDeleted ? ["e.group_id = ?"] : ["e.group_id = ?", "e.deleted = 0"];
  const params: any[] = [groupId];
  if (filters.category) {
    conditions.push("e.category = ?");
    params.push(filters.category);
  }
  if (filters.payerId) {
    conditions.push("e.payer_id = ?");
    params.push(filters.payerId);
  }
  if (filters.from) {
    conditions.push("e.created_at >= ?");
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push("e.created_at <= ?");
    params.push(filters.to);
  }
  if (filters.q) {
    // Portable: ver listExpensesFiltered
    conditions.push("LOWER(e.description) LIKE LOWER(?)");
    params.push(`%${filters.q}%`);
  }
  const row = (await db
    .prepare(`SELECT COUNT(DISTINCT e.id) AS total FROM expenses e WHERE ${conditions.join(" AND ")}`)
    .get(...params)) as { total: number } | undefined;
  return Number(row?.total ?? 0);
}

export interface ExpenseParticipantRow {
  expense_id: string;
  user_id: string;
  share_amount: number | null;
}

export async function expenseParticipantRows(db: Db, expenseId: string): Promise<ExpenseParticipantRow[]> {
  return (await db
    .prepare("SELECT * FROM expense_participants WHERE expense_id = ?")
    .all(expenseId)) as unknown as ExpenseParticipantRow[];
}

export async function expenseParticipantIds(db: Db, expenseId: string): Promise<string[]> {
  const rows = await expenseParticipantRows(db, expenseId);
  return rows.map((r) => r.user_id);
}

/** Devuelve el reparto personalizado (en moneda del grupo) si existe; {} si es a partes iguales. */
export async function expenseParticipantShares(db: Db, expenseId: string): Promise<Record<string, number>> {
  const rows = await expenseParticipantRows(db, expenseId);
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (r.share_amount != null) out[r.user_id] = r.share_amount;
  }
  return out;
}

export interface ExpenseParticipantsInfo {
  ids: string[];
  shares: Record<string, number>;
}

/**
 * Participantes de todos los gastos del grupo en UNA sola consulta.
 * Evita el N+1 de llamar a expenseParticipantIds/shares por cada gasto.
 */
export async function expenseParticipantsByGroup(
  db: Db,
  groupId: string
): Promise<Map<string, ExpenseParticipantsInfo>> {
  const rows = await db
    .prepare(
      `SELECT ep.expense_id, ep.user_id, ep.share_amount
       FROM expense_participants ep
       JOIN expenses e ON e.id = ep.expense_id
       WHERE e.group_id = ?`
    )
    .all(groupId);
  const map = new Map<string, ExpenseParticipantsInfo>();
  for (const r of rows) {
    const expenseId = String(r.expense_id);
    const entry = map.get(expenseId) ?? { ids: [], shares: {} };
    entry.ids.push(String(r.user_id));
    if (r.share_amount != null) entry.shares[String(r.user_id)] = Number(r.share_amount);
    map.set(expenseId, entry);
  }
  return map;
}

export async function updateExpense(
  db: Db,
  expenseId: string,
  patch: {
    description?: string;
    amount?: number;
    currency?: string;
    exchangeRate?: number;
    amountGroup?: number;
    payerId?: string | null;
    participants?: string[];
    /** undefined = reparto por igual; objeto = reparto personalizado. */
    shares?: Record<string, number> | null;
    paidFromPot?: boolean;
    receiptUrl?: string | null;
    category?: string;
    iconName?: string;
    isCustomIcon?: boolean;
  }
): Promise<ExpenseRow> {
  const current = (await getExpense(db, expenseId))!;
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE expenses SET
         description = ?, amount = ?, currency = ?, exchange_rate = ?, amount_group = ?, payer_id = ?, paid_from_pot = ?, receipt_url = ?, category = ?, icon_name = ?, is_custom_icon = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      patch.description ?? current.description,
      patch.amount ?? current.amount,
      patch.currency ?? current.currency,
      patch.exchangeRate ?? current.exchange_rate,
      patch.amountGroup ?? current.amount_group,
      patch.payerId === undefined ? current.payer_id : patch.payerId,
      (patch.paidFromPot ?? Boolean(current.paid_from_pot)) ? 1 : 0,
      patch.receiptUrl === undefined ? current.receipt_url : patch.receiptUrl,
      patch.category ?? current.category,
      patch.iconName ?? current.icon_name,
      patch.isCustomIcon === undefined ? current.is_custom_icon : (patch.isCustomIcon ? 1 : 0),
      now,
      expenseId
    );
  if (patch.participants) {
    await db.prepare("DELETE FROM expense_participants WHERE expense_id = ?").run(expenseId);
    const ins = db.prepare(
      "INSERT INTO expense_participants (expense_id, user_id, share_amount) VALUES (?, ?, ?)"
    );
    for (const p of patch.participants) {
      await ins.run(expenseId, p, patch.shares?.[p] ?? null);
    }
  }
  return (await getExpense(db, expenseId))!;
}

export async function deleteExpense(db: Db, expenseId: string): Promise<void> {
  await db.prepare("UPDATE expenses SET deleted = 1, updated_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    expenseId
  );
}

// ---------- Payments ----------

export async function createPayment(
  db: Db,
  input: {
    groupId: string;
    fromUserId: string;
    toUserId: string;
    amount: number;
    note?: string;
    proofUrl?: string | null;
    status: PaymentStatus;
    createdById: string;
    autoAcceptAt?: string | null;
  }
): Promise<PaymentRow> {
  const id = randomUUID();
  await db
    .prepare(
      `INSERT INTO payments (id, group_id, from_user_id, to_user_id, amount, note, proof_url, status, created_by_id, created_at, auto_accept_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.groupId,
      input.fromUserId,
      input.toUserId,
      input.amount,
      input.note ?? null,
      input.proofUrl ?? null,
      input.status,
      input.createdById,
      new Date().toISOString(),
      input.autoAcceptAt ?? null
    );
  return (await getPayment(db, id))!;
}

export async function getPayment(db: Db, paymentId: string): Promise<PaymentRow | undefined> {
  return (await db
    .prepare(
      `SELECT p.*, fu.name AS from_name, tu.name AS to_name
       FROM payments p
       JOIN users fu ON fu.id = p.from_user_id
       JOIN users tu ON tu.id = p.to_user_id
       WHERE p.id = ?`
    )
    .get(paymentId)) as PaymentRow | undefined;
}

export async function listPayments(db: Db, groupId: string): Promise<PaymentRow[]> {
  return (await db
    .prepare(
      `SELECT p.*, fu.name AS from_name, tu.name AS to_name
       FROM payments p
       JOIN users fu ON fu.id = p.from_user_id
       JOIN users tu ON tu.id = p.to_user_id
       WHERE p.group_id = ?
       ORDER BY p.created_at DESC`
    )
    .all(groupId)) as unknown as PaymentRow[];
}

export async function deletePayment(db: Db, paymentId: string): Promise<void> {
  await db.prepare("DELETE FROM payments WHERE id = ?").run(paymentId);
}

export async function updatePaymentStatus(db: Db, paymentId: string, status: PaymentStatus): Promise<PaymentRow> {
  await db.prepare("UPDATE payments SET status = ? WHERE id = ?").run(status, paymentId);
  return (await getPayment(db, paymentId))!;
}

export async function updatePayment(
  db: Db,
  paymentId: string,
  input: { amount?: number; note?: string | null; proofUrl?: string | null }
): Promise<PaymentRow> {
  const sets: string[] = [];
  const params: SqlValue[] = [];
  if (input.amount !== undefined) {
    sets.push("amount = ?");
    params.push(input.amount);
  }
  if (input.note !== undefined) {
    sets.push("note = ?");
    params.push(input.note);
  }
  if (input.proofUrl !== undefined) {
    sets.push("proof_url = ?");
    params.push(input.proofUrl);
  }
  if (sets.length === 0) return (await getPayment(db, paymentId))!;
  params.push(paymentId);
  await db.prepare(`UPDATE payments SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  return (await getPayment(db, paymentId))!;
}

export async function autoAcceptPendingPayments(db: Db): Promise<PaymentRow[]> {
  const now = new Date().toISOString();
  const payments = (await db
    .prepare(
      `SELECT id FROM payments WHERE status = 'pending' AND auto_accept_at IS NOT NULL AND auto_accept_at <= ?`
    )
    .all(now)) as { id: string }[];
  const accepted: PaymentRow[] = [];
  for (const p of payments) {
    const updated = await updatePaymentStatus(db, p.id, "accepted");
    accepted.push(updated);
  }
  return accepted;
}

// ---------- Comentarios de gasto ----------

export interface ExpenseCommentRow {
  id: string;
  expense_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author_name: string;
  author_verified: number;
}

export async function createExpenseComment(
  db: Db,
  input: { expenseId: string; authorId: string; body: string }
): Promise<ExpenseCommentRow> {
  const id = randomUUID();
  await db
    .prepare(
      "INSERT INTO expense_comments (id, expense_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run(id, input.expenseId, input.authorId, input.body, new Date().toISOString());
  return (await getExpenseComment(db, id))!;
}

export async function getExpenseComment(db: Db, commentId: string): Promise<ExpenseCommentRow | undefined> {
  return (await db
    .prepare(
      `SELECT c.*, u.name AS author_name, u.email_verified AS author_verified
       FROM expense_comments c JOIN users u ON u.id = c.author_id
       WHERE c.id = ?`
    )
    .get(commentId)) as ExpenseCommentRow | undefined;
}

export async function listExpenseComments(db: Db, expenseId: string): Promise<ExpenseCommentRow[]> {
  return (await db
    .prepare(
      `SELECT c.*, u.name AS author_name, u.email_verified AS author_verified
       FROM expense_comments c JOIN users u ON u.id = c.author_id
       WHERE c.expense_id = ?
       ORDER BY c.created_at ASC`
    )
    .all(expenseId)) as unknown as ExpenseCommentRow[];
}

export async function deleteExpenseComment(db: Db, commentId: string): Promise<void> {
  await db.prepare("DELETE FROM expense_comments WHERE id = ?").run(commentId);
}

// ---------- Modification requests ----------

export async function createRequest(
  db: Db,
  input: {
    groupId: string;
    expenseId: string;
    requesterId: string;
    action: "edit" | "delete";
    payload: Record<string, unknown>;
  }
): Promise<RequestRow> {
  const id = randomUUID();
  await db
    .prepare(
      `INSERT INTO modification_requests (id, group_id, expense_id, requester_id, action, payload, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
    )
    .run(
      id,
      input.groupId,
      input.expenseId,
      input.requesterId,
      input.action,
      JSON.stringify(input.payload),
      new Date().toISOString()
    );
  return (await getRequest(db, id))!;
}

export async function getRequest(db: Db, requestId: string): Promise<RequestRow | undefined> {
  return (await db
    .prepare(
      `SELECT r.*, u.name AS requester_name
       FROM modification_requests r JOIN users u ON u.id = r.requester_id
       WHERE r.id = ?`
    )
    .get(requestId)) as RequestRow | undefined;
}

export async function listRequests(db: Db, groupId: string): Promise<RequestRow[]> {
  return (await db
    .prepare(
      `SELECT r.*, u.name AS requester_name
       FROM modification_requests r JOIN users u ON u.id = r.requester_id
       WHERE r.group_id = ?
       ORDER BY r.created_at DESC`
    )
    .all(groupId)) as unknown as RequestRow[];
}

export async function decideRequest(
  db: Db,
  requestId: string,
  status: "approved" | "rejected",
  decidedBy: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE modification_requests SET status = ?, decided_at = ?, decided_by = ? WHERE id = ?`
    )
    .run(status, new Date().toISOString(), decidedBy, requestId);
}
