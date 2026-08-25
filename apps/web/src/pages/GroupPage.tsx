import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { track } from "../lib/analytics";
import { blobToDataUrl, compressImageToJpeg, dataUrlToBlob, isHeavyDataUrl } from "../lib/compressImage";
import { Avatar, Button, GhostBadge, Modal, Money, Spinner, Tabs, Toast, VerifiedBadge } from "../components/ui";
import { ExpenseModal } from "../components/ExpenseModal";
import { PaymentModal } from "../components/PaymentModal";
import { BalancesTab } from "./group/BalancesTab";
import { HistoryTab } from "./group/HistoryTab";
import { MembersTab } from "./group/MembersTab";
import { ExpensesTab } from "./group/ExpensesTab";
import { RecurringTab, NewRecurringModal } from "./group/RecurringTab";
import { PotTab, NewContributionModal } from "./group/PotTab";
import { SettingsModal } from "./group/SettingsModal";
import { DebtsTab, NewDebtModal } from "./group/DebtsTab";
import { useExpenseFilters } from "./group/hooks/useExpenseFilters";
import { useGroupChannel } from "../hooks/useRealtime";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useTourOptionsSetter } from "../components/GuidedTourPortal";
import type {
  BreakdownItem,
  ExpenseDto,
  GroupDetail,
  HistoryEvent,
  InformalDebtDto,
  MemberInfo,
  ModificationRequestDto,
  PotContributionDto,
  RecurringExpenseDto,
} from "../lib/types";

type Tab = "expenses" | "balances" | "members" | "history" | "debts" | "pot" | "recurring";


const GROUP_EXTRAS: Array<{ key: string; label: string; description: string }> = [
  {
    key: "informal_debts",
    label: "Piques y Apuestas",
    description: "Deudas informales entre miembros (apuestas, favores...), aparte del balance de gastos.",
  },
  {
    key: "common_pot",
    label: "Bote Común",
    description: "Fondo común al que los miembros aportan dinero para gastos compartidos.",
  },
  {
    key: "recurring_expenses",
    label: "Gastos Fijos",
    description: "Suscripciones o cuotas recurrentes (mensuales o semanales) con un miembro responsable.",
  },
];

// Caché de sesión por grupo: permite navegar entre pestañas (y volver a un grupo)
// de forma instantánea sin pantallas de carga, refrescando en segundo plano.
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
// Caché de grupos visitados con tope (LRU por inserción): retener todos los
// grupos completos de una sesión larga terminaba pesando decenas de MB en RAM.
const GROUP_CACHE_LIMIT = 8;
const groupCache = new Map<string, GroupCacheData>();
function cacheGroup(groupId: string, data: GroupCacheData): void {
  groupCache.delete(groupId);
  groupCache.set(groupId, data);
  while (groupCache.size > GROUP_CACHE_LIMIT) {
    const oldest = groupCache.keys().next().value;
    if (oldest === undefined) break;
    groupCache.delete(oldest);
  }
}

// Logos legacy guardados como data-URL sin comprimir: al cargar un grupo con
// uno de ellos lo recomprimimos una vez y persistimos la versión ligera, de
// modo que la guarda anti-OOM del renderizado deja de ocultarlo. Clave por
// longitud para reintentar solo si el valor cambia.
const migratedGroupLogos = new Set<string>();

async function migrateHeavyGroupLogo(groupId: string, logoUrl: string): Promise<string | null> {
  const key = `${groupId}:${logoUrl.length}`;
  if (migratedGroupLogos.has(key)) return null;
  migratedGroupLogos.add(key);
  try {
    const blob = await compressImageToJpeg(await dataUrlToBlob(logoUrl), 512, 0.85, 100_000);
    const optimized = await blobToDataUrl(blob);
    await api.patch(`/groups/${groupId}`, { logoUrl: optimized });
    return optimized;
  } catch {
    // Silencioso: si falla, la guarda de renderizado sigue protegiendo y
    // se reintentará en otra visita.
    migratedGroupLogos.delete(key);
    return null;
  }
}

