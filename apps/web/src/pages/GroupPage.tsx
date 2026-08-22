import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Avatar, Button, ConfirmPaymentButton, CopyLinkButton, EmptyState, GhostBadge, Input, Modal, Money, Select, Spinner, Tabs, Toast, VerifiedBadge, currencySymbol } from "../components/ui";
import { ExpenseModal } from "../components/ExpenseModal";
import { PaymentModal } from "../components/PaymentModal";
import { BalancesTab } from "./group/BalancesTab";
import { MembersTab } from "./group/MembersTab";
import { ExpensesTab } from "./group/ExpensesTab";
import { RecurringTab, NewRecurringModal } from "./group/RecurringTab";
import { PotTab, NewContributionModal } from "./group/PotTab";
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

