import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Avatar, Button, ConfirmPaymentButton, CopyLinkButton, EmptyState, GhostBadge, Input, Modal, Money, Select, Spinner, Tabs, Toast, VerifiedBadge, currencySymbol } from "../components/ui";
import { ExpenseModal } from "../components/ExpenseModal";
import { PaymentModal } from "../components/PaymentModal";
import { BalancesTab } from "./group/BalancesTab";
import { SettingsModal } from "./group/SettingsModal";
import { useExpenseFilters } from "./group/hooks/useExpenseFilters";
import { downloadText, fmtDate, fmtTime, similarNames } from "./group/utils";
import { DebtsTab, NewDebtModal } from "./group/DebtsTab";
import { simplifyDebts, type SimplifyResult } from "../lib/debtSimplifier";
import { getCategoryColor, getIconComponent, MODULE_FALLBACKS } from "../constants/categories";
import type {
  BreakdownItem,
  ExpenseCommentDto,
  ExpenseDto,
  GroupDetail,
  HistoryEvent,
  InformalDebtDto,
  MemberInfo,
  ModificationRequestDto,
  PotContributionDto,
  RecurringExpenseDto,
  RecurringFrequency,
} from "../lib/types";
import type { InformalDebtStatus, PiqueKind, SettlementTransfer } from "@divido/shared";

type Tab = "expenses" | "balances" | "members" | "history" | "debts" | "pot" | "recurring";


const GROUP_EXTRAS: Array<{ key: string; label: string; description: string }> = [
  {
    key: "informal_debts",
    label: "Piques y Apuestas",
    description: "Deudas informales entre miembros (apuestas, favores...), aparte del balance de gastos.",
  },
  {
    key: "common_pot",
    label: "Bote ComÃºn",
    description: "Fondo comÃºn al que los miembros aportan dinero para gastos compartidos.",
  },
  {
    key: "recurring_expenses",
    label: "Gastos Fijos",
    description: "Suscripciones o cuotas recurrentes (mensuales o semanales) con un miembro responsable.",
  },
];

// CachÃ© de sesiÃ³n por grupo: permite navegar entre pestaÃ±as (y volver a un grupo)
// de forma instantÃ¡nea sin pantallas de carga, refrescando en segundo plano.
interface GroupCacheData {
  detail: GroupDetail;
  expenses: ExpenseDto[];
  history: HistoryEvent[];
  requests: ModificationRequestDto[];
  debts: InformalDebtDto[];
  potBalance: number;
  potContributions: PotContributionDto[];
  potLedger: any[];
  recurringExpenses: RecurringExpenseDto[];
  audit: any[];
}
const groupCache = new Map<string, GroupCacheData>();

