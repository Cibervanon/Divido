import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import type { GroupDetail, ExpenseDto, PaymentDto } from "../../../lib/types";
import type { SettlementTransfer } from "@divido/shared";

export function useGroupDetail(groupId: string) {
  return useQuery({
    queryKey: ["group", groupId],
    queryFn: () => api.get<GroupDetail>(`/api/groups/${groupId}`),
    enabled: !!groupId,
  });
}

export function useGroupExpenses(groupId: string) {
  return useQuery({
    queryKey: ["expenses", groupId],
    queryFn: () => api.get<ExpenseDto[]>(`/api/groups/${groupId}/expenses`),
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
    }>(`/api/groups/${groupId}/balances`),
    enabled: !!groupId,
  });
}

export function useGroupMembers(groupId: string) {
  return useQuery({
    queryKey: ["members", groupId],
    queryFn: () => api.get<Array<{ userId: string; name: string; email: string | null; avatarUrl: string | null; role: string; status: string; emailVerified: boolean; isGhost: boolean }>>(`/api/groups/${groupId}/members`),
    enabled: !!groupId,
  });
}

export function useCreateExpense(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => api.post<ExpenseDto>(`/api/groups/${groupId}/expenses`, body),
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
    mutationFn: ({ expenseId, body }: { expenseId: string; body: any }) => api.patch<ExpenseDto>(`/api/expenses/${expenseId}`, body),
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
    mutationFn: (expenseId: string) => api.delete(`/api/expenses/${expenseId}`),
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
    mutationFn: (body: any) => api.post<PaymentDto>(`/api/groups/${groupId}/payments`, body),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["balances", groupId] });
      qc.invalidateQueries({ queryKey: ["group", groupId] });
    },
  });
}

export function useUpdateGroup(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => api.patch(`/api/groups/${groupId}`, body),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["group", groupId] });
    },
  });
}