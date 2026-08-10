import type { GroupType, SettlementTransfer } from "@divido/shared";

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
}

export interface MemberInfo {
  userId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
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
    createdAt: string;
  };
  inviteUrl: string | null;
  membership: { role: string; status: string } | null;
  myRole: "admin" | "member";
  members: MemberInfo[];
  balances: MemberBalance[];
  transfers: SettlementTransfer[];
  exMembers: ExMemberInfo[];
}

export interface ExpenseDto {
  id: string;
  groupId: string;
  payerId: string;
  payerName: string;
  description: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  amountGroup: number;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  participants: string[];
  share: number;
  participantsCount: number;
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
  type: "expense" | "payment";
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
    payerId: string;
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