export default function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, setFilter, clearFilters, hasActiveFilters, debouncedQ } = useExpenseFilters();
  const setTourOptions = useTourOptionsSetter();

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
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [adminConfirm, setAdminConfirm] = useState<{ type: "edit" | "delete"; expense: ExpenseDto } | null>(null);
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

  useEffect(() => {
    setTourOptions({
      hasGroups: true,
      isPWA: false,
      inGroup: true,
    });
  }, [setTourOptions]);

  useKeyboardShortcuts([
    { key: "n", handler: () => openAddExpense(), description: "Nuevo gasto" },
    { key: "/", handler: () => setFilter("q", ""), description: "Buscar gastos" },
    { key: "Escape", handler: () => {
      setShowAddExpense(false);
      setShowPayment(false);
      setShowNewDebt(false);
      setShowNewContribution(false);
      setShowNewRecurring(false);
      setEditTarget(null);
      setDeleteTarget(null);
    }, description: "Cerrar modales" },
  ], !detail);

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
      // Solo mostramos la pantalla de carga si no hay nada que pintar todavía.
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
        // Paginación: la primera carga trae una página; los refrescos silenciosos
        // mantienen el tamaño ya cargado para no perder filas en pantalla.
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
        cacheGroup(groupId, data);
        applyData(data);
        setError("");
        // Sanear en segundo plano un logo pesado heredado (no bloquea la carga).
        const heavyLogo = d.group.logoUrl;
        if (heavyLogo && isHeavyDataUrl(heavyLogo)) {
          void migrateHeavyGroupLogo(groupId, heavyLogo).then((optimized) => {
            if (!optimized) return;
            setDetail((prev) =>
              prev && prev.group.id === groupId
                ? { ...prev, group: { ...prev.group, logoUrl: optimized } }
                : prev,
            );
            const cachedNow = groupCache.get(groupId);
            if (cachedNow?.detail.group.id === groupId) {
              cacheGroup(groupId, {
                ...cachedNow,
                detail: { ...cachedNow.detail, group: { ...cachedNow.detail.group, logoUrl: optimized } },
              });
            }
            showToast("Logo del grupo optimizado automáticamente");
          });
        }
      } catch (err) {
        if (!cached) setError(err instanceof ApiError ? err.message : "Error cargando el grupo");
      } finally {
        setLoading(false);
      }
    },
    [groupId, applyData]
  );

  // Realtime: ante cualquier evento del grupo, recarga silenciosa (debounce
  // de 800 ms para agrupar ráfagas de eventos en un solo refresco).
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useGroupChannel(groupId, () => {
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = setTimeout(() => void load({ silent: true }), 800);
  });

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
        showToast("No se pudieron cargar más gastos");
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
        showToast("No se pudo cargar más actividad");
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
      // Render inmediato desde caché y refresco silencioso en segundo plano.
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
      window.prompt("Copia este enlace de invitación:", g.inviteUrl);
    }
    track("invitacion_copiada", { groupId });
    showToast("Enlace de invitación copiado");
  }

  async function leaveGroup() {
    if (!confirm("¿Abandonar este grupo? Tu balance quedará congelado y visible para los demás.")) return;
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
    setDeletingExpenseId(expense.id);
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
    } finally {
      setDeletingExpenseId(null);
    }
  }

  // Admin confirmation handlers
  function confirmAdminEdit(expense: ExpenseDto) {
    setAdminConfirm({ type: "edit", expense });
  }

  function confirmAdminDelete(expense: ExpenseDto) {
    setAdminConfirm({ type: "delete", expense });
  }

  async function handleAdminConfirm() {
    if (!adminConfirm) return;
    const { type, expense } = adminConfirm;
    try {
      if (type === "edit") {
        // Open ExpenseModal with adminOverride to allow direct editing
        setAdminConfirm(null);
        setEditTarget(expense);
      } else if (type === "delete") {
        await api.delete(`/expenses/${expense.id}`);
        showToast("Gasto eliminado");
        setAdminConfirm(null);
        await load();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error");
    }
  }

  function cancelAdminConfirm() {
    setAdminConfirm(null);
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
              {group.type === "closed" ? "Cerrado" : "Abierto"} · {group.currency}
              {detail.members.length > 0 ? ` · ${detail.members.length} miembros` : ""}
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
            <Money amount={myBalance} currency={group.currency} />
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {positive ? (
              <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-400">
                Te deben <Money amount={myBalance} currency={group.currency} />
              </span>
            ) : null}
            {negative ? (
              <span className="rounded-lg bg-rose-500/10 px-2.5 py-1 font-semibold text-rose-400">
                Debes <Money amount={myBalance} currency={group.currency} />
              </span>
            ) : null}
            {!positive && !negative ? (
              <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-400">
                Al día
              </span>
            ) : null}
          </div>
        </div>

        <Tabs
          tabs={[
            { key: "expenses", label: "Gastos" },
            { key: "balances", label: "Saldos", tourId: "balances-tab" },
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
              onEdit={(e) => isAdmin && !e.editable ? confirmAdminEdit(e) : setEditTarget(e)}
              onDelete={(e) => isAdmin && !e.editable ? confirmAdminDelete(e) : setDeleteTarget(e)}
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
              members={detail.members}
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
              onAdd={openAddExpense}
              members={detail.members}
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
          data-tour="add-expense"
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
          adminOverride={isAdmin && !editTarget.editable}
        />
      ) : null}

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={deleteTarget?.editable ? "Eliminar gasto" : "Solicitar eliminación"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => deleteTarget && requestDelete(deleteTarget)} loading={deletingExpenseId === deleteTarget?.id}>
              {deletingExpenseId === deleteTarget?.id ? "Eliminando…" : (deleteTarget?.editable ? "Eliminar" : "Enviar solicitud")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          {deleteTarget?.editable
            ? `¿Eliminar "${deleteTarget.description}"?`
            : `"${deleteTarget?.description}" supera las 24 horas. Envía la solicitud y un administrador la revisará.`}
        </p>
      </Modal>

      {adminConfirm && (
        <Modal
          open
          onClose={cancelAdminConfirm}
          title={adminConfirm.type === "edit" ? "Editar gasto (admin)" : "Eliminar gasto (admin)"}
          footer={
            <>
              <Button variant="ghost" onClick={cancelAdminConfirm}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleAdminConfirm} loading={deletingExpenseId === adminConfirm.expense.id}>
                {deletingExpenseId === adminConfirm.expense.id ? "Procesando…" : (adminConfirm.type === "edit" ? "Confirmar edición" : "Confirmar eliminación")}
              </Button>
            </>
          }
        >
          <p className="text-sm text-slate-300">
            {adminConfirm.type === "edit"
              ? `¿Confirmas editar "${adminConfirm.expense.description}"? Como administrador, la edición se aplicará directamente sin solicitud.`
              : `¿Confirmas eliminar "${adminConfirm.expense.description}"? Como administrador, se eliminará directamente.`}
          </p>
        </Modal>
      )}

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
                      {ex.paidByMe ? "Pagaste tú · " : "Pagó él/ella · "}
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

