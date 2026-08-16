import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Avatar, Button, EmptyState, GhostBadge, Input, Modal, Money, Select, Spinner, Tabs, Toast, VerifiedBadge, currencySymbol } from "../components/ui";
import { ExpenseModal } from "../components/ExpenseModal";
import { PaymentModal } from "../components/PaymentModal";
import { simplifyDebts, type SimplifyResult } from "../lib/debtSimplifier";
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
import type { InformalDebtStatus, SettlementTransfer } from "@divido/shared";

type Tab = "expenses" | "balances" | "members" | "history" | "debts" | "pot" | "recurring";

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ");
}

function similarNames(a: string, b: string): boolean {
  const na = normalizeName(a).trim();
  const nb = normalizeName(b).trim();
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = na.split(" ").filter((t) => t.length > 2);
  const tb = nb.split(" ").filter((t) => t.length > 2);
  return ta.some((t) => tb.includes(t));
}

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
  recurringExpenses: RecurringExpenseDto[];
}
const groupCache = new Map<string, GroupCacheData>();

export default function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [expenses, setExpenses] = useState<ExpenseDto[]>([]);
  const [requests, setRequests] = useState<ModificationRequestDto[]>([]);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [debts, setDebts] = useState<InformalDebtDto[]>([]);
  const [potBalance, setPotBalance] = useState(0);
  const [potContributions, setPotContributions] = useState<PotContributionDto[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpenseDto[]>([]);
  const [searchParams] = useSearchParams();
  const initialTab = (["expenses", "balances", "members", "history", "debts", "pot", "recurring"] as Tab[]).find(
    (t) => t === searchParams.get("tab")
  );
  const [tab, setTab] = useState<Tab>(initialTab ?? "expenses");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    setRecurringExpenses(data.recurringExpenses);
  }, []);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!groupId) return;
      const cached = groupCache.get(groupId);
      // Solo mostramos la pantalla de carga si no hay nada que pintar todavía.
      if (!cached && !opts?.silent) setLoading(true);
      try {
        const [d, e, h, r, dd, pot, rec] = await Promise.all([
          api.get<GroupDetail>(`/groups/${groupId}`),
          api.get<{ expenses: ExpenseDto[] }>(`/groups/${groupId}/expenses`),
          api.get<{ events: HistoryEvent[] }>(`/groups/${groupId}/history`),
          api.get<{ requests: ModificationRequestDto[] }>(`/groups/${groupId}/requests`).catch(() => null),
          api.get<{ debts: InformalDebtDto[] }>(`/groups/${groupId}/informal-debts`).catch(() => null),
          api
            .get<{ balance: number; contributions: PotContributionDto[] }>(`/groups/${groupId}/common-pot`)
            .catch(() => null),
          api.get<{ expenses: RecurringExpenseDto[] }>(`/groups/${groupId}/recurring-expenses`).catch(() => null),
        ]);
        const data: GroupCacheData = {
          detail: d,
          expenses: e.expenses,
          history: h.events,
          requests: r?.requests ?? [],
          debts: dd?.debts ?? [],
          potBalance: pot?.balance ?? 0,
          potContributions: pot?.contributions ?? [],
          recurringExpenses: rec?.expenses ?? [],
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
                Al día
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
            />
          ) : null}
          {tab === "balances" ? (
            <BalancesTab detail={detail} myUserId={user.id} onOpenMember={openBreakdown} onToast={showToast} />
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
              currency={group.currency}
              groupName={group.name}
              memberName={memberName}
              myUserId={user.id}
              onChanged={load}
              onViewProof={(url) => setViewProof(url)}
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
              myUserId={user.id}
              isAdmin={isAdmin}
              currency={group.currency}
              onChanged={load}
              onNew={() => setShowNewContribution(true)}
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
        title={deleteTarget?.editable ? "Eliminar gasto" : "Solicitar eliminación"}
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
            ? `¿Eliminar "${deleteTarget.description}"?`
            : `"${deleteTarget?.description}" supera las 24 horas. Envía la solicitud y un administrador la revisará.`}
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
}) {
  const pending = requests.filter((r) => r.status === "pending");
  const [viewReceipt, setViewReceipt] = useState<string | null>(null);

  return (
    <div className="space-y-4">
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
                    <strong>{r.requesterName}</strong> · {r.action === "edit" ? "editar" : "eliminar"}{" "}
                    "{r.expenseDescription}"
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button variant="secondary" className="!px-2.5 !py-1 text-xs" onClick={() => onDecide(r.id, "approve")}>
                    Aprobar
                  </Button>
                  <Button variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => onDecide(r.id, "reject")}>
                    Rechazar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {expenses.length === 0 ? (
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
          {expenses.map((e) => (
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
                  {e.payerName} pagó · {e.participantsCount} participante{e.participantsCount !== 1 ? "s" : ""}
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
                </div>
              </div>
              <ExpenseComments expense={e} groupId={groupId} myUserId={myUserId} />
            </div>
          ))}
        </div>
      )}

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

// ---------- Saldos ----------

function buildSummaryText(groupName: string, currency: string, transfers: SettlementTransfer[]): string {
  const sym = currencySymbol(currency);
  const lines =
    transfers.length > 0
      ? transfers.map((t) => `• ${t.fromName} debe ${sym}${t.amount.toFixed(2)} a ${t.toName}`)
      : ["• Sin deudas pendientes 🎉"];
  return `📊 Resumen de ${groupName}\n${lines.join("\n")}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt("Copia este texto:", text);
    return false;
  }
}

function BalancesTab({
  detail,
  myUserId,
  onOpenMember,
  onToast,
}: {
  detail: GroupDetail;
  myUserId: string;
  onOpenMember: (m: MemberInfo) => void;
  onToast: (msg: string) => void;
}) {
  const { group, balances, rawTransfers, exMembers } = detail;
  const memberById = new Map(detail.members.map((m) => [m.userId, m]));

  const [simplifyEnabled, setSimplifyEnabled] = useState(group.simplifyDebts);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const isAdmin = detail.myRole === "admin";

  const simplified = useMemo(
    () => simplifyDebts(rawTransfers, balances.map((b) => ({ userId: b.userId, name: b.name, net: b.net }))),
    [rawTransfers, balances]
  );
  const hasSavings = simplified.originalCount > 0 && simplified.transfers.length < simplified.originalCount;
  const effectiveTransfers = simplifyEnabled ? simplified.transfers : rawTransfers;

  // Garantía: si un usuario tiene saldo neto negativo pero la simplificación no
  // le asignó transferencia (redondeo o descompensación residual), se le genera
  // una tarjeta de pago contra el mayor acreedor para que la deuda siempre se
  // muestre y el listado inferior nunca aparezca vacío.
  const coveredDebtors = new Set(effectiveTransfers.map((t) => t.fromUserId));
  const topCreditor = [...balances].sort((a, b) => b.net - a.net).find((b) => b.net > 0.004);
  const fallbackTransfers: SettlementTransfer[] = topCreditor
    ? balances
        .filter((b) => b.net < -0.004 && !coveredDebtors.has(b.userId))
        .map((b) => ({
          fromUserId: b.userId,
          fromName: b.name,
          toUserId: topCreditor.userId,
          toName: topCreditor.name,
          amount: -b.net,
        }))
    : [];
  const displayTransfers = effectiveTransfers.length > 0 ? [...effectiveTransfers, ...fallbackTransfers] : fallbackTransfers;

  async function toggleSimplify() {
    const next = !simplifyEnabled;
    setSimplifyEnabled(next);
    if (isAdmin) {
      try {
        await api.patch(`/groups/${group.id}`, { simplifyDebts: next });
        onToast(next ? "Simplificación de pagos activada" : "Simplificación de pagos desactivada");
      } catch (err) {
        setSimplifyEnabled(!next);
        onToast(err instanceof ApiError ? err.message : "Error al guardar");
      }
    } else {
      onToast("Vista local solo para ti: un administrador puede guardar esta preferencia para el grupo");
    }
  }

  async function shareSummary() {
    const text = buildSummaryText(group.name, group.currency, displayTransfers);
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // Usuario canceló: copiamos como alternativa.
      }
    }
    if (await copyText(text)) onToast("Resumen copiado. Pégalo en WhatsApp");
  }

  async function copyBizum(name: string, phone: string) {
    if (await copyText(phone)) onToast(`Número de Bizum de ${name} copiado`);
  }

  function openPayLink(kind: "revolut" | "paypal", username: string) {
    window.open(`https://${kind}.me/${encodeURIComponent(username)}`, "_blank", "noopener");
  }

  return (
    <div className="space-y-5">
      <button
        onClick={() => void shareSummary()}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-emerald-500/40 bg-emerald-500/5 px-4 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/10"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
        </svg>
        Compartir resumen
      </button>

      {hasSavings ? (
        <div
          className={`rounded-2xl border p-4 ${
            simplifyEnabled ? "border-emerald-500/40 bg-emerald-500/10" : "border-indigo-500/40 bg-indigo-500/10"
          }`}
        >
          <div className="flex items-center gap-3">
            <svg className={`h-5 w-5 shrink-0 ${simplifyEnabled ? "text-emerald-400" : "text-indigo-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-100">
                {simplifyEnabled
                  ? `Simplificación activada: ${simplified.transfers.length} pago${simplified.transfers.length !== 1 ? "s" : ""} en lugar de ${simplified.originalCount}`
                  : `Simplifica tus pagos: ${simplified.originalCount} → ${simplified.transfers.length}`}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
                {simplifyEnabled
                  ? "Las deudas en cadena se consolidan (si A debe a B y B a C, se propone A → C)."
                  : "Consolida las deudas en cadena para reducir el número de pagos. Requiere un administrador."}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
              {simplifyEnabled ? (
                <>
                  <button
                    onClick={() => setShowBreakdown(true)}
                    className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-emerald-950 transition hover:bg-emerald-400"
                  >
                    Ver desglose
                  </button>
                  <button
                    onClick={() => void toggleSimplify()}
                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
                  >
                    Desactivar
                  </button>
                </>
              ) : (
                <button
                  onClick={() => void toggleSimplify()}
                  disabled={!isAdmin}
                  className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Activar
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <SimplifyBreakdownModal
        open={showBreakdown}
        onClose={() => setShowBreakdown(false)}
        result={simplified}
        currency={group.currency}
      />

      <div className="space-y-2">
        {balances.map((b) => {
          const member = memberById.get(b.userId);
          const methods: Array<{ kind: string; label: string; onClick: () => void }> = [];
          if (b.net > 0.004 && member && !b.isMe) {
            if (member.phone) {
              methods.push({ kind: "bizum", label: "Bizum", onClick: () => void copyBizum(member!.name, member!.phone!) });
            }
            if (member.revolut) {
              methods.push({
                kind: "revolut",
                label: "Revolut",
                onClick: () => openPayLink("revolut", member!.revolut!),
              });
            }
            if (member.paypal) {
              methods.push({
                kind: "paypal",
                label: "PayPal",
                onClick: () => openPayLink("paypal", member!.paypal!),
              });
            }
          }
          return (
            <div
              key={b.userId}
              className={`rounded-2xl border bg-slate-900 ${b.isMe ? "border-indigo-500/50" : "border-slate-800"}`}
            >
              <button
                onClick={() =>
                  onOpenMember({
                    userId: b.userId,
                    name: b.name,
                    email: member?.email ?? null,
                    avatarUrl: member?.avatarUrl ?? null,
                    emailVerified: b.emailVerified ?? false,
                    isGhost: b.isGhost ?? false,
                    phone: member?.phone ?? null,
                    revolut: member?.revolut ?? null,
                    paypal: member?.paypal ?? null,
                    role: "member",
                    status: "active",
                    joinedAt: "",
                    leftAt: null,
                    frozenBalance: null,
                  })
                }
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-800/50"
              >
                <Avatar name={b.name} size="sm" />
                <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium text-slate-200">
                  <span className="truncate">{b.name}</span>
                  {b.emailVerified ? <VerifiedBadge /> : null}
                  {b.isGhost ? <GhostBadge showLabel={false} /> : null}
                  {b.isMe ? <span className="shrink-0 text-[10px] text-indigo-400">tú</span> : null}
                </span>
                <span className={`text-sm font-bold ${b.net > 0.004 ? "text-emerald-400" : b.net < -0.004 ? "text-rose-400" : "text-slate-500"}`}>
                  <Money amount={b.net} currency={group.currency} />
                </span>
              </button>
              {methods.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-800/70 px-4 py-2.5">
                  <span className="text-[11px] text-slate-500">Pagar a {b.name}:</span>
                  {methods.map((m) => (
                    <button
                      key={m.kind}
                      onClick={m.onClick}
                      className="rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition hover:bg-slate-700"
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {displayTransfers.length > 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <p className="mb-3 text-sm font-bold text-slate-100">
            {simplifyEnabled ? "Pagos sugeridos (liquidación optimizada)" : "Pagos sugeridos"}
          </p>
          <p className="mb-3 text-[11px] text-slate-500">
            {simplifyEnabled
              ? `${displayTransfers.length} transferencia${displayTransfers.length !== 1 ? "s" : ""} para liquidar todo el grupo. Las deudas en cadena se consolidan (si A debe a B y B a C, se propone A → C).`
              : `${displayTransfers.length} deuda${displayTransfers.length !== 1 ? "s" : ""} directa${displayTransfers.length !== 1 ? "s" : ""} entre miembros. Activa la simplificación para consolidarlas en menos pagos.`}
          </p>
          <div className="space-y-2">
            {displayTransfers.map((t, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl bg-slate-800/60 px-3 py-2.5 text-sm">
                <span className="font-medium text-slate-200">{t.fromName}</span>
                <svg className="h-4 w-4 shrink-0 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
                <span className="font-medium text-slate-200">{t.toName}</span>
                <span className="ml-auto font-bold text-emerald-400">
                  <Money amount={t.amount} currency={group.currency} />
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          title="¡Cuentas al día!"
          subtitle="Nadie debe dinero a nadie en este momento."
          icon={
            <svg className="h-10 w-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      )}

      {exMembers.length > 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-4">
          <p className="mb-2 text-sm font-bold text-slate-400">Exmiembros</p>
          {exMembers.map((m) => (
            <div key={m.userId} className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-slate-300">{m.name}</span>
              <span className={`font-semibold ${(m.frozenBalance ?? 0) > 0.004 ? "text-emerald-400" : (m.frozenBalance ?? 0) < -0.004 ? "text-rose-400" : "text-slate-500"}`}>
                <Money amount={m.frozenBalance ?? 0} currency={group.currency} />
              </span>
            </div>
          ))}
          <p className="mt-2 text-[11px] text-slate-600">Balance congelado al abandonar el grupo. Se recupera si vuelven a unirse.</p>
        </div>
      ) : null}
    </div>
  );
}

// ---------- Desglose de simplificación ----------

function SimplifyBreakdownModal({
  open,
  onClose,
  result,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  result: SimplifyResult;
  currency: string;
}) {
  if (!open) return null;
  const unchanged = result.debts.filter((d) => d.newAmount >= d.originalAmount - 0.005);
  const reduced = result.debts.filter((d) => d.newAmount < d.originalAmount - 0.005 && d.newAmount > 0.005);
  const canceled = result.debts.filter((d) => d.newAmount <= 0.005);

  return (
    <Modal open={open} onClose={onClose} title="Desglose de la simplificación">
      <p className="mb-4 rounded-xl bg-slate-800/60 px-3 py-2.5 text-sm text-slate-300">
        <span className="font-bold text-slate-100">{result.originalCount}</span> deuda{result.originalCount !== 1 ? "s" : ""} →
        <span className="font-bold text-emerald-400"> {result.transfers.length}</span> pago{result.transfers.length !== 1 ? "s" : ""}{" "}
        para liquidar el grupo.
      </p>

      {canceled.length > 0 ? (
        <div className="mb-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-rose-400">Se cancelan ({canceled.length})</p>
          <div className="space-y-1.5">
            {canceled.map((d, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-xl bg-slate-800/60 px-3 py-2 text-sm">
                <span className="truncate text-slate-300">
                  {d.fromName} → {d.toName}
                </span>
                <span className="shrink-0 text-rose-400 line-through">
                  <Money amount={d.originalAmount} currency={currency} />
                  <span className="mx-1 text-slate-500">→</span>
                  <Money amount={0} currency={currency} />
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {reduced.length > 0 ? (
        <div className="mb-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-400">Se reducen ({reduced.length})</p>
          <div className="space-y-1.5">
            {reduced.map((d, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-xl bg-slate-800/60 px-3 py-2 text-sm">
                <span className="truncate text-slate-300">
                  {d.fromName} → {d.toName}
                </span>
                <span className="shrink-0 text-amber-300">
                  <Money amount={d.originalAmount} currency={currency} />
                  <span className="mx-1 text-slate-500">→</span>
                  <Money amount={d.newAmount} currency={currency} />
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {unchanged.length > 0 ? (
        <div className="mb-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Se mantienen ({unchanged.length})</p>
          <div className="space-y-1.5">
            {unchanged.map((d, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-xl bg-slate-800/60 px-3 py-2 text-sm">
                <span className="truncate text-slate-300">
                  {d.fromName} → {d.toName}
                </span>
                <span className="shrink-0 text-slate-400">
                  <Money amount={d.originalAmount} currency={currency} />
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {result.transfers.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-400">Transferencias resultantes</p>
          <div className="space-y-1.5">
            {result.transfers.map((t, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm">
                <span className="font-medium text-slate-200">{t.fromName}</span>
                <svg className="h-4 w-4 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
                <span className="font-medium text-slate-200">{t.toName}</span>
                <span className="ml-auto font-bold text-emerald-400">
                  <Money amount={t.amount} currency={currency} />
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Modal>
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
      await copyText(res.claimUrl);
      onToast("Enlace de reclamación copiado. Compártelo con esa persona");
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
    if (!confirm(`¿Expulsar a ${name} del grupo?`)) return;
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
            ¿Eres {matchingGhosts[0].name}?
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Hay un participante sin cuenta con un nombre parecido al tuyo. Reclámalo para conservar su historial en el grupo.
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
          <button
            onClick={onCopyInvite}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-indigo-500/50 bg-indigo-500/5 px-4 py-3 text-sm font-semibold text-indigo-300 transition hover:bg-indigo-500/10"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
            Copiar enlace de invitación
          </button>
          <button
            onClick={() => setGhostOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-600 bg-slate-800/40 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            Añadir participante sin correo
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
              <Avatar name={m.name} url={m.avatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-medium text-slate-200">
                  <span className="truncate">{m.name}</span>
                  {isMe ? <span className="shrink-0 text-[10px] text-indigo-400">tú</span> : null}
                  {m.emailVerified ? <VerifiedBadge size="xs" /> : null}
                  {m.isGhost ? <GhostBadge /> : null}
                </p>
                <p className="text-[11px] text-slate-500">
                  {m.userId === group.creatorId ? "Creador" : m.role === "admin" ? "Administrador" : "Miembro"}
                </p>
              </div>
              {isAdmin && !isMe && m.userId !== group.creatorId ? (
                <div className="flex shrink-0 gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {m.isGhost ? (
                    <Button variant="ghost" className="!px-2 !py-1 text-[11px]" onClick={() => sendClaimLink(m)}>
                      Enviar enlace
                    </Button>
                  ) : null}
                  {m.role === "admin" ? (
                    <Button variant="ghost" className="!px-2 !py-1 text-[11px]" onClick={() => setRole(m.userId, "member")}>
                      Quitar admin
                    </Button>
                  ) : (
                    <Button variant="ghost" className="!px-2 !py-1 text-[11px]" onClick={() => setRole(m.userId, "admin")}>
                      Hacer admin
                    </Button>
                  )}
                  <Button variant="ghost" className="!px-2 !py-1 text-[11px] text-rose-400" onClick={() => removeMember(m.userId, m.name)}>
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

// ---------- Piques y apuestas ----------

const DEBT_STATUS_LABELS: Record<InformalDebtStatus, string> = {
  pending: "Pendiente",
  accepted: "Aceptado",
  settled: "Pagado",
  rejected: "Rechazado",
};

const DEBT_STATUS_BADGE: Record<InformalDebtStatus, string> = {
  pending: "bg-amber-500/10 text-amber-300",
  accepted: "bg-indigo-500/10 text-indigo-300",
  settled: "bg-emerald-500/10 text-emerald-300",
  rejected: "bg-rose-500/10 text-rose-300",
};

const DEBT_STATUS_BORDER: Record<InformalDebtStatus, string> = {
  pending: "border-amber-500/30 bg-amber-500/5",
  accepted: "border-indigo-500/30 bg-indigo-500/5",
  settled: "border-emerald-500/30 bg-emerald-500/5",
  rejected: "border-rose-500/20 bg-slate-900/40",
};

const DEBT_STATUS_ORDER: Record<InformalDebtStatus, number> = {
  pending: 0,
  accepted: 1,
  settled: 2,
  rejected: 3,
};

function DebtsTab({
  debts,
  members,
  myUserId,
  currency,
  onChanged,
  onNew,
}: {
  debts: InformalDebtDto[];
  members: MemberInfo[];
  myUserId: string;
  currency: string;
  onChanged: () => void;
  onNew: () => void;
}) {
  async function setStatus(debt: InformalDebtDto, status: InformalDebtStatus) {
    try {
      await api.patch(`/groups/${debt.groupId}/informal-debts/${debt.id}/status`, { status });
      onChanged();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Error");
    }
  }

  const sorted = [...debts].sort(
    (a, b) => DEBT_STATUS_ORDER[a.status] - DEBT_STATUS_ORDER[b.status] || a.createdAt.localeCompare(b.createdAt)
  );

  return (
    <div className="space-y-4">
      {sorted.length > 0 ? (
        <button
          onClick={onNew}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-indigo-500/50 bg-indigo-500/5 px-4 py-3 text-sm font-semibold text-indigo-300 transition hover:bg-indigo-500/10"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Lanzar un pique o apuesta
        </button>
      ) : null}

      {sorted.length === 0 ? (
        <EmptyState
          title="No hay piques o apuestas activas en este grupo"
          subtitle="Registra aquí apuestas o deudas informales entre miembros, sin tocar el balance de gastos"
          icon={
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
            </svg>
          }
          action={
            <Button onClick={onNew}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Lanzar un pique
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {sorted.map((d) => {
            const iAmCreditor = d.creditorId === myUserId;
            const iAmDebtor = d.debtorId === myUserId;
            return (
              <div key={d.id} className={`rounded-2xl border p-4 ${DEBT_STATUS_BORDER[d.status]}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-100">{d.title}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                      <span className="flex min-w-0 items-center gap-1">
                        <span className="truncate">{d.debtorName}</span>
                        {d.debtorIsGhost ? <GhostBadge showLabel={false} /> : null}
                      </span>
                      <span>debe a</span>
                      <span className="flex min-w-0 items-center gap-1">
                        <span className="truncate">{d.creditorName}</span>
                        {d.creditorIsGhost ? <GhostBadge showLabel={false} /> : null}
                      </span>
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${DEBT_STATUS_BADGE[d.status]}`}
                  >
                    {DEBT_STATUS_LABELS[d.status]}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-lg font-extrabold text-slate-100">
                    <Money amount={d.amount} currency={currency} />
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {d.status === "pending" && iAmDebtor ? (
                      <>
                        <Button
                          variant="secondary"
                          className="!px-3 !py-1.5 text-xs"
                          onClick={() => setStatus(d, "accepted")}
                        >
                          Aceptar
                        </Button>
                        <Button
                          variant="ghost"
                          className="!px-3 !py-1.5 text-xs text-rose-400"
                          onClick={() => setStatus(d, "rejected")}
                        >
                          Rechazar
                        </Button>
                      </>
                    ) : null}
                    {d.status === "accepted" && iAmCreditor ? (
                      <Button
                        variant="secondary"
                        className="!px-3 !py-1.5 text-xs text-emerald-400"
                        onClick={() => setStatus(d, "settled")}
                      >
                        Marcar como pagado
                      </Button>
                    ) : null}
                    {d.status === "pending" && !iAmDebtor ? (
                      <span className="text-[11px] text-slate-500">A la espera de que {d.debtorName} acepte</span>
                    ) : null}
                    {d.status === "accepted" && !iAmCreditor ? (
                      <span className="text-[11px] text-slate-500">A la espera de que {d.creditorName} confirme el pago</span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-[11px] text-slate-600">
        Los piques se gestionan de forma independiente y no afectan al balance de gastos compartidos.
      </p>
    </div>
  );
}

function NewDebtModal({
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
  const [debtorId, setDebtorId] = useState("");
  const [creditorId, setCreditorId] = useState("");
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setDebtorId("");
      setCreditorId("");
      setAmount("");
      setTitle("");
      setError("");
    }
  }, [open]);

  async function submit() {
    setLoading(true);
    setError("");
    try {
      await api.post(`/groups/${groupId}/informal-debts`, {
        creditorId,
        debtorId,
        amount: parseFloat(amount),
        title,
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
  const canSubmit =
    Boolean(debtorId) &&
    Boolean(creditorId) &&
    debtorId !== creditorId &&
    title.trim().length > 0 &&
    Number.isFinite(amountNum) &&
    amountNum > 0 &&
    !loading;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Lanzar un pique o apuesta"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit} loading={loading}>
            Crear pique
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          Un pique es una deuda informal entre dos miembros (apuestas, favores, recuerdos...). El deudor deberá aceptarlo
          para que quede cerrado y el acreedor podrá marcarlo como pagado.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Quién debe" value={debtorId} onChange={(e) => setDebtorId(e.target.value)}>
            <option value="">Elegir...</option>
            {active.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </Select>
          <Select label="A quién" value={creditorId} onChange={(e) => setCreditorId(e.target.value)}>
            <option value="">Elegir...</option>
            {active.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
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
        <Input label="Concepto" placeholder="Ej. Apuesta Clásico" value={title} onChange={(e) => setTitle(e.target.value)} />
        {error ? <p className="text-xs font-medium text-rose-400">{error}</p> : null}
      </div>
    </Modal>
  );
}

// ---------- Bote común ----------

function PotTab({
  balance,
  contributions,
  myUserId,
  isAdmin,
  currency,
  onChanged,
  onNew,
}: {
  balance: number;
  contributions: PotContributionDto[];
  myUserId: string;
  isAdmin: boolean;
  currency: string;
  onChanged: () => void;
  onNew: () => void;
}) {
  async function removeContribution(contribution: PotContributionDto) {
    if (!confirm(`¿Eliminar la aportación de ${contribution.userName}?`)) return;
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
        <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">Saldo del bote común</p>
        <p className="mt-1 text-3xl font-extrabold text-emerald-300">
          <Money amount={balance} currency={currency} />
        </p>
        <p className="mt-1 text-xs text-slate-500">Dinero aportado por los miembros para gastos compartidos del grupo</p>
        {contributions.length > 0 ? (
          <Button variant="secondary" className="mt-4" onClick={onNew}>
            Aportar al bote
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Aportaciones</p>
        {contributions.length === 0 ? (
          <EmptyState
            title="El bote está vacío"
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
                Añadir dinero al bote
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
                  {c.note ? `${c.note} · ` : ""}
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
              {!c.expenseId && (isAdmin || c.userId === myUserId) ? (
                <button
                  onClick={() => void removeContribution(c)}
                  className="shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-rose-400"
                  title="Eliminar aportación"
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
      title="Aportar al bote común"
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
          El importe se suma al saldo del bote del grupo. Apunta un concepto para que los demás sepan a qué se destina.
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
      await api.patch(`/groups/${expense.groupId}/recurring-expenses/${expense.id}`, { active: !expense.active });
      onChanged();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Error");
    } finally {
      setTogglingId(null);
    }
  }

  async function removeExpense(expense: RecurringExpenseDto) {
    if (!confirm(`¿Eliminar la cuota fija "${expense.title}"?`)) return;
    try {
      await api.delete(`/groups/${expense.groupId}/recurring-expenses/${expense.id}`);
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
          Añadir cuota fija
        </button>
      ) : null}

      {sorted.length === 0 ? (
        <EmptyState
          title="Sin cuotas ni suscripciones periódicas configuradas"
          subtitle="Programa aquí suscripciones o cuotas que se repiten cada mes o cada semana"
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
                  {FREQUENCY_LABELS[expense.frequency]} · Responsable: {expense.responsibleName}
                  {expense.active ? "" : " · Pausada"}
                </p>
                <span
                  className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    expense.autoCreate
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-amber-500/10 text-amber-400"
                  }`}
                  title={
                    expense.autoCreate
                      ? "Se genera el gasto automáticamente cuando vence"
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
      await api.post(`/groups/${groupId}/recurring-expenses`, {
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
      title="Añadir cuota fija"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit} loading={loading}>
            Añadir cuota
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          Define una suscripción o pago que se repite cada mes o cada semana. El miembro responsable podrá marcarla como
          pagada pausándola.
        </p>
        <Input label="Título" placeholder="Ej. Netflix, gimnasio, alquiler..." value={title} onChange={(e) => setTitle(e.target.value)} />
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
                ? "Al vencer se crea el gasto automáticamente"
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

// ---------- Añadir participante sin cuenta ----------

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
      setError(err instanceof ApiError ? err.message : "Error al añadir el participante");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Añadir participante sin cuenta"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} loading={loading}>
            Añadir
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          Se añadirá al grupo como participante sin correo ni registro. Podrá aparecer en gastos y saldos, y vincularse a
          una cuenta real más adelante.
        </p>
        <Input label="Nombre" placeholder="Ej. Laura (invitada)" value={name} onChange={(e) => setName(e.target.value)} />
        {error ? <p className="text-xs font-medium text-rose-400">{error}</p> : null}
      </div>
    </Modal>
  );
}

// ---------- Historial ----------

function HistoryTab({
  events,
  currency,
  groupName,
  memberName,
  myUserId,
  onChanged,
  onViewProof,
}: {
  events: HistoryEvent[];
  currency: string;
  groupName: string;
  memberName: (id: string) => string;
  myUserId: string;
  onChanged: () => void;
  onViewProof: (url: string) => void;
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
      `Divido · Historial de actividad de ${groupName}`,
      `Exportado el ${new Date().toLocaleString("es-ES")}`,
      `Moneda del grupo: ${currency}`,
      "",
    ];
    for (const e of events) {
      const when = new Date(e.date).toLocaleString("es-ES");
      if (e.type === "member_joined") {
        lines.push(`[${when}] ${e.userName} se unió al grupo`);
      } else if (e.type === "member_left") {
        lines.push(`[${when}] ${e.userName} abandonó el grupo`);
      } else if (e.type === "member_removed") {
        lines.push(`[${when}] ${e.userName} fue expulsado del grupo`);
      } else if (e.type === "payment") {
        lines.push(
          `[${when}] ${e.fromName} pagó a ${e.toName} ${e.amount?.toFixed(2)} ${currency}${e.note ? ` (${e.note})` : ""}`
        );
      } else if (e.type === "expense") {
        const parts = [`[${when}] ${e.payerName} pagó ${e.description}`];
        parts.push(`${(e.amountGroup ?? 0).toFixed(2)} ${e.currency ?? currency}`);
        if (e.deleted) parts.push("(eliminado)");
        if (e.edited) parts.push("(modificado)");
        lines.push(parts.join(" "));
      }
    }
    lines.push("", `Total de eventos: ${events.length}`);
    downloadText(lines.join("\n"), `historial-${groupName.replace(/[^a-z0-9]+/gi, "-")}.txt`);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        {events.length > 0 ? (
          <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={exportHistory}>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Exportar historial
          </Button>
        ) : null}
      </div>
      <div className="space-y-1">
        {events.length === 0 ? (
          <EmptyState
            title="No hay actividad registrada en este grupo"
            subtitle="Aquí aparecerán los gastos y pagos en orden cronológico"
            icon={
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
            }
          />
        ) : (
        events.map((e, i) => {
          const isMemberEvent = e.type === "member_joined" || e.type === "member_left" || e.type === "member_removed";
          const isExpense = e.type === "expense";
          const isPayment = e.type === "payment";
          const iconColor = isMemberEvent
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
                isMemberEvent ? "bg-slate-900/30 opacity-80" : "hover:bg-slate-900"
              }`}
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
                  {isMemberEvent ? (
                    <>
                      <strong>{e.userName}</strong>{" "}
                      {e.type === "member_joined"
                        ? "se unió al grupo"
                        : e.type === "member_left"
                          ? "abandonó el grupo"
                          : "fue expulsado del grupo"}
                    </>
                  ) : isPayment ? (
                    <>
                      <strong>{e.fromName}</strong> pagó a <strong>{e.toName}</strong>
                      {e.note ? ` · ${e.note}` : ""}
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
                      <strong>{e.payerName}</strong> pagó {e.description}
                      {e.deleted ? <span className="ml-1.5 text-[10px] text-rose-400">(eliminado)</span> : null}
                      {e.edited ? <span className="ml-1.5 text-[10px] text-amber-400">(modificado)</span> : null}
                    </>
                  )}
                </p>
                <p className="text-[11px] text-slate-500">{fmtDate(e.date)}</p>
              </div>
              {isPayment || isExpense ? (
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className={`shrink-0 text-sm font-bold ${isPayment ? "text-emerald-400" : "text-slate-100"}`}>
                    <Money amount={isPayment ? (e.amount ?? 0) : (e.amountGroup ?? 0)} currency={isPayment ? currency : (e.currency ?? currency)} />
                  </span>
                  {isPayment && e.paymentStatus === "pending_confirmation" && e.toUserId === myUserId ? (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="secondary"
                        className="!px-2.5 !py-1 text-[11px] text-emerald-400"
                        disabled={deciding}
                        onClick={() => void confirmPayment(e.id, true)}
                      >
                        Aceptar
                      </Button>
                      <Button
                        variant="ghost"
                        className="!px-2.5 !py-1 text-[11px] text-rose-400"
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
        </div>
      </div>
  );
}

// ---------- Ajustes ----------

function SettingsModal({
  open,
  onClose,
  detail,
  isAdmin,
  onLeave,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  detail: GroupDetail;
  isAdmin: boolean;
  onLeave: () => void;
  onChanged: () => void;
}) {
  const { group } = detail;
  const [name, setName] = useState(group.name);
  const [currency, setCurrency] = useState(group.currency);
  const [type, setType] = useState<"open" | "closed">(group.type);
  const [logoUrl, setLogoUrl] = useState(group.logoUrl ?? "");
  const [enabledExtras, setEnabledExtras] = useState<string[]>(group.enabledExtras ?? []);
  const [simplifyDebts, setSimplifyDebts] = useState(group.simplifyDebts);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(group.name);
      setCurrency(group.currency);
      setType(group.type);
      setLogoUrl(group.logoUrl ?? "");
      setEnabledExtras(group.enabledExtras ?? []);
      setSimplifyDebts(group.simplifyDebts);
      setError("");
    }
  }, [open, group]);

  function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  }

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/groups/${group.id}`, { name, currency, type, logoUrl: logoUrl.trim() || null, enabledExtras, simplifyDebts });
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajustes del grupo"
      footer={
        isAdmin ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving}>
              Guardar
            </Button>
          </>
        ) : null
      }
    >
      <div className="space-y-4">
        {isAdmin ? (
          <>
            <div className="flex items-center gap-4">
              <Avatar name={name || group.name} url={logoUrl || null} size="lg" />
              <div className="flex flex-col gap-2">
                <Button
                  variant="secondary"
                  className="!px-3 !py-1.5 text-xs"
                  onClick={() => fileRef.current?.click()}
                >
                  Subir logo
                </Button>
                {logoUrl ? (
                  <Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={() => setLogoUrl("")}>
                    Quitar logo
                  </Button>
                ) : null}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
              </div>
            </div>
            <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Moneda" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {["EUR", "USD", "GBP", "MXN", "ARS", "COP", "CLP", "PEN", "BRL", "CHF", "CAD"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Select label="Tipo" value={type} onChange={(e) => setType(e.target.value as "open" | "closed")}>
                <option value="open">Abierto</option>
                <option value="closed">Cerrado</option>
              </Select>
            </div>
            <div className="border-t border-slate-800 pt-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Extras del grupo</p>
              <div className="space-y-2">
                {GROUP_EXTRAS.map((extra) => {
                  const enabled = enabledExtras.includes(extra.key);
                  return (
                    <button
                      key={extra.key}
                      type="button"
                      onClick={() =>
                        setEnabledExtras((prev) =>
                          enabled ? prev.filter((x) => x !== extra.key) : [...prev, extra.key]
                        )
                      }
                      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-left transition hover:border-slate-600"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-200">{extra.label}</span>
                        <span className="mt-0.5 block text-[11px] text-slate-500">{extra.description}</span>
                      </span>
                      <span
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                          enabled ? "bg-indigo-600" : "bg-slate-700"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                            enabled ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setSimplifyDebts((prev) => !prev)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-left transition hover:border-slate-600"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-200">Simplificar deudas automáticamente</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    Consolida las deudas en cadena (si A debe a B y B a C, se propone A → C) para reducir los pagos
                    sugeridos en la pestaña Saldos.
                  </span>
                </span>
                <span
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                    simplifyDebts ? "bg-indigo-600" : "bg-slate-700"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                      simplifyDebts ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </span>
              </button>
            </div>
            {error ? <p className="text-xs text-rose-400">{error}</p> : null}
          </>
        ) : (
          <p className="text-sm text-slate-400">Solo los administradores pueden modificar la configuración del grupo.</p>
        )}
        <div className="border-t border-slate-800 pt-4">
          <Button variant="danger" onClick={onLeave} className="w-full">
            Abandonar grupo
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------- Detalle de persona ----------

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

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-ES", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