export default function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, setFilter, clearFilters, hasActiveFilters, debouncedQ } = useExpenseFilters();

  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [expenses, setExpenses] = useState<ExpenseDto[]>([]);
  const [requests, setRequests] = useState<ModificationRequestDto[]>([]);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [debts, setDebts] = useState<InformalDebtDto[]>([]);
  const [potBalance, setPotBalance] = useState(0);
  const [potContributions, setPotContributions] = useState<PotContributionDto[]>([]);
  const [potLedger, setPotLedger] = useState<Array<{
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
  }>>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpenseDto[]>([]);
  const [tab, setTab] = useState<Tab>("expenses");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expensePaging, setExpensePaging] = useState({ total: 0, hasMore: false });
  const [historyPaging, setHistoryPaging] = useState({ total: 0, hasMore: false });
  const [loadingMoreExpenses, setLoadingMoreExpenses] = useState(false);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
  const expenseLimitRef = useRef(50);
  const historyLimitRef = useRef(100);

  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expensePrefill, setExpensePrefill] = useState<{ description: string; amount: string; payerId: string } | null>(
    null
  );
  const [showPayment, setShowPayment] = useState(false);
  const [showNewDebt, setShowNewDebt] = useState(false);
  const [showNewContribution, setShowNewContribution] = useState(false);
  const [showNewRecurring, setShowNewRecurring] = useState(false);
  const [editTarget, setEditTarget] = useState<ExpenseDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseDto | null>(null);
  const [breakdownTarget, setBreakdownTarget] = useState<MemberInfo | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [memberDetail, setMemberDetail] = useState<{ member: MemberInfo; data: BreakdownItem[] } | null>(null);
  const [viewProof, setViewProof] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }

  const isAdmin = detail?.myRole === "admin";

  const applyData = useCallback((data: GroupCacheData) => {
    setDetail(data.detail);
    setExpenses(data.expenses);
    setHistory(data.history);
    setRequests(data.requests);
    setDebts(data.debts);
    setPotBalance(data.potBalance);
    setPotContributions(data.potContributions);
    setPotLedger(data.potLedger ?? []);
    setRecurringExpenses(data.recurringExpenses);
    setAudit(data.audit ?? []);
  }, []);

  const load = useCallback(
    async (opts?: { silent?: boolean; filters?: { category?: string; payerId?: string; from?: string; to?: string; q?: string } }) => {
      if (!groupId) return;
      const cached = groupCache.get(groupId);
      // Solo mostramos la pantalla de carga si no hay nada que pintar todavÃ­a.
      if (!cached && !opts?.silent) setLoading(true);
      try {
        const activeFilters = opts?.filters ?? {
          category: filters.category,
          payerId: filters.payerId === "my" ? user?.id : filters.payerId,
          from: filters.from,
          to: filters.to,
          q: debouncedQ,
        };
        const queryParams = new URLSearchParams();
        if (activeFilters.category) queryParams.set("category", activeFilters.category);
        if (activeFilters.payerId) queryParams.set("payerId", activeFilters.payerId);
        if (activeFilters.from) queryParams.set("from", activeFilters.from);
        if (activeFilters.to) queryParams.set("to", activeFilters.to);
        if (activeFilters.q) queryParams.set("q", activeFilters.q);
        // PaginaciÃ³n: la primera carga trae una pÃ¡gina; los refrescos silenciosos
        // mantienen el tamaÃ±o ya cargado para no perder filas en pantalla.
        if (!cached) {
          expenseLimitRef.current = 50;
          historyLimitRef.current = 100;
        }
        queryParams.set("limit", String(expenseLimitRef.current));
        queryParams.set("offset", "0");
        const queryString = queryParams.toString();
        const expensesUrl = `/groups/${groupId}/expenses${queryString ? `?${queryString}` : ""}`;

        const [d, e, h, r, dd, pot, rec, a] = await Promise.all([
          api.get<GroupDetail>(`/groups/${groupId}`),
          api.get<{ expenses: ExpenseDto[]; total: number; hasMore?: boolean }>(expensesUrl),
          api
            .get<{ events: HistoryEvent[]; total: number; hasMore?: boolean }>(
              `/groups/${groupId}/history?limit=${historyLimitRef.current}&offset=0`
            ),
          api.get<{ requests: ModificationRequestDto[] }>(`/groups/${groupId}/requests`).catch(() => null),
          api.get<{ debts: InformalDebtDto[] }>(`/groups/${groupId}/informal-debts`).catch(() => null),
          api
            .get<{ balance: number; contributions: PotContributionDto[]; ledger: any[] }>(`/groups/${groupId}/common-pot`)
            .catch(() => null),
          api.get<{ expenses: RecurringExpenseDto[] }>(`/groups/${groupId}/recurring`).catch(() => null),
          api.get<{ audit: any[] }>(`/groups/${groupId}/audit`).catch(() => ({ audit: [] })),
        ]);
        expenseLimitRef.current = Math.max(50, e.expenses.length);
        historyLimitRef.current = Math.max(100, h.events.length);
        setExpensePaging({
          total: typeof e.total === "number" ? e.total : e.expenses.length,
          hasMore: !!e.hasMore,
        });
        setHistoryPaging({
          total: typeof h.total === "number" ? h.total : h.events.length,
          hasMore: !!h.hasMore,
        });
        const data: GroupCacheData = {
          detail: d,
          expenses: e.expenses,
          history: h.events,
          requests: r?.requests ?? [],
          debts: dd?.debts ?? [],
          potBalance: pot?.balance ?? 0,
          potContributions: pot?.contributions ?? [],
          potLedger: pot?.ledger ?? [],
          recurringExpenses: rec?.expenses ?? [],
          audit: a?.audit ?? [],
        };
        groupCache.set(groupId, data);
        applyData(data);
        setError("");
      } catch (err) {
        if (!cached) setError(err instanceof ApiError ? err.message : "Error cargando el grupo");
      } finally {
        setLoading(false);
      }
    },
    [groupId, applyData]
  );

  const loadMoreExpenses = useCallback(
    async () => {
      if (!groupId || loadingMoreExpenses) return;
      setLoadingMoreExpenses(true);
      try {
        const activeFilters = {
          category: filters.category,
          payerId: filters.payerId === "my" ? user?.id : filters.payerId,
          from: filters.from,
          to: filters.to,
          q: debouncedQ,
        };
        const qp = new URLSearchParams();
        if (activeFilters.category) qp.set("category", activeFilters.category);
        if (activeFilters.payerId) qp.set("payerId", activeFilters.payerId);
        if (activeFilters.from) qp.set("from", activeFilters.from);
        if (activeFilters.to) qp.set("to", activeFilters.to);
        if (activeFilters.q) qp.set("q", activeFilters.q);
        qp.set("limit", "50");
        qp.set("offset", String(expenseLimitRef.current));
        const res = await api.get<{ expenses: ExpenseDto[]; total: number; hasMore?: boolean }>(
          `/groups/${groupId}/expenses?${qp.toString()}`
        );
        setExpenses((prev) => {
          const seen = new Set(prev.map((x) => x.id));
          return [...prev, ...res.expenses.filter((x) => !seen.has(x.id))];
        });
        expenseLimitRef.current = expenseLimitRef.current + res.expenses.length;
        setExpensePaging({ total: typeof res.total === "number" ? res.total : 0, hasMore: !!res.hasMore });
      } catch {
        showToast("No se pudieron cargar mÃ¡s gastos");
      } finally {
        setLoadingMoreExpenses(false);
      }
    },
    [groupId, filters, debouncedQ, user?.id, loadingMoreExpenses]
  );

  const loadMoreHistory = useCallback(
    async () => {
      if (!groupId || loadingMoreHistory) return;
      setLoadingMoreHistory(true);
      try {
        const res = await api.get<{ events: HistoryEvent[]; total: number; hasMore?: boolean }>(
          `/groups/${groupId}/history?limit=100&offset=${historyLimitRef.current}`
        );
        setHistory((prev) => {
          const seen = new Set(prev.map((x) => `${(x as any).type}-${(x as any).id}`));
          const fresh = res.events.filter((x) => !seen.has(`${(x as any).type}-${(x as any).id}`));
          return [...prev, ...fresh];
        });
        historyLimitRef.current = historyLimitRef.current + res.events.length;
        setHistoryPaging({ total: typeof res.total === "number" ? res.total : 0, hasMore: !!res.hasMore });
      } catch {
        showToast("No se pudo cargar mÃ¡s actividad");
      } finally {
        setLoadingMoreHistory(false);
      }
    },
    [groupId, loadingMoreHistory]
  );

  useEffect(() => {
    if (!groupId) return;
    const cached = groupCache.get(groupId);
    if (cached) {
      // Render inmediato desde cachÃ© y refresco silencioso en segundo plano.
      applyData(cached);
      setLoading(false);
      load({ silent: true });
    } else {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, groupId]);

  if (loading && !detail) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!detail || !user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center">
        <p className="text-sm text-slate-400">{error || "Grupo no encontrado"}</p>
        <Link to="/" className="text-sm font-semibold text-indigo-400 hover:text-indigo-300">
          Volver al inicio
        </Link>
      </div>
    );
  }

  const g = detail;
  const { group } = g;
  const hasDebts = (detail.group.enabledExtras ?? []).includes("informal_debts");
  const hasPot = (detail.group.enabledExtras ?? []).includes("common_pot");
  const hasRecurring = (detail.group.enabledExtras ?? []).includes("recurring_expenses");
  const myBalance = g.balances.find((b) => b.isMe)?.net ?? 0;
  const positive = myBalance > 0.004;
  const negative = myBalance < -0.004;
  const balanceColor = positive ? "text-emerald-400" : negative ? "text-rose-400" : "text-slate-400";

  async function copyInvite() {
    if (!g.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(g.inviteUrl);
    } catch {
      window.prompt("Copia este enlace de invitaciÃ³n:", g.inviteUrl);
    }
    showToast("Enlace de invitaciÃ³n copiado");
  }

  async function leaveGroup() {
    if (!confirm("Â¿Abandonar este grupo? Tu balance quedarÃ¡ congelado y visible para los demÃ¡s.")) return;
    try {
      await api.post(`/groups/${groupId}/leave`);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error");
    }
  }

  async function handleExpenseCreated() {
    await load();
  }

  function openAddExpense(prefill?: { description: string; amount: string; payerId: string } | null) {
    setExpensePrefill(prefill ?? null);
    setShowAddExpense(true);
  }

  async function requestDelete(expense: ExpenseDto) {
    try {
      if (expense.editable) {
        await api.delete(`/expenses/${expense.id}`);
      } else {
        await api.post(`/expenses/${expense.id}/modification-request`, { action: "delete" });
      }
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error");
    }
  }

  async function decideRequest(requestId: string, decision: "approve" | "reject") {
    try {
      await api.post(`/requests/${requestId}/${decision}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error");
    }
  }

  async function openBreakdown(member: MemberInfo) {
    try {
      const res = await api.get<{ breakdown: BreakdownItem[] }>(
        `/groups/${groupId}/members/${member.userId}/breakdown`
      );
      setMemberDetail({ member, data: res.breakdown });
    } catch {
      setError("No se pudo cargar el detalle");
    }
  }

  const memberName = (id: string) => detail.members.find((m) => m.userId === id)?.name ?? "Usuario";

  return (
    <div className="min-h-screen bg-slate-950 pb-28">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link to="/" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <Avatar name={group.name} url={group.logoUrl} size="md" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-extrabold text-slate-100">{group.name}</h1>
            <p className="text-[11px] text-slate-500">
              {group.type === "closed" ? "Cerrado" : "Abierto"} Â· {group.currency}
              {detail.members.length > 0 ? ` Â· ${detail.members.length} miembros` : ""}
            </p>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
            aria-label="Ajustes"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.43.992a6.759 6.759 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      {error ? (
        <div className="mx-auto max-w-2xl px-4 pt-4">
          <p className="rounded-xl bg-rose-500/10 px-4 py-2.5 text-xs text-rose-400">{error}</p>
        </div>
      ) : null}

      <main className="mx-auto max-w-2xl px-4 pt-5 pb-32">
        <div className="mb-5 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Tu balance</p>
          <p className={`mt-1 text-3xl font-extrabold ${balanceColor}`}>
            {negative ? "-" : ""}
            <Money amount={Math.abs(myBalance)} currency={group.currency} />
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {positive ? (
              <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-400">
                Te deben <Money amount={myBalance} currency={group.currency} />
              </span>
            ) : null}
            {negative ? (
              <span className="rounded-lg bg-rose-500/10 px-2.5 py-1 font-semibold text-rose-400">
                Debes <Money amount={-myBalance} currency={group.currency} />
              </span>
            ) : null}
            {!positive && !negative ? (
              <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-400">
                Al dÃ­a
              </span>
            ) : null}
          </div>
        </div>

        <Tabs
          tabs={[
            { key: "expenses", label: "Gastos" },
            { key: "balances", label: "Saldos" },
            { key: "members", label: "Miembros" },
            { key: "history", label: "Actividad" },
            ...(hasDebts ? [{ key: "debts", label: "Piques" }] : []),
            ...(hasPot ? [{ key: "pot", label: "Bote" }] : []),
            ...(hasRecurring ? [{ key: "recurring", label: "Fijos" }] : []),
          ]}
          active={tab}
          onChange={(k) => setTab(k as Tab)}
        />

        <div className="mt-5">
          {tab === "expenses" ? (
            <ExpensesTab
              expenses={expenses}
              memberName={memberName}
              isAdmin={isAdmin}
              myUserId={user.id}
              groupId={group.id}
              groupCurrency={group.currency}
              onEdit={(e) => setEditTarget(e)}
              onDelete={(e) => setDeleteTarget(e)}
              onAdd={() => openAddExpense()}
              requests={requests}
              onDecide={decideRequest}
              filters={filters}
              hasActiveFilters={hasActiveFilters}
              onFilterChange={setFilter}
              onClearFilters={clearFilters}
              hasMore={expensePaging.hasMore}
              loadingMore={loadingMoreExpenses}
              onLoadMore={() => void loadMoreExpenses()}
              onReload={() => load({ filters: {
                category: filters.category,
                payerId: filters.payerId === "my" ? user.id : filters.payerId,
                from: filters.from,
                to: filters.to,
                q: debouncedQ,
              } })}
            />
          ) : null}
          {tab === "balances" ? (
            <BalancesTab detail={detail} expenses={expenses} myUserId={user.id} onOpenMember={openBreakdown} onToast={showToast} />
          ) : null}
          {tab === "members" ? (
            <MembersTab
              detail={detail}
              myUserId={user.id}
              myName={user.name}
              isAdmin={isAdmin}
              onCopyInvite={copyInvite}
              onChanged={load}
              onOpenMember={openBreakdown}
              onToast={showToast}
            />
          ) : null}
          {tab === "history" ? (
            <HistoryTab
              events={history}
              audit={audit}
              currency={group.currency}
              groupName={group.name}
              memberName={memberName}
              myUserId={user.id}
              onChanged={load}
              hasMore={historyPaging.hasMore}
              loadingMore={loadingMoreHistory}
              onLoadMore={() => void loadMoreHistory()}
              onViewProof={(url) => setViewProof(url)}
              onOpenExpense={(expenseId) => setEditTarget(expenses.find((e) => e.id === expenseId) ?? null)}
            />
          ) : null}
          {tab === "debts" && hasDebts ? (
            <DebtsTab
              debts={debts}
              members={detail.members}
              myUserId={user.id}
              currency={group.currency}
              onChanged={load}
              onNew={() => setShowNewDebt(true)}
            />
          ) : null}
          {tab === "pot" && hasPot ? (
            <PotTab
              balance={potBalance}
              contributions={potContributions}
              ledger={potLedger ?? []}
              myUserId={user.id}
              isAdmin={isAdmin}
              currency={group.currency}
              onChanged={load}
              onNew={() => setShowNewContribution(true)}
              onOpenExpense={(expenseId) => setEditTarget(expenses.find(e => e.id === expenseId)!) }
            />
          ) : null}
          {tab === "recurring" && hasRecurring ? (
            <RecurringTab
              expenses={recurringExpenses}
              myUserId={user.id}
              isAdmin={isAdmin}
              currency={group.currency}
              onChanged={load}
              onNew={() => setShowNewRecurring(true)}
              onGenerate={(re) =>
                openAddExpense({
                  description: re.title,
                  amount: String(re.amount),
                  payerId: re.responsibleId,
                })
              }
            />
          ) : null}
        </div>
      </main>

      <div className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 gap-3">
        <button
          onClick={() => setShowPayment(true)}
          className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 shadow-xl transition hover:bg-slate-800 active:scale-95"
        >
          <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
          </svg>
          Pagar
        </button>
        <button
          onClick={() => openAddExpense()}
          className="flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-indigo-900/40 transition hover:bg-indigo-500 active:scale-95"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Gasto
        </button>
      </div>

      <ExpenseModal
        open={showAddExpense}
        onClose={() => {
          setShowAddExpense(false);
          setExpensePrefill(null);
        }}
        groupId={group.id}
        groupCurrency={group.currency}
        members={detail.members}
        defaultPayerId={expensePrefill?.payerId ?? user.id}
        defaultDescription={expensePrefill?.description ?? ""}
        defaultAmount={expensePrefill?.amount ?? ""}
        hasPot={hasPot}
        potBalance={potBalance}
        onCreated={handleExpenseCreated}
      />

      <PaymentModal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        groupId={group.id}
        members={detail.members}
        me={user.id}
        onCreated={handleExpenseCreated}
      />

      {editTarget ? (
        <ExpenseModal
          open={Boolean(editTarget)}
          onClose={() => setEditTarget(null)}
          groupId={group.id}
          groupCurrency={group.currency}
          members={detail.members}
          defaultPayerId={user.id}
          hasPot={hasPot}
          potBalance={potBalance}
          onCreated={handleExpenseCreated}
          expense={editTarget}
          locked={!editTarget.editable}
        />
      ) : null}

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={deleteTarget?.editable ? "Eliminar gasto" : "Solicitar eliminaciÃ³n"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => deleteTarget && requestDelete(deleteTarget)}>
              {deleteTarget?.editable ? "Eliminar" : "Enviar solicitud"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          {deleteTarget?.editable
            ? `Â¿Eliminar "${deleteTarget.description}"?`
            : `"${deleteTarget?.description}" supera las 24 horas. EnvÃ­a la solicitud y un administrador la revisarÃ¡.`}
        </p>
      </Modal>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        detail={detail}
        isAdmin={isAdmin}
        onLeave={leaveGroup}
        onChanged={load}
      />

      <MemberDetailModal
        data={memberDetail}
        onClose={() => setMemberDetail(null)}
        currency={group.currency}
      />

      <NewDebtModal
        open={showNewDebt}
        onClose={() => setShowNewDebt(false)}
        groupId={group.id}
        currency={group.currency}
        members={detail.members}
        onCreated={load}
      />

      <NewContributionModal
        open={showNewContribution}
        onClose={() => setShowNewContribution(false)}
        groupId={group.id}
        currency={group.currency}
        onCreated={load}
      />

      <NewRecurringModal
        open={showNewRecurring}
        onClose={() => setShowNewRecurring(false)}
        groupId={group.id}
        currency={group.currency}
        members={detail.members}
        onCreated={load}
      />

      <Toast show={Boolean(toast)}>{toast}</Toast>

      {viewProof ? (
        <div
          className="fixed inset-0 z-[70] flex flex-col bg-black/90"
          onClick={() => setViewProof(null)}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm font-semibold text-slate-200">Comprobante del pago</p>
            <button
              type="button"
              onClick={() => setViewProof(null)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-300 transition hover:bg-slate-700"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-4">
            <img
              src={viewProof}
              alt="Comprobante"
              className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------- Gastos ----------

function ExpensesTab({
  expenses,
  memberName,
  isAdmin,
  myUserId,
  groupId,
  groupCurrency,
  onEdit,
  onDelete,
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

  // Estado de filtros: multiselecciÃ³n categorÃ­as, booleano "Mi pagador", acordeÃ³n
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
    { key: "coffee", label: "CafÃ©" },
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
      {/* Filtros: botÃ³n Ãºnico compacto */}
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
                    <strong>{r.requesterName}</strong> Â· {r.action === "edit" ? "editar" : "eliminar"}{" "}
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
          title="AÃºn no hay gastos en este grupo"
          subtitle="AÃ±ade tu primer gasto para empezar a repartir cuentas con tus compaÃ±eros"
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
              AÃ±adir primer gasto
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
                      Bote comÃºn
                    </span>
                  ) : null}
                  {e.deleted ? <span className="ml-2 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-400">eliminado</span> : null}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {e.payerName} pagÃ³ Â· {e.participantsCount} participante{e.participantsCount !== 1 ? "s" : ""}
                  {e.receiptUrl ? (
                    <button
                      type="button"
                      onClick={() => setViewReceipt(e.receiptUrl)}
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
                        â‰ˆ <Money amount={e.amountGroup} currency={groupCurrency} />
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
          {loadingMore ? "Cargandoâ€¦" : "Cargar mÃ¡s gastos"}
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
            <p className="text-[11px] text-slate-500">Sin comentarios todavÃ­a.</p>
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
              placeholder="AÃ±ade un comentario..."
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

function MembersTab({
  detail,
  myUserId,
  myName,
  isAdmin,
  onCopyInvite,
  onChanged,
  onOpenMember,
  onToast,
}: {
  detail: GroupDetail;
  myUserId: string;
  myName: string;
  isAdmin: boolean;
  onCopyInvite: () => void;
  onChanged: () => void;
  onOpenMember: (m: MemberInfo) => void;
  onToast: (msg: string) => void;
}) {
  const { group, members } = detail;
  const active = members.filter((m) => m.status === "active");
  const ex = members.filter((m) => m.status === "ex_member");
  const [ghostOpen, setGhostOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const matchingGhosts = active.filter((m) => m.isGhost && m.userId !== myUserId && similarNames(m.name, myName));

  async function claimGhost(ghost: MemberInfo) {
    setClaiming(true);
    try {
      await api.post(`/groups/${group.id}/claim-ghost`, { ghostUserId: ghost.userId });
      onChanged();
      onToast(`Perfil de ${ghost.name} reclamado. Su historial ahora es tuyo`);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Error");
    } finally {
      setClaiming(false);
    }
  }

  async function sendClaimLink(ghost: MemberInfo) {
    try {
      const res = await api.post<{ claimUrl: string }>(
        `/groups/${group.id}/ghost-members/${ghost.userId}/claim-token`
      );
      try {
        await navigator.clipboard.writeText(res.claimUrl);
      } catch {
        window.prompt("Copia este texto:", res.claimUrl);
      }
      onToast("Enlace de reclamaciÃ³n copiado. CompÃ¡rtelo con esa persona");
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Error");
    }
  }

  async function setRole(userId: string, role: "admin" | "member") {
    try {
      await api.post(`/groups/${group.id}/members/${userId}/role`, { role });
      onChanged();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Error");
    }
  }

  async function removeMember(userId: string, name: string) {
    if (!confirm(`Â¿Expulsar a ${name} del grupo?`)) return;
    try {
      await api.delete(`/groups/${group.id}/members/${userId}`);
      onChanged();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Error");
    }
  }

  return (
    <div className="space-y-5">
      {matchingGhosts.length > 0 ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-sm font-semibold text-amber-200">
            Â¿Eres {matchingGhosts[0].name}?
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Hay un participante sin cuenta con un nombre parecido al tuyo. ReclÃ¡malo para conservar su historial en el grupo.
          </p>
          <Button
            variant="secondary"
            className="mt-3 !px-3 !py-1.5 text-xs"
            loading={claiming}
            onClick={() => claimGhost(matchingGhosts[0])}
          >
            Reclamar mi perfil
          </Button>
        </div>
      ) : null}

      {isAdmin ? (
        <div className="space-y-2">
          <CopyLinkButton url={detail.inviteUrl ?? ""} />
          <button
            onClick={() => setGhostOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-600 bg-slate-800/40 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            AÃ±adir participante sin correo
          </button>
        </div>
      ) : null}

      <div className="space-y-2">
        {active.map((m) => {
          const isMe = m.userId === myUserId;
          return (
            <button
              key={m.userId}
              onClick={() => onOpenMember(m)}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-left transition hover:border-slate-700"
            >
              <div className="shrink-0">
                <Avatar name={m.name} url={m.avatarUrl} size="sm" />
              </div>
              <div className="flex flex-col justify-center min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-200">{m.name}</p>
                <span className="mt-0.5 text-xs text-slate-400">
                  {m.isGhost ? (
                    <span className="inline-flex items-center gap-1">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                      </svg>
                      SIN CUENTA
                    </span>
                  ) : (
                    <>
                      {m.userId === group.creatorId ? "Creador" : m.role === "admin" ? "Administrador" : "Miembro"}
                      {isMe ? " Â· tÃº" : null}
                      {m.emailVerified ? " Â· " : null}
                      {m.emailVerified && <VerifiedBadge size="xs" />}
                    </>
                  )}
                </span>
              </div>
              {isAdmin && !isMe && m.userId !== group.creatorId ? (
                <div className="flex items-center gap-1.5 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                  {m.isGhost ? (
                    <Button variant="ghost" size="sm" onClick={() => sendClaimLink(m)}>
                      Enviar enlace
                    </Button>
                  ) : null}
                  {!m.isGhost ? (
                    m.role === "admin" ? (
                      <Button variant="ghost" size="sm" onClick={() => setRole(m.userId, "member")}>
                        Quitar admin
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setRole(m.userId, "admin")}>
                        Hacer admin
                      </Button>
                    )
                  ) : null}
                  <Button variant="ghost" size="sm" className="text-rose-400" onClick={() => removeMember(m.userId, m.name)}>
                    Expulsar
                  </Button>
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      {ex.length > 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Exmiembros</p>
          {ex.map((m) => (
            <div key={m.userId} className="flex items-center justify-between py-1 text-sm">
              <span className="text-slate-400">{m.name}</span>
              <span className={`text-xs font-semibold ${(m.frozenBalance ?? 0) !== 0 ? "text-amber-400" : "text-slate-600"}`}>
                saldo {m.frozenBalance?.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {ghostOpen ? (
        <AddGhostModal open onClose={() => setGhostOpen(false)} groupId={group.id} onCreated={onChanged} />
      ) : null}
    </div>
  );
}

function PotTab({
  balance,
  contributions,
  ledger,
  myUserId,
  isAdmin,
  currency,
  onChanged,
  onNew,
  onOpenExpense,
}: {
  balance: number;
  contributions: PotContributionDto[];
  ledger: Array<{
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
  }>;
  myUserId: string;
  isAdmin: boolean;
  currency: string;
  onChanged: () => void;
  onNew: () => void;
  onOpenExpense?: (expenseId: string) => void;
}) {
  async function removeContribution(contribution: PotContributionDto) {
    if (!confirm(`Â¿Eliminar la aportaciÃ³n de ${contribution.userName}?`)) return;
    try {
      await api.delete(`/groups/${contribution.groupId}/common-pot/contributions/${contribution.id}`);
      onChanged();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Error");
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-slate-900/50 p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">Saldo del bote comÃºn</p>
        <p className="mt-1 text-3xl font-extrabold text-emerald-300">
          <Money amount={Math.max(0, balance)} currency={currency} />
        </p>
        <p className="mt-1 text-xs text-slate-500">Dinero aportado por los miembros para gastos compartidos del grupo</p>
        {contributions.length > 0 ? (
          <Button variant="secondary" className="mt-4" onClick={onNew}>
            Aportar al bote
          </Button>
        ) : null}
      </div>

      {balance < 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-[11px] text-slate-400">
          <div className="flex items-start gap-2">
            <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <p>El bote comÃºn no tiene saldo disponible. Las aportaciones y gastos pagados se mantienen en el historial inferior.</p>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Extracto del bote</p>
        {contributions.length === 0 ? (
          <EmptyState
            title="El bote estÃ¡ vacÃ­o"
            subtitle="Cada miembro puede aportar dinero para gastos compartidos del grupo"
            icon={
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z"
                />
              </svg>
            }
            action={
              <Button onClick={onNew}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                AÃ±adir dinero al bote
              </Button>
            }
          />
        ) : (
          contributions.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3"
            >
              <Avatar name={c.userName} url={c.userAvatar} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-200">{c.userName}</p>
                <p className="truncate text-[11px] text-slate-500">
                  {c.note ? `${c.note} Â· ` : ""}
                  {fmtDate(c.createdAt)}
                </p>
              </div>
              <span
                className={`shrink-0 text-sm font-bold ${
                  c.amount < 0 ? "text-rose-400" : "text-emerald-400"
                }`}
              >
                <Money amount={c.amount} currency={currency} />
              </span>
              {c.expenseId ? (
                <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                  Saldado con Bote
                </span>
              ) : null}
              {!c.expenseId && (isAdmin || c.userId === myUserId) ? (
                <button
                  onClick={() => void removeContribution(c)}
                  className="shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-rose-400"
                  title="Eliminar aportaciÃ³n"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>

      <p className="text-center text-[11px] text-slate-600">
        Las aportaciones al bote no afectan al balance de gastos compartidos.
      </p>
    </div>
  );
}

function NewContributionModal({
  open,
  onClose,
  groupId,
  currency,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  groupId: string;
  currency: string;
  onCreated: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setAmount("");
      setNote("");
      setError("");
    }
  }, [open]);

  async function submit() {
    setLoading(true);
    setError("");
    try {
      await api.post(`/groups/${groupId}/common-pot/contributions`, {
        amount: parseFloat(amount),
        note: note.trim(),
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  const amountNum = parseFloat(amount);
  const canSubmit = Number.isFinite(amountNum) && amountNum > 0 && !loading;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Aportar al bote comÃºn"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit} loading={loading}>
            Aportar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          El importe se suma al saldo del bote del grupo. Apunta un concepto para que los demÃ¡s sepan a quÃ© se destina.
        </p>
        <Input
          label="Importe"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          rightElement={<span className="text-xs font-semibold text-slate-400">{currency}</span>}
        />
        <Input label="Concepto (opcional)" placeholder="Ej. Caja para la barbacoa" value={note} onChange={(e) => setNote(e.target.value)} />
        {error ? <p className="text-xs font-medium text-rose-400">{error}</p> : null}
      </div>
    </Modal>
  );
}

// ---------- Gastos fijos ----------

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: "Semanal",
  monthly: "Mensual",
};

function RecurringTab({
  expenses,
  myUserId,
  isAdmin,
  currency,
  onChanged,
  onNew,
  onGenerate,
}: {
  expenses: RecurringExpenseDto[];
  myUserId: string;
  isAdmin: boolean;
  currency: string;
  onChanged: () => void;
  onNew: () => void;
  onGenerate: (expense: RecurringExpenseDto) => void;
}) {
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function toggleActive(expense: RecurringExpenseDto) {
    setTogglingId(expense.id);
    try {
      await api.patch(`/recurring/${expense.id}/toggle`, { active: !expense.active });
      onChanged();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Error");
    } finally {
      setTogglingId(null);
    }
  }

  async function removeExpense(expense: RecurringExpenseDto) {
    if (!confirm(`Â¿Eliminar la cuota fija "${expense.title}"?`)) return;
    try {
      await api.delete(`/recurring/${expense.id}`);
      onChanged();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Error");
    }
  }

  const canManage = (expense: RecurringExpenseDto) => isAdmin || expense.responsibleId === myUserId;
  const sorted = [...expenses].sort((a, b) => Number(b.active) - Number(a.active));

  return (
    <div className="space-y-4">
      {sorted.length > 0 ? (
        <button
          onClick={onNew}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-indigo-500/50 bg-indigo-500/5 px-4 py-3 text-sm font-semibold text-indigo-300 transition hover:bg-indigo-500/10"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          AÃ±adir cuota fija
        </button>
      ) : null}

      {sorted.length === 0 ? (
        <EmptyState
          title="Sin cuotas ni suscripciones periÃ³dicas configuradas"
          subtitle="Programa aquÃ­ suscripciones o cuotas que se repiten cada mes o cada semana"
          icon={
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
              />
            </svg>
          }
          action={
            <Button onClick={onNew}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Programar gasto fijo
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {sorted.map((expense) => (
            <div
              key={expense.id}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                expense.active ? "border-slate-800 bg-slate-900" : "border-slate-800/50 bg-slate-900/40 opacity-60"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-200">{expense.title}</p>
                <p className="truncate text-[11px] text-slate-500">
                  {FREQUENCY_LABELS[expense.frequency]} Â· Responsable: {expense.responsibleName}
                  {expense.active ? "" : " Â· Pausada"}
                </p>
                <span
                  className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    expense.autoCreate
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-amber-500/10 text-amber-400"
                  }`}
                  title={
                    expense.autoCreate
                      ? "Se genera el gasto automÃ¡ticamente cuando vence"
                      : "Solo recuerda: el gasto se registra manualmente"
                  }
                >
                  {expense.autoCreate ? "Autoregistro" : "Recordatorio"}
                </span>
              </div>
              <span className="shrink-0 text-sm font-bold text-slate-100">
                <Money amount={expense.amount} currency={currency} />
              </span>
              <button
                onClick={() => onGenerate(expense)}
                disabled={!expense.active}
                className="shrink-0 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-300 transition hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                title="Abre el formulario de gasto con los datos de esta cuota ya rellenados"
              >
                Generar gasto ahora
              </button>
              {canManage(expense) ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => void toggleActive(expense)}
                    disabled={togglingId === expense.id}
                    title={expense.active ? "Pausar cuota" : "Reactivar cuota"}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                      expense.active ? "bg-indigo-600" : "bg-slate-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                        expense.active ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => void removeExpense(expense)}
                    className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-rose-400"
                    title="Eliminar cuota"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <p className="text-center text-[11px] text-slate-600">
        Las cuotas fijas sirven para recordar suscripciones o pagos recurrentes. El responsable las marca como pagadas
        pausando o reactivando la cuota.
      </p>
    </div>
  );
}

