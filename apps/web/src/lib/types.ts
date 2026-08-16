import type { GroupType, InformalDebtStatus, PiqueKind, SettlementTransfer } from "@divido/shared";

export interface GroupSummary {
  id: string;
  name: string;
  currency: string;
  type: GroupType;
  inviteToken?: string;
  creatorId: string;
  logoUrl: string | null;
  createdAt: string;
  myRole: "admin" | "member";
  myBalance: number;
  totalOwedToMe: number;
  totalOwedByMe: number;
  memberCount: number;
  lastActivity: string;
}

export interface MemberInfo {
  userId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  isGhost: boolean;
  phone: string | null;
  revolut: string | null;
  paypal: string | null;
  role: "admin" | "member";
  status: "active" | "inactive" | "ex_member";
  joinedAt: string;
  leftAt: string | null;
  frozenBalance: number | null;
}

export interface MemberBalance {
  userId: string;
  name: string;
  net: number;
  paidForOthers: number;
  owesOthers: number;
  isMe?: boolean;
  emailVerified?: boolean;
  isGhost?: boolean;
}

export interface ExMemberInfo {
  userId: string;
  name: string;
  frozenBalance: number | null;
  leftAt: string | null;
}

export interface GroupDetail {
  group: {
    id: string;
    name: string;
    currency: string;
    type: GroupType;
    creatorId: string;
    logoUrl: string | null;
    enabledExtras: string[];
    simplifyDebts: boolean;
    createdAt: string;
  };
  inviteUrl: string | null;
  membership: { role: string; status: string } | null;
  myRole: "admin" | "member";
  members: MemberInfo[];
  balances: MemberBalance[];
  transfers: SettlementTransfer[];
  rawTransfers: SettlementTransfer[];
  exMembers: ExMemberInfo[];
}

export interface ExpenseCommentDto {
  id: string;
  expenseId: string;
  authorId: string;
  authorName: string;
  authorVerified: boolean;
  body: string;
  createdAt: string;
}

export interface ExpenseDto {
  id: string;
  groupId: string;
  payerId: string | null;
  payerName: string;
  description: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  amountGroup: number;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  paidFromPot: boolean;
  receiptUrl: string | null;
  participants: string[];
  shares: Record<string, number> | null;
  share: number;
  participantsCount: number;
  comments: ExpenseCommentDto[];
  editable: boolean;
}

export interface PaymentDto {
  id: string;
  groupId: string;
  fromUserId: string;
  toUserId: string;
  fromName: string;
  toName: string;
  amount: number;
  note: string | null;
  proofUrl: string | null;
  status: "confirmed" | "pending_confirmation" | "rejected";
  createdById: string;
  createdAt: string;
}

export interface ModificationRequestDto {
  id: string;
  groupId: string;
  expenseId: string;
  requesterId: string;
  requesterName: string;
  action: "edit" | "delete";
  payload: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  expenseDescription: string;
}

export interface HistoryEvent {
  type: "expense" | "payment" | "member_joined" | "member_left" | "member_removed";
  id: string;
  date: string;
  description?: string;
  amount?: number;
  currency?: string;
  exchangeRate?: number;
  amountGroup?: number;
  payerId?: string;
  payerName?: string;
  participantIds?: string[];
  deleted?: boolean;
  edited?: boolean;
  fromUserId?: string;
  fromName?: string;
  toUserId?: string;
  toName?: string;
  note?: string | null;
  proofUrl?: string | null;
  paymentStatus?: "confirmed" | "pending_confirmation" | "rejected";
  userId?: string;
  userName?: string;
}

export interface BreakdownItem {
  userId: string;
  name: string;
  net: number;
  expenses: Array<{
    id: string;
    description: string;
    amountGroup: number;
    share: number;
    currency: string;
    exchangeRate: number;
    amount: number;
    date: string;
    payerId: string | null;
    paidByMe: boolean;
  }>;
  payments: Array<{ id: string; amount: number; date: string; receivedByMe: boolean }>;
}

export interface BalancesResponse {
  balances: MemberBalance[];
  transfers: SettlementTransfer[];
  exMembers: ExMemberInfo[];
  totalOwedToMe: number;
  totalOwedByMe: number;
}

export interface InformalDebtDto {
  id: string;
  groupId: string;
  creatorId: string;
  kind: PiqueKind;
  amount: number;
  prize: string | null;
  winnerIds: string[];
  loserIds: string[];
  title: string;
  status: InformalDebtStatus;
  createdAt: string;
  winnerNames: string[];
  loserNames: string[];
  winnerIsGhost: boolean[];
  loserIsGhost: boolean[];
}

export type RecurringFrequency = "weekly" | "monthly";

export interface PotContributionDto {
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

export interface RecurringExpenseDto {
  id: string;
  groupId: string;
  title: string;
  amount: number;
  frequency: RecurringFrequency;
  responsibleId: string;
  responsibleName: string;
  createdAt: string;
  active: boolean;
  autoCreate: boolean;
}

export type NotificationType = "EXPENSE_ADDED" | "PAYMENT_SETTLED" | "PIQUE_CREATED" | "RECURRING_EXPENSE";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  linkUrl: string;
  createdAt: string;
}

export interface NotificationPreferences {
  expense: boolean;
  payment: boolean;
  pique: boolean;
  recurring: boolean;
}
