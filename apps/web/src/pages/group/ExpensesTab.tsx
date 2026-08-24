import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { Button, EmptyState, Input, Money, Select, VerifiedBadge } from "../../components/ui";
import type { ExpenseCommentDto, ExpenseDto, ModificationRequestDto } from "../../lib/types";
import { fmtTime } from "./utils";
export function ExpensesTab({
  expenses,
  memberName,
  isAdmin,
  myUserId,
  groupId,
  groupCurrency,
  onEdit,
  onDelete,
  onDuplicate,
  onAdd,
  requests,
  onDecide,
  filters,
  hasActiveFilters,
  onFilterChange,
  onClearFilters,
  onReload,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  expenses: ExpenseDto[];
  memberName: (id: string) => string;
  isAdmin: boolean;
  myUserId: string;
  groupId: string;
  groupCurrency: string;
  onEdit: (e: ExpenseDto) => void;
  onDelete: (e: ExpenseDto) => void;
  onDuplicate: (e: ExpenseDto) => void;
  onAdd: () => void;
  requests: ModificationRequestDto[];
  onDecide: (id: string, d: "approve" | "reject") => void;
  filters: { category?: string; payerId?: string; from?: string; to?: string; q?: string };
  hasActiveFilters: boolean;
  onFilterChange: (key: keyof typeof filters, value: string | undefined) => void;
  onClearFilters: () => void;
  onReload: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  const pending = requests.filter((r) => r.status === "pending");
  const [viewReceipt, setViewReceipt] = useState<string | null>(null);
  const [receiptNotice, setReceiptNotice] = useState("");

  useEffect(() => {
    if (!receiptNotice) return;
    const t = setTimeout(() => setReceiptNotice(""), 3500);
    return () => clearTimeout(t);
  }, [receiptNotice]);

  // Abre el tique con una URL recién firmada (las de nube caducan en 1 h).
  // Si la firma falla, avisamos al usuario en vez de abrir un enlace roto.
  async function openReceipt(expenseId: string, fallback: string | null) {
    try {
      const r = await api.get<{ url: string | null }>(`/expenses/${expenseId}/receipt-url`);
      if (r.url) {
        setViewReceipt(r.url);
        return;
      }
      setReceiptNotice("El tique no está disponible ahora mismo, inténtalo en un momento");
    } catch (err) {
      if (fallback && fallback.startsWith("data:")) {
        setViewReceipt(fallback);
        return;
      }
      setReceiptNotice(
        err instanceof ApiError && err.status === 404
          ? "Este gasto no tiene tique adjunto"
          : "No se pudo abrir el tique"
      );
    }
  }

  // Estado de filtros: multiselección categorías, booleano "Mi pagador", acordeón
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [onlyMyPayments, setOnlyMyPayments] = useState<boolean>(false);
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);

  const categories = [
    { key: "food", label: "Comida" },
    { key: "transport", label: "Transporte" },
    { key: "leisure", label: "Ocio" },
    { key: "housing", label: "Vivienda" },
    { key: "health", label: "Salud" },
    { key: "shopping", label: "Compras" },
    { key: "coffee", label: "Café" },
    { key: "pets", label: "Mascotas" },
    { key: "streaming", label: "Streaming" },
    { key: "sports", label: "Deportes" },
    { key: "events", label: "Eventos" },
    { key: "family", label: "Familia" },
    { key: "general", label: "General" },
  ];

  // Filtrado local en tiempo real
  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const matchesSearch = expense.description.toLowerCase().includes((filters.q ?? "").toLowerCase());
      const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(expense.category);
      const matchesPayer = !onlyMyPayments || expense.payerId === myUserId;
      return matchesSearch && matchesCategory && matchesPayer;
    });
  }, [expenses, selectedCategories, onlyMyPayments, filters.q]);

  const activeFilterCount = selectedCategories.length + (onlyMyPayments ? 1 : 0) + (filters.from ? 1 : 0) + (filters.to ? 1 : 0) + (filters.q ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Filtros: botón único compacto */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsFilterOpen((o) => !o)}
          aria-expanded={isFilterOpen}
          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
            activeFilterCount > 0 || isFilterOpen
              ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300"
              : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
          }`}
        >
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <span>Filtros</span>
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
              ({activeFilterCount})
            </span>
          )}
          <svg className={`h-3.5 w-3.5 shrink-0 transition ${isFilterOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            Limpiar
          </Button>
        )}
      </div>

      {isFilterOpen ? (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
          <Input
            placeholder="Buscar por concepto..."
            value={filters.q ?? ""}
            onChange={(e) => onFilterChange("q", e.target.value || undefined)}
            className="max-w-xs"
          />

          <div className="scrollbar-none flex flex-nowrap gap-2 overflow-x-auto pb-1 pr-2">
            {categories.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => {
                  setSelectedCategories((prev) =>
                    prev.includes(cat.key)
                      ? prev.filter((c) => c !== cat.key)
                      : [...prev, cat.key]
                  );
                }}
                className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition ${
                  selectedCategories.includes(cat.key)
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-slate-200 bg-slate-800"
                }`}
              >
                {cat.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setOnlyMyPayments((v) => !v)}
              className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition ${
                onlyMyPayments
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-slate-200 bg-slate-800"
              }`}
            >
              Mi pagador
            </button>
          </div>

          <details className="group">
            <summary className="cursor-pointer select-none text-xs text-slate-500 hover:text-slate-300">
              Filtros avanzados (fechas)
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <Input
                label="Desde"
                type="date"
                value={filters.from ?? ""}
                onChange={(e) => onFilterChange("from", e.target.value || undefined)}
              />
              <Input
                label="Hasta"
                type="date"
                value={filters.to ?? ""}
                onChange={(e) => onFilterChange("to", e.target.value || undefined)}
              />
            </div>
          </details>
        </div>
      ) : null}

      {pending.length > 0 && isAdmin ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="mb-2 text-sm font-bold text-amber-300">
            Solicitudes pendientes ({pending.length})
          </p>
          <div className="space-y-2">
            {pending.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-900 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs text-slate-200">
                    <strong>{r.requesterName}</strong>{" · "}{r.action === "edit" ? "editar" : "eliminar"}{" "}
                    "{r.expenseDescription}"
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button variant="secondary" size="sm" onClick={() => onDecide(r.id, "approve")}>
                    Aprobar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDecide(r.id, "reject")}>
                    Rechazar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {filteredExpenses.length === 0 ? (
        <EmptyState
          title="Aún no hay gastos en este grupo"
          subtitle="Añade tu primer gasto para empezar a repartir cuentas con tus compañeros"
          icon={
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 13.5V6.75A2.25 2.25 0 018.25 4.5h7.5A2.25 2.25 0 0118 6.75v6.75M6 13.5A1.5 1.5 0 004.5 15v3.75A2.25 2.25 0 006.75 21h10.5a2.25 2.25 0 002.25-2.25V15A1.5 1.5 0 0018 13.5M6 13.5a1.5 1.5 0 001.5 1.5h9a1.5 1.5 0 001.5-1.5M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          }
          action={
            <Button onClick={onAdd}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Añadir primer gasto
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {filteredExpenses.map((e) => (
            <div
              key={e.id}
              className={`rounded-2xl border border-slate-800 bg-slate-900 p-4 transition hover:border-slate-700 ${
                e.deleted ? "opacity-50 grayscale" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-100">
                  {e.description}
                  {e.paidFromPot ? (
                    <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                      Bote común
                    </span>
                  ) : null}
                  {e.deleted ? <span className="ml-2 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-400">eliminado</span> : null}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {e.payerName} pagó{" · "}{e.participantsCount} participante{e.participantsCount !== 1 ? "s" : ""}
                  {e.receiptUrl ? (
                    <button
                      type="button"
                      onClick={() => void openReceipt(e.id, e.receiptUrl)}
                      className="ml-2 inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300 transition hover:bg-slate-700 hover:text-indigo-200"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                        />
                      </svg>
                      tique
                    </button>
                  ) : null}
                </p>
              </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-100">
                    <Money amount={e.amount} currency={e.currency} />
                    {e.currency !== undefined && e.exchangeRate !== 1 ? (
                      <span className="ml-1 text-[10px] font-normal text-slate-500">
                        ≈ <Money amount={e.amountGroup} currency={groupCurrency} />
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {e.shares ? (
                      <span className="text-indigo-300">reparto personalizado</span>
                    ) : (
                      <>cada uno {e.share.toFixed(2)}</>
                    )}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-[11px] text-slate-500">
                  {e.participants.map(memberName).join(", ")}
                  {e.editable ? null : (
                    <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-amber-400">bloqueado</span>
                  )}
                </p>
                <div className="flex gap-1">
                  <IconBtn
                    title="Editar"
                    onClick={() => onEdit(e)}
                    svg={
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z"
                      />
                    }
                  />
                  <IconBtn
                    title="Eliminar"
                    danger
                    onClick={() => onDelete(e)}
                    svg={
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                      />
                    }
                  />
                  <IconBtn
                    title="Duplicar"
                    onClick={() => onDuplicate(e)}
                    svg={
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    }
                  />
                </div>
              </div>
              <ExpenseComments expense={e} groupId={groupId} myUserId={myUserId} />
            </div>
          ))}
        </div>
      )}

      {hasMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="mt-4 w-full rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 py-3 text-sm font-semibold text-indigo-300 transition hover:border-indigo-500 hover:text-indigo-200 disabled:opacity-60"
        >
          {loadingMore ? "Cargando…" : "Cargar más gastos"}
        </button>
      ) : null}

      {viewReceipt ? (
        <div
          className="fixed inset-0 z-[70] flex flex-col bg-black/90"
          onClick={() => setViewReceipt(null)}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm font-semibold text-slate-200">Tique del gasto</p>
            <button
              type="button"
              onClick={() => setViewReceipt(null)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-300 transition hover:bg-slate-700"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-4">
            <img
              src={viewReceipt}
              alt="Tique"
              className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      ) : null}
      {receiptNotice ? (
        <div
          role="status"
          className="fixed inset-x-0 bottom-24 z-[60] mx-auto w-fit max-w-[90vw] rounded-full bg-slate-800 px-4 py-2 text-xs font-medium text-slate-200 shadow-lg"
        >
          {receiptNotice}
        </div>
      ) : null}
    </div>
  );
}

function ExpenseComments({
  expense,
  groupId,
  myUserId,
}: {
  expense: ExpenseDto;
  groupId: string;
  myUserId: string;
}) {
  const [open, setOpen] = useState((expense.comments?.length ?? 0) > 0);
  const [comments, setComments] = useState<ExpenseCommentDto[]>(expense.comments ?? []);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function send() {
    const body = text.trim();
    if (!body) return;
    setError("");
    setSending(true);
    try {
      const res = await api.post<ExpenseCommentDto>(
        `/groups/${groupId}/expenses/${expense.id}/comments`,
        { body }
      );
      setComments((prev) => [...prev, res]);
      setText("");
      setOpen(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo enviar el comentario");
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    setDeletingId(id);
    try {
      await api.delete(`/expenses/${expense.id}/comments/${id}`);
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo eliminar el comentario");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mt-3 border-t border-slate-800 pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 transition hover:text-slate-200"
      >
        <svg
          className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
        Comentarios ({comments.length})
      </button>

      {open ? (
        <div className="mt-2 space-y-2">
          {comments.length > 0 ? (
            <div className="space-y-2">
              {comments.map((c) => (
                <div key={c.id} className="rounded-xl bg-slate-800/60 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1 text-[11px] font-semibold text-slate-300">
                      <span className="truncate">{c.authorName}</span>
                      {c.authorVerified ? <VerifiedBadge size="xs" /> : null}
                    </p>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-[10px] text-slate-500">{fmtTime(c.createdAt)}</span>
                      {c.authorId === myUserId ? (
                        <button
                          type="button"
                          onClick={() => remove(c.id)}
                          disabled={deletingId === c.id}
                          className="text-[10px] font-semibold text-slate-500 transition hover:text-rose-400"
                        >
                          {deletingId === c.id ? "..." : "Eliminar"}
                        </button>
                      ) : null}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-300">{c.body}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-500">Sin comentarios todavía.</p>
          )}
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Añade un comentario..."
              maxLength={500}
              className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-500"
            />
            <Button variant="secondary" className="!px-3 !py-2 text-xs" onClick={() => void send()} loading={sending}>
              Enviar
            </Button>
          </div>
          {error ? <p className="text-[11px] font-medium text-rose-400">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function IconBtn({
  title,
  onClick,
  svg,
  danger,
}: {
  title: string;
  onClick: () => void;
  svg: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`rounded-lg p-1.5 transition ${
        danger ? "text-slate-500 hover:bg-rose-500/10 hover:text-rose-400" : "text-slate-500 hover:bg-slate-800 hover:text-slate-200"
      }`}
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {svg}
      </svg>
    </button>
  );
}

// ---------- Miembros ----------