function NewRecurringModal({
  open,
  onClose,
  groupId,
  currency,
  members,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  groupId: string;
  currency: string;
  members: MemberInfo[];
  onCreated: () => void;
}) {
  const active = members.filter((m) => m.status === "active");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [responsibleId, setResponsibleId] = useState("");
  const [autoCreate, setAutoCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setTitle("");
      setAmount("");
      setFrequency("monthly");
      setResponsibleId("");
      setAutoCreate(false);
      setError("");
    }
  }, [open]);

  async function submit() {
    setLoading(true);
    setError("");
    try {
      await api.post(`/groups/${groupId}/recurring`, {
        title,
        amount: parseFloat(amount),
        frequency,
        responsibleId,
        autoCreate,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  const amountNum = parseFloat(amount);
  const canSubmit = title.trim().length > 0 && Number.isFinite(amountNum) && amountNum > 0 && Boolean(responsibleId) && !loading;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="AÃ±adir cuota fija"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit} loading={loading}>
            AÃ±adir cuota
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          Define una suscripciÃ³n o pago que se repite cada mes o cada semana. El miembro responsable podrÃ¡ marcarla como
          pagada pausÃ¡ndola.
        </p>
        <Input label="TÃ­tulo" placeholder="Ej. Netflix, gimnasio, alquiler..." value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input
          label="Importe"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          rightElement={<span className="text-xs font-semibold text-slate-400">{currency}</span>}
        />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Periodicidad" value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}>
            <option value="monthly">Mensual</option>
            <option value="weekly">Semanal</option>
          </Select>
          <Select label="Responsable" value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)}>
            <option value="">Elegir...</option>
            {active.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
        <div
          className={`flex items-center justify-between rounded-xl border px-3 py-2.5 transition ${
            autoCreate ? "border-emerald-500/40 bg-emerald-500/10" : "border-slate-800"
          }`}
        >
          <div>
            <p className="text-sm font-medium text-slate-200">Autoregistrar gasto</p>
            <p className="text-[11px] text-slate-500">
              {autoCreate
                ? "Al vencer se crea el gasto automÃ¡ticamente"
                : "Solo recuerda: el gasto se registra manualmente"}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoCreate}
            onClick={() => setAutoCreate((v) => !v)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${
              autoCreate ? "bg-emerald-600" : "bg-slate-700"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                autoCreate ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>
        {error ? <p className="text-xs font-medium text-rose-400">{error}</p> : null}
      </div>
    </Modal>
  );
}

// ---------- AÃ±adir participante sin cuenta ----------

function AddGhostModal({
  open,
  onClose,
  groupId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  groupId: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setError("");
    }
  }, [open]);

  async function submit() {
    const clean = name.trim();
    if (!clean) {
      setError("Escribe el nombre de la persona");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.post(`/groups/${groupId}/ghost-members`, { name: clean });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al aÃ±adir el participante");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="AÃ±adir participante sin cuenta"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} loading={loading}>
            AÃ±adir
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          Se aÃ±adirÃ¡ al grupo como participante sin correo ni registro. PodrÃ¡ aparecer en gastos y saldos, y vincularse a
          una cuenta real mÃ¡s adelante.
        </p>
        <Input label="Nombre" placeholder="Ej. Laura (invitada)" value={name} onChange={(e) => setName(e.target.value)} />
        {error ? <p className="text-xs font-medium text-rose-400">{error}</p> : null}
      </div>
    </Modal>
  );
}

