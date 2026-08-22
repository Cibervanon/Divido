import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import type { GroupDetail, ExpenseDto, PaymentDto } from "../../../lib/types";
import type { SettlementTransfer } from "@divido/shared";

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

export function useGroupDetail(groupId: string) {
  return useQuery({
    queryKey: ["group", groupId],
    queryFn: () => api.get<GroupDetail>(`/groups/${groupId}`),
    enabled: !!groupId,
  });
}

export function useGroupExpenses(groupId: string, filters?: { category?: string; payerId?: string; from?: string; to?: string; q?: string }) {
  const queryParams = new URLSearchParams();
  if (filters?.category) queryParams.set("category", filters.category);
  if (filters?.payerId) queryParams.set("payerId", filters.payerId);
  if (filters?.from) queryParams.set("from", filters.from);
  if (filters?.to) queryParams.set("to", filters.to);
  if (filters?.q) queryParams.set("q", filters.q);
  const queryString = queryParams.toString();

  return useQuery({
    queryKey: ["expenses", groupId, filters],
    queryFn: async () => {
      const res = await api.get<{ expenses: ExpenseDto[] }>(`/groups/${groupId}/expenses${queryString ? `?${queryString}` : ""}`);
      return res.expenses;
    },
    enabled: !!groupId,
  });
}

export function useGroupBalances(groupId: string) {
  return useQuery({
    queryKey: ["balances", groupId],
    queryFn: () => api.get<{
      balances: Array<{ userId: string; name: string; net: number; paidForOthers: number; owesOthers: number }>;
      transfers: SettlementTransfer[];
      rawTransfers: SettlementTransfer[];
    }>(`/groups/${groupId}/balances`),
    enabled: !!groupId,
  });
}

export function useGroupMembers(groupId: string) {
  const { data } = useGroupDetail(groupId);
  return useQuery({
    queryKey: ["members", groupId],
    queryFn: () => api.get<GroupDetail>(`/groups/${groupId}`).then((d) => d.members),
    enabled: !!groupId,
    initialData: data?.members,
  });
}

export function useCreateExpense(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => api.post<ExpenseDto>(`/groups/${groupId}/expenses`, body),
    onMutate: async (newExpense) => {
      await qc.cancelQueries({ queryKey: ["expenses", groupId] });
      const previous = qc.getQueryData<ExpenseDto[]>(["expenses", groupId]);
      qc.setQueryData<ExpenseDto[]>(["expenses", groupId], (old = []) => [
        { ...newExpense, id: `optimistic-${Date.now()}`, pending: true } as ExpenseDto,
        ...old,
      ]);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["expenses", groupId], ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["expenses", groupId] });
      qc.invalidateQueries({ queryKey: ["balances", groupId] });
      qc.invalidateQueries({ queryKey: ["group", groupId] });
    },
  });
}

export function useUpdateExpense(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, body }: { expenseId: string; body: any }) => api.patch<ExpenseDto>(`/expenses/${expenseId}`, body),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["expenses", groupId] });
      qc.invalidateQueries({ queryKey: ["balances", groupId] });
      qc.invalidateQueries({ queryKey: ["group", groupId] });
    },
  });
}

export function useDeleteExpense(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => api.delete(`/expenses/${expenseId}`),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["expenses", groupId] });
      qc.invalidateQueries({ queryKey: ["balances", groupId] });
      qc.invalidateQueries({ queryKey: ["group", groupId] });
    },
  });
}

export function useCreatePayment(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => api.post<PaymentDto>(`/groups/${groupId}/payments`, body),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["balances", groupId] });
      qc.invalidateQueries({ queryKey: ["group", groupId] });
    },
  });
}

export function useUpdateGroup(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => api.patch(`/groups/${groupId}`, body),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["group", groupId] });
    },
  });
}

export function useGroupAudit(groupId: string, entityType?: string) {
  return useQuery({
    queryKey: ["audit", groupId, entityType],
    queryFn: () => api.get<{ audit: AuditEntry[] }>(`/groups/${groupId}/audit${entityType ? `?entityType=${entityType}` : ""}`),
    enabled: !!groupId,
  });
}