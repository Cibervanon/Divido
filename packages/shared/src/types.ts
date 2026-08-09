export type GroupType = "open" | "closed";
export type MemberRole = "admin" | "member";
export type MemberStatus = "active" | "inactive" | "ex_member";
export type RequestStatus = "pending" | "approved" | "rejected";

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  currency: string;
  type: GroupType;
  inviteToken: string;
  creatorId: string;
  createdAt: string;
}

export interface GroupMember {
  groupId: string;
  userId: string;
  role: MemberRole;
  status: MemberStatus;
  joinedAt: string;
  leftAt: string | null;
  frozenBalance: number | null;
}

export interface Expense {
  id: string;
  groupId: string;
  payerId: string;
  description: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  amountGroup: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
}

export interface ExpenseParticipant {
  expenseId: string;
  userId: string;
  share: number;
}

export interface Payment {
  id: string;
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  note: string | null;
  createdById: string;
  createdAt: string;
}

export interface ModificationRequest {
  id: string;
  groupId: string;
  expenseId: string;
  requesterId: string;
  action: "edit" | "delete";
  payload: Record<string, unknown>;
  status: RequestStatus;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
}

export interface NetBalance {
  userId: string;
  name: string;
  net: number;
  paid: number;
  owed: number;
}

export interface SettlementTransfer {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amount: number;
}

export interface InvitePreview {
  groupId: string;
  groupName: string;
  currency: string;
  memberCount: number;
  existingMember: boolean;
}