// ---------- Historial ----------

const AUDIT_ENTITY_LABELS: Record<string, string> = {
  expense: "gasto",
  payment: "pago",
  informal_debt: "pique",
  modification_request: "solicitud",
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  created: "creÃ³",
  updated: "editÃ³",
  deleted: "eliminÃ³",
  approved: "aprobÃ³",
  rejected: "rechazÃ³",
};

const AUDIT_FIELD_LABELS: Record<string, string> = {
  description: "concepto",
  amount: "importe",
  amountGroup: "importe",
  currency: "moneda",
  exchangeRate: "tipo de cambio",
  participants: "participantes",
  payerId: "pagador",
  status: "estado",
  note: "nota",
  title: "tÃ­tulo",
  category: "categorÃ­a",
  kind: "tipo",
  prize: "premio",
  winnerIds: "ganadores",
  loserIds: "perdedores",
  action: "acciÃ³n",
  payload: "datos",
};

function fmtAuditValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "â€”";
  if (Array.isArray(value)) return value.length === 1 ? "1 persona" : `${value.length} personas`;
  if (typeof value === "boolean") return value ? "sÃ­" : "no";
  if (typeof value === "number" && /amount|prize/i.test(key)) return value.toFixed(2);
  const s = String(value);
  return s.length > 28 ? `${s.slice(0, 28)}â€¦` : s;
}

