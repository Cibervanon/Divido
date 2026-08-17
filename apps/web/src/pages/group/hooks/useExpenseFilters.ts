import { useSearchParams } from "react-router-dom";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";

export interface ExpenseFilters {
  category?: string;
  payerId?: string;
  from?: string;
  to?: string;
  q?: string;
}

export function useExpenseFilters() {
  const [params, setParams] = useSearchParams();

  const filters: ExpenseFilters = {
    category: params.get("category") ?? undefined,
    payerId: params.get("payerId") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    q: params.get("q") ?? undefined,
  };

  const debouncedQ = useDebouncedValue(filters.q ?? "", 300);

  const setFilter = (key: keyof ExpenseFilters, value: string | undefined) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const clearFilters = () => {
    const next = new URLSearchParams(params);
    next.delete("category");
    next.delete("payerId");
    next.delete("from");
    next.delete("to");
    next.delete("q");
    setParams(next, { replace: true });
  };

  const hasActiveFilters = Boolean(filters.category || filters.payerId || filters.from || filters.to || filters.q);

  return {
    filters,
    debouncedQ,
    setFilter,
    clearFilters,
    hasActiveFilters,
  };
}