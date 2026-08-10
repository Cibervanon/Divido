import { randomUUID } from "node:crypto";
import type {
  Group,
  GroupMember,
  GroupType,
  MemberRole,
  MemberStatus,
} from "@divido/shared";
import type { Db } from "./db.js";

export type Row = Record<string, unknown>;

export interface UserRow {
  id: string;
  email: string | null;
  password_hash: string | null;
  name: string;
  avatar_url: string | null;
  google_sub: string | null;
  email_verified: number;
  verify_token: string | null;
  verify_token_expires: string | null;
  reset_token: string | null;
  reset_token_expires: string | null;
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
}

export interface MemberRow extends MembershipRow {
  name: string;
  email: string | null;
  avatar_url: string | null;
}

export interface ExpenseRow {
  id: string;
  group_id: string;
  payer_id: string;
  description: string;
  amount: number;
  currency: string;
  exchange_rate: number;
  amount_group: number;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  deleted: number;
  payer_name: string;
}

export interface PaymentRow {
  id: string;
  group_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  note: string | null;
  created_by_id: string;
  created_at: string;
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
    type: r.type,
    inviteToken: r.invite_token,
    creatorId: r.creator_id,
    logoUrl: r.logo_url,
    createdAt: r.created_at,
  };
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

export async function updateUser(
  db: Db,
  userId: string,
  patch: { name?: string; avatarUrl?: string | null }
): Promise<UserRow> {
  const current = (await findUserById(db, userId))!;
  await db.prepare("UPDATE users SET name = ?, avatar_url = ? WHERE id = ?").run(
    patch.name?.trim() ?? current.name,
    patch.avatarUrl === undefined ? current.avatar_url : patch.avatarUrl,
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
  }
): Promise<UserRow> {
  const id = randomUUID();
  await db
    .prepare(
      `INSERT INTO users (id, email, password_hash, name, avatar_url, google_sub, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.email,
      input.passwordHash ?? null,
      input.name,
      input.avatarUrl ?? null,
      input.googleSub ?? null,
      new Date().toISOString()
    );
  return (await findUserById(db, id))!;
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
  input: { name: string; currency: string; type: GroupType; creatorId: string; logoUrl?: string | null }
): Promise<Group> {
  const id = randomUUID();
  const inviteToken = randomUUID().replace(/-/g, "").slice(0, 16);
  await db
    .prepare(
      `INSERT INTO groups (id, name, currency, type, invite_token, creator_id, logo_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, input.name, input.currency, input.type, inviteToken, input.creatorId, input.logoUrl ?? null, new Date().toISOString());
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
): Promise<Array<Group & { membership: GroupMember }>> {
  const rows = (await db
    .prepare(
      `SELECT g.* FROM groups g
       JOIN group_members m ON m.group_id = g.id
       WHERE m.user_id = ? AND m.status = 'active'
       ORDER BY g.created_at DESC`
    )
    .all(userId)) as unknown as GroupRow[];
  const result: Array<Group & { membership: GroupMember }> = [];
  for (const r of rows) {
    const g = toGroup(r);
    const membership = (await getMembership(db, g.id, userId))!;
    result.push({ ...g, membership });
  }
  return result;
}

export async function updateGroup(
  db: Db,
  groupId: string,
  patch: { name?: string; currency?: string; type?: GroupType; logoUrl?: string | null }
): Promise<Group> {
  const current = (await getGroup(db, groupId))!;
  await db.prepare("UPDATE groups SET name = ?, currency = ?, type = ?, logo_url = ? WHERE id = ?").run(
    patch.name ?? current.name,
    patch.currency ?? current.currency,
    patch.type ?? current.type,
    patch.logoUrl === undefined ? current.logoUrl : patch.logoUrl,
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
      `SELECT m.*, u.name, u.email, u.avatar_url
       FROM group_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.group_id = ? AND m.user_id = ?`
    )
    .get(groupId, userId)) as MemberRow | undefined;
}

export async function listMembers(db: Db, groupId: string): Promise<MemberRow[]> {
  return (await db
    .prepare(
      `SELECT m.*, u.name, u.email, u.avatar_url
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

// ---------- Expenses ----------

export interface CreateExpenseInput {
  groupId: string;
  payerId: string;
  description: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  amountGroup: number;
  createdById: string;
  participants: string[];
}

export async function createExpense(db: Db, input: CreateExpenseInput): Promise<ExpenseRow> {
  const id = randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO expenses (id, group_id, payer_id, description, amount, currency, exchange_rate, amount_group, created_by_id, created_at, updated_at, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
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
      now
    );
  const ins = db.prepare("INSERT INTO expense_participants (expense_id, user_id) VALUES (?, ?)");
  for (const p of input.participants) {
    await ins.run(id, p);
  }
  return (await getExpense(db, id))!;
}

export async function getExpense(db: Db, expenseId: string): Promise<ExpenseRow | undefined> {
  return (await db
    .prepare(
      `SELECT e.*, u.name AS payer_name
       FROM expenses e JOIN users u ON u.id = e.payer_id
       WHERE e.id = ?`
    )
    .get(expenseId)) as ExpenseRow | undefined;
}

export async function listExpenses(
  db: Db,
  groupId: string,
  includeDeleted = false
): Promise<ExpenseRow[]> {
  const sql = `SELECT e.*, u.name AS payer_name
    FROM expenses e JOIN users u ON u.id = e.payer_id
    WHERE e.group_id = ? ${includeDeleted ? "" : "AND e.deleted = 0"}
    ORDER BY e.created_at DESC`;
  return (await db.prepare(sql).all(groupId)) as unknown as ExpenseRow[];
}

export async function expenseParticipantIds(db: Db, expenseId: string): Promise<string[]> {
  const rows = (await db
    .prepare("SELECT user_id FROM expense_participants WHERE expense_id = ?")
    .all(expenseId)) as unknown as Array<{ user_id: string }>;
  return rows.map((r) => r.user_id);
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
    payerId?: string;
    participants?: string[];
  }
): Promise<ExpenseRow> {
  const current = (await getExpense(db, expenseId))!;
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE expenses SET
         description = ?, amount = ?, currency = ?, exchange_rate = ?, amount_group = ?, payer_id = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      patch.description ?? current.description,
      patch.amount ?? current.amount,
      patch.currency ?? current.currency,
      patch.exchangeRate ?? current.exchange_rate,
      patch.amountGroup ?? current.amount_group,
      patch.payerId ?? current.payer_id,
      now,
      expenseId
    );
  if (patch.participants) {
    await db.prepare("DELETE FROM expense_participants WHERE expense_id = ?").run(expenseId);
    const ins = db.prepare("INSERT INTO expense_participants (expense_id, user_id) VALUES (?, ?)");
    for (const p of patch.participants) await ins.run(expenseId, p);
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
    createdById: string;
  }
): Promise<PaymentRow> {
  const id = randomUUID();
  await db
    .prepare(
      `INSERT INTO payments (id, group_id, from_user_id, to_user_id, amount, note, created_by_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.groupId,
      input.fromUserId,
      input.toUserId,
      input.amount,
      input.note ?? null,
      input.createdById,
      new Date().toISOString()
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
