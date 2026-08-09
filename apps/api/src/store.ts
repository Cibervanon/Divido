import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type {
  Group,
  GroupMember,
  GroupType,
  MemberRole,
  MemberStatus,
} from "@divido/shared";

export type Row = Record<string, unknown>;

export interface UserRow {
  id: string;
  email: string | null;
  password_hash: string | null;
  name: string;
  avatar_url: string | null;
  google_sub: string | null;
  created_at: string;
}

export interface GroupRow {
  id: string;
  name: string;
  currency: string;
  type: GroupType;
  invite_token: string;
  creator_id: string;
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

export function findUserById(db: DatabaseSync, id: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

export function findUserByEmail(db: DatabaseSync, email: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
}

export function findUserByGoogleSub(db: DatabaseSync, sub: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE google_sub = ?").get(sub) as UserRow | undefined;
}

export function createUser(
  db: DatabaseSync,
  input: {
    email: string | null;
    passwordHash?: string;
    name: string;
    avatarUrl?: string | null;
    googleSub?: string;
  }
): UserRow {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, name, avatar_url, google_sub, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.email,
    input.passwordHash ?? null,
    input.name,
    input.avatarUrl ?? null,
    input.googleSub ?? null,
    new Date().toISOString()
  );
  return findUserById(db, id)!;
}

export function linkGoogleToUser(
  db: DatabaseSync,
  userId: string,
  googleSub: string,
  avatarUrl?: string
): void {
  db.prepare("UPDATE users SET google_sub = ?, avatar_url = COALESCE(?, avatar_url) WHERE id = ?").run(
    googleSub,
    avatarUrl ?? null,
    userId
  );
}

// ---------- Groups ----------

export function createGroup(
  db: DatabaseSync,
  input: { name: string; currency: string; type: GroupType; creatorId: string }
): Group {
  const id = randomUUID();
  const inviteToken = randomUUID().replace(/-/g, "").slice(0, 16);
  db.prepare(
    `INSERT INTO groups (id, name, currency, type, invite_token, creator_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.name, input.currency, input.type, inviteToken, input.creatorId, new Date().toISOString());
  addMember(db, {
    groupId: id,
    userId: input.creatorId,
    role: "admin",
    status: "active",
  });
  return getGroup(db, id)!;
}

export function getGroup(db: DatabaseSync, groupId: string): Group | undefined {
  const row = db.prepare("SELECT * FROM groups WHERE id = ?").get(groupId) as GroupRow | undefined;
  return row ? toGroup(row) : undefined;
}

export function getGroupByInviteToken(db: DatabaseSync, token: string): Group | undefined {
  const row = db.prepare("SELECT * FROM groups WHERE invite_token = ?").get(token) as GroupRow | undefined;
  return row ? toGroup(row) : undefined;
}

export function listGroupsForUser(db: DatabaseSync, userId: string): Array<Group & { membership: GroupMember }> {
  const rows = db
    .prepare(
      `SELECT g.* FROM groups g
       JOIN group_members m ON m.group_id = g.id
       WHERE m.user_id = ? AND m.status = 'active'
       ORDER BY g.created_at DESC`
    )
    .all(userId) as unknown as GroupRow[];
  return rows.map((r) => {
    const g = toGroup(r);
    return { ...g, membership: getMembership(db, g.id, userId)! };
  });
}

export function updateGroup(
  db: DatabaseSync,
  groupId: string,
  patch: { name?: string; currency?: string; type?: GroupType }
): Group {
  const current = getGroup(db, groupId)!;
  db.prepare("UPDATE groups SET name = ?, currency = ?, type = ? WHERE id = ?").run(
    patch.name ?? current.name,
    patch.currency ?? current.currency,
    patch.type ?? current.type,
    groupId
  );
  return getGroup(db, groupId)!;
}

// ---------- Members ----------

export function addMember(
  db: DatabaseSync,
  input: { groupId: string; userId: string; role: MemberRole; status: MemberStatus }
): GroupMember {
  db.prepare(
    `INSERT INTO group_members (group_id, user_id, role, status, joined_at, left_at, frozen_balance)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(input.groupId, input.userId, input.role, input.status, new Date().toISOString(), null, null);
  return getMembership(db, input.groupId, input.userId)!;
}

export function getMembership(
  db: DatabaseSync,
  groupId: string,
  userId: string
): GroupMember | undefined {
  const row = db
    .prepare("SELECT * FROM group_members WHERE group_id = ? AND user_id = ?")
    .get(groupId, userId) as MembershipRow | undefined;
  return row ? toMember(row as unknown as MemberRow) : undefined;
}

export function getMemberRow(db: DatabaseSync, groupId: string, userId: string): MemberRow | undefined {
  return db
    .prepare(
      `SELECT m.*, u.name, u.email, u.avatar_url
       FROM group_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.group_id = ? AND m.user_id = ?`
    )
    .get(groupId, userId) as MemberRow | undefined;
}

export function listMembers(db: DatabaseSync, groupId: string): MemberRow[] {
  return db
    .prepare(
      `SELECT m.*, u.name, u.email, u.avatar_url
       FROM group_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.group_id = ?
       ORDER BY m.status = 'ex_member', m.joined_at ASC`
    )
    .all(groupId) as unknown as MemberRow[];
}

export function setRole(db: DatabaseSync, groupId: string, userId: string, role: MemberRole): void {
  db.prepare("UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?").run(role, groupId, userId);
}

export function setMemberStatus(
  db: DatabaseSync,
  groupId: string,
  userId: string,
  status: MemberStatus,
  leftAt?: string | null,
  frozenBalance?: number | null
): void {
  db.prepare(
    `UPDATE group_members SET status = ?, left_at = ?, frozen_balance = ?
     WHERE group_id = ? AND user_id = ?`
  ).run(status, leftAt ?? null, frozenBalance ?? null, groupId, userId);
}

export function removeMember(db: DatabaseSync, groupId: string, userId: string): void {
  db.prepare("DELETE FROM group_members WHERE group_id = ? AND user_id = ?").run(groupId, userId);
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

export function createExpense(db: DatabaseSync, input: CreateExpenseInput): ExpenseRow {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO expenses (id, group_id, payer_id, description, amount, currency, exchange_rate, amount_group, created_by_id, created_at, updated_at, deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
  ).run(
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
  const ins = db.prepare(
    "INSERT INTO expense_participants (expense_id, user_id) VALUES (?, ?)"
  );
  for (const p of input.participants) {
    ins.run(id, p);
  }
  return getExpense(db, id)!;
}

export function getExpense(db: DatabaseSync, expenseId: string): ExpenseRow | undefined {
  return db
    .prepare(
      `SELECT e.*, u.name AS payer_name
       FROM expenses e JOIN users u ON u.id = e.payer_id
       WHERE e.id = ?`
    )
    .get(expenseId) as ExpenseRow | undefined;
}

export function listExpenses(db: DatabaseSync, groupId: string, includeDeleted = false): ExpenseRow[] {
  const sql = `SELECT e.*, u.name AS payer_name
    FROM expenses e JOIN users u ON u.id = e.payer_id
    WHERE e.group_id = ? ${includeDeleted ? "" : "AND e.deleted = 0"}
    ORDER BY e.created_at DESC`;
  return db.prepare(sql).all(groupId) as unknown as ExpenseRow[];
}

export function expenseParticipantIds(db: DatabaseSync, expenseId: string): string[] {
  const rows = db
    .prepare("SELECT user_id FROM expense_participants WHERE expense_id = ?")
    .all(expenseId) as unknown as Array<{ user_id: string }>;
  return rows.map((r) => r.user_id);
}

export function updateExpense(
  db: DatabaseSync,
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
): ExpenseRow {
  const current = getExpense(db, expenseId)!;
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE expenses SET
       description = ?, amount = ?, currency = ?, exchange_rate = ?, amount_group = ?, payer_id = ?, updated_at = ?
     WHERE id = ?`
  ).run(
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
    db.prepare("DELETE FROM expense_participants WHERE expense_id = ?").run(expenseId);
    const ins = db.prepare("INSERT INTO expense_participants (expense_id, user_id) VALUES (?, ?)");
    for (const p of patch.participants) ins.run(expenseId, p);
  }
  return getExpense(db, expenseId)!;
}

export function deleteExpense(db: DatabaseSync, expenseId: string): void {
  db.prepare("UPDATE expenses SET deleted = 1, updated_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    expenseId
  );
}

// ---------- Payments ----------

export function createPayment(
  db: DatabaseSync,
  input: {
    groupId: string;
    fromUserId: string;
    toUserId: string;
    amount: number;
    note?: string;
    createdById: string;
  }
): PaymentRow {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO payments (id, group_id, from_user_id, to_user_id, amount, note, created_by_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.groupId,
    input.fromUserId,
    input.toUserId,
    input.amount,
    input.note ?? null,
    input.createdById,
    new Date().toISOString()
  );
  return getPayment(db, id)!;
}

export function getPayment(db: DatabaseSync, paymentId: string): PaymentRow | undefined {
  return db
    .prepare(
      `SELECT p.*, fu.name AS from_name, tu.name AS to_name
       FROM payments p
       JOIN users fu ON fu.id = p.from_user_id
       JOIN users tu ON tu.id = p.to_user_id
       WHERE p.id = ?`
    )
    .get(paymentId) as PaymentRow | undefined;
}

export function listPayments(db: DatabaseSync, groupId: string): PaymentRow[] {
  return db
    .prepare(
      `SELECT p.*, fu.name AS from_name, tu.name AS to_name
       FROM payments p
       JOIN users fu ON fu.id = p.from_user_id
       JOIN users tu ON tu.id = p.to_user_id
       WHERE p.group_id = ?
       ORDER BY p.created_at DESC`
    )
    .all(groupId) as unknown as PaymentRow[];
}

export function deletePayment(db: DatabaseSync, paymentId: string): void {
  db.prepare("DELETE FROM payments WHERE id = ?").run(paymentId);
}

// ---------- Modification requests ----------

export function createRequest(
  db: DatabaseSync,
  input: {
    groupId: string;
    expenseId: string;
    requesterId: string;
    action: "edit" | "delete";
    payload: Record<string, unknown>;
  }
): RequestRow {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO modification_requests (id, group_id, expense_id, requester_id, action, payload, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
  ).run(
    id,
    input.groupId,
    input.expenseId,
    input.requesterId,
    input.action,
    JSON.stringify(input.payload),
    new Date().toISOString()
  );
  return getRequest(db, id)!;
}

export function getRequest(db: DatabaseSync, requestId: string): RequestRow | undefined {
  return db
    .prepare(
      `SELECT r.*, u.name AS requester_name
       FROM modification_requests r JOIN users u ON u.id = r.requester_id
       WHERE r.id = ?`
    )
    .get(requestId) as RequestRow | undefined;
}

export function listRequests(db: DatabaseSync, groupId: string): RequestRow[] {
  return db
    .prepare(
      `SELECT r.*, u.name AS requester_name
       FROM modification_requests r JOIN users u ON u.id = r.requester_id
       WHERE r.group_id = ?
       ORDER BY r.created_at DESC`
    )
    .all(groupId) as unknown as RequestRow[];
}

export function decideRequest(
  db: DatabaseSync,
  requestId: string,
  status: "approved" | "rejected",
  decidedBy: string
): void {
  db.prepare(
    `UPDATE modification_requests SET status = ?, decided_at = ?, decided_by = ? WHERE id = ?`
  ).run(status, new Date().toISOString(), decidedBy, requestId);
}