/** Convierte { before, after } del audit log en un resumen legible en espaÃ±ol. */
function describeAuditDiff(diff: { before?: any; after?: any } | null): string {
  if (!diff) return "";
  if (!diff.before && diff.after) {
    // Alta: mostramos el concepto si lo tenemos.
    const desc = diff.after.description ?? diff.after.title;
    return desc ? ` "${fmtAuditValue("description", desc)}"` : "";
  }
  if (diff.before && diff.after) {
    const keys = Object.keys(diff.after)
      .filter((k) => JSON.stringify(diff.before?.[k]) !== JSON.stringify(diff.after?.[k]))
      .slice(0, 3);
    if (keys.length === 0) return "";
    const parts = keys.map(
      (k) => `${AUDIT_FIELD_LABELS[k] ?? k}: ${fmtAuditValue(k, diff.before?.[k])} â†’ ${fmtAuditValue(k, diff.after?.[k])}`
    );
    return ` (${parts.join(", ")})`;
  }
  return "";
}

function HistoryTab({
  events,
  audit,
  currency,
  groupName,
  memberName,
  myUserId,
  onChanged,
  onViewProof,
  onOpenExpense,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  events: HistoryEvent[];
  audit: any[];
  currency: string;
  groupName: string;
  memberName: (id: string) => string;
  myUserId: string;
  onChanged: () => void;
  onViewProof: (url: string) => void;
  onOpenExpense: (expenseId: string) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  const [deciding, setDeciding] = useState(false);

  async function confirmPayment(id: string, accepted: boolean) {
    setDeciding(true);
    try {
      await api.patch(`/payments/${id}/confirm`, { accepted });
      onChanged();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Error");
    } finally {
      setDeciding(false);
    }
  }

  function exportHistory() {
    const lines = [
      `Divido Â· Historial de actividad de ${groupName}`,
      `Exportado el ${new Date().toLocaleString("es-ES")}`,
      `Moneda del grupo: ${currency}`,
      "",
    ];
    for (const e of combined) {
      const entry = e as any;
      const when = new Date(entry.date ?? entry.created_at).toLocaleString("es-ES");
      if (e.type === "audit") {
        const entityLabel = AUDIT_ENTITY_LABELS[e.entityType] ?? e.entityType;
        const actionLabel = AUDIT_ACTION_LABELS[e.action] ?? e.action;
        lines.push(`[${when}] ${e.actorName} ${actionLabel} ${entityLabel}${describeAuditDiff(e.diff)}`);
      } else if (e.type === "member_joined") {
        lines.push(`[${when}] ${e.userName} se uniÃ³ al grupo`);
      } else if (e.type === "member_left") {
        lines.push(`[${when}] ${e.userName} abandonÃ³ el grupo`);
      } else if (e.type === "member_removed") {
        lines.push(`[${when}] ${e.userName} fue expulsado del grupo`);
      } else if (e.type === "payment") {
        lines.push(
          `[${when}] ${e.fromName} pagÃ³ a ${e.toName} ${e.amount?.toFixed(2)} ${currency}${e.note ? ` (${e.note})` : ""}`
        );
      } else if (e.type === "expense") {
        const parts = [`[${when}] ${e.payerName} pagÃ³ ${e.description}`];
        parts.push(`${(e.amountGroup ?? 0).toFixed(2)} ${e.currency ?? currency}`);
        if (e.deleted) parts.push("(eliminado)");
        if (e.edited) parts.push("(modificado)");
        lines.push(parts.join(" "));
      }
    }
    lines.push("", `Total de eventos: ${combined.length}`);
    downloadText(lines.join("\n"), `historial-${groupName.replace(/[^a-z0-9]+/gi, "-")}.txt`);
  }

  // Combina eventos del historial y auditorÃ­a en una sola lÃ­nea temporal
  const combined = useMemo(() => {
    const auditEvents = audit.map((a) => ({
      type: "audit" as const,
      id: a.id,
      date: a.created_at,
      created_at: a.created_at,
      entityType: a.entity_type,
      entityId: a.entity_id,
      action: a.action,
      actorName: a.actor_name,
      diff: a.diff ? JSON.parse(a.diff) : null,
    }));
    return [...events, ...auditEvents].sort((a, b) => b.date.localeCompare(a.date));
  }, [events, audit]);

  const totalItems = combined.length;

  // Type guards para TypeScript
  const isHistoryEvent = (e: any): e is HistoryEvent => e.type !== "audit";
  const isAuditEvent = (e: any): e is { type: "audit"; id: string; date: string; created_at: string; entityType: string; entityId: string; action: string; actorName: string; diff: any } => e.type === "audit";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        {totalItems > 0 ? (
          <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={exportHistory}>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Exportar historial
          </Button>
        ) : null}
      </div>
      <div className="space-y-1">
        {totalItems === 0 ? (
          <EmptyState
            title="No hay actividad registrada en este grupo"
            subtitle="AquÃ­ aparecerÃ¡n los gastos, pagos y cambios en orden cronolÃ³gico"
            icon={
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
            }
          />
        ) : (
        (combined as any[]).map((e, i) => {
          const isAudit = e.type === "audit";
          const isHistory = e.type !== "audit";
          const isMemberEvent = !isAudit && (e.type === "member_joined" || e.type === "member_left" || e.type === "member_removed");
          const isExpense = !isAudit && e.type === "expense";
          const isPayment = !isAudit && e.type === "payment";
          const iconColor = isAudit
            ? "bg-info-500/15 text-info-400"
            : isMemberEvent
            ? e.type === "member_joined"
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-rose-500/15 text-rose-400"
            : isPayment
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-indigo-500/15 text-indigo-400";
          return (
            <div
              key={`${e.type}-${e.id}-${i}`}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 ${
                isMemberEvent ? "bg-slate-900/30 opacity-80" : "hover:bg-slate-900 cursor-pointer"
              }`}
              onClick={() => {
                if (isExpense && !isAudit && e.id) onOpenExpense(e.id);
                if (isPayment && !isAudit && e.id && e.proofUrl) onViewProof(e.proofUrl!);
              }}
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconColor}`}>
                {isMemberEvent ? (
                  e.type === "member_joined" ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                    </svg>
                  ) : e.type === "member_left" ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766zM17 9l-5 5m0 0l5 5m-5-5h6" />
                    </svg>
                  )
                ) : isPayment ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.306a11.95 11.95 0 015.814-5.518l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-200">
                  {isAudit ? (
                    <>
                      <strong>{e.actorName}</strong> {AUDIT_ACTION_LABELS[e.action] ?? e.action}{" "}
                      {AUDIT_ENTITY_LABELS[e.entityType] ?? e.entityType}
                      {describeAuditDiff(e.diff)}
                    </>
                  ) : isMemberEvent ? (
                    <>
                      <strong>{e.userName}</strong>{" "}
                      {e.type === "member_joined"
                        ? "se uniÃ³ al grupo"
                        : e.type === "member_left"
                          ? "abandonÃ³ el grupo"
                          : "fue expulsado del grupo"}
                    </>
                  ) : isPayment ? (
                    <>
                      <strong>{e.fromName}</strong> pagÃ³ a <strong>{e.toName}</strong>
                      {e.note ? ` Â· ${e.note}` : ""}
                      {e.proofUrl ? (
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            onViewProof(e.proofUrl!);
                          }}
                          title="Ver comprobante"
                          className="ml-1.5 inline-flex items-center gap-0.5 rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300 transition hover:bg-slate-700"
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                          </svg>
                          comprobante
                        </button>
                      ) : null}
                      {e.paymentStatus === "pending_confirmation" ? (
                        <span className="ml-1.5 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-400">
                          Pendiente de confirmar
                        </span>
                      ) : null}
                      {e.paymentStatus === "rejected" ? (
                        <span className="ml-1.5 rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-400">
                          Rechazado
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <strong>{e.payerName}</strong> pagÃ³ {e.description}
                      {e.deleted ? <span className="ml-1.5 text-[10px] text-rose-400">(eliminado)</span> : null}
                      {e.edited ? <span className="ml-1.5 text-[10px] text-amber-400">(modificado)</span> : null}
                    </>
                  )}
                </p>
                <p className="text-[11px] text-slate-500">{fmtDate(e.date ?? e.created_at)}</p>
              </div>
              {(isPayment || isExpense) && !isAudit ? (
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className={`shrink-0 text-sm font-bold ${isPayment ? "text-emerald-400" : "text-slate-100"}`}>
                    <Money amount={isPayment ? (e.amount ?? 0) : (e.amountGroup ?? 0)} currency={isPayment ? currency : (e.currency ?? currency)} />
                  </span>
                  {isPayment && e.paymentStatus === "pending_confirmation" && e.toUserId === myUserId ? (
                    <div className="flex items-center gap-1.5">
                      <ConfirmPaymentButton
                        onConfirm={() => void confirmPayment(e.id, true)}
                        loading={deciding}
                        disabled={deciding}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-400"
                        disabled={deciding}
                        onClick={() => void confirmPayment(e.id, false)}
                      >
                        Rechazar
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })
      )}
        {hasMore ? (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="mt-4 w-full rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 py-3 text-sm font-semibold text-indigo-300 transition hover:border-indigo-500 hover:text-indigo-200 disabled:opacity-60"
          >
            {loadingMore ? "Cargandoâ€¦" : "Cargar mÃ¡s actividad"}
          </button>
        ) : null}
        </div>
      </div>
  );
}

// ---------- Ajustes ----------

function MemberDetailModal({
  data,
  onClose,
  currency,
}: {
  data: { member: MemberInfo; data: BreakdownItem[] } | null;
  onClose: () => void;
  currency: string;
}) {
  if (!data) return null;
  const { member, data: breakdown } = data;
  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="inline-flex items-center gap-2">
          {member.name} {member.emailVerified ? <VerifiedBadge /> : null} {member.isGhost ? <GhostBadge /> : null}
        </span>
      }
    >
      <div className="space-y-3">
        {breakdown.length === 0 ? (
          <p className="text-sm text-slate-500">Sin transacciones compartidas.</p>
        ) : (
          breakdown.map((item) => (
            <div key={item.userId} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-200">{item.name}</p>
                <p className={`text-sm font-bold ${item.net > 0.004 ? "text-emerald-400" : item.net < -0.004 ? "text-rose-400" : "text-slate-500"}`}>
                  <Money amount={item.net} currency={currency} />
                </p>
              </div>
              <div className="mt-2 space-y-1.5">
                {item.expenses.map((ex) => (
                  <div key={ex.id} className="flex items-center justify-between text-xs">
                    <span className="truncate text-slate-400">
                      {ex.paidByMe ? "Pagaste tÃº Â· " : "PagÃ³ Ã©l/ella Â· "}
                      {ex.description}
                    </span>
                    <span className="ml-2 shrink-0 text-slate-300">{ex.share.toFixed(2)} {currency}</span>
                  </div>
                ))}
                {item.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <span className="text-emerald-400/80">
                      {p.receivedByMe ? "Pago recibido" : "Pago realizado"}
                    </span>
                    <span className="shrink-0 text-emerald-400">{p.amount.toFixed(2)} {currency}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}

