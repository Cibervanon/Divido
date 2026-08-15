import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Avatar, Button, EmptyState, GhostBadge, Input, Modal, Money, Select, Spinner, Tabs, Toast, VerifiedBadge } from "../components/ui";
import { ExpenseModal } from "../components/ExpenseModal";
import { PaymentModal } from "../components/PaymentModal";
import type {
  BreakdownItem,
  ExpenseCommentDto,
  ExpenseDto,
  GroupDetail,
  HistoryEvent,
  InformalDebtDto,
  MemberInfo,
  ModificationRequestDto,
} from "../lib/types";
import type { InformalDebtStatus } from "@divido/shared";

type Tab = "expenses" | "balances" | "members" | "history" | "debts";

export default function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [expenses, setExpenses] = useState<ExpenseDto[]>([]);
  const [requests, setRequests] = useState<ModificationRequestDto[]>([]);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [debts, setDebts] = useState<InformalDebtDto[]>([]);
  const [tab, setTab] = useState<Tab>("expenses");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showNewDebt, setShowNewDebt] = useState(false);
  const [editTarget, setEditTarget] = useState<ExpenseDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseDto | null>(null);
  const [breakdownTarget, setBreakdownTarget] = useState<MemberInfo | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [memberDetail, setMemberDetail] = useState<{ member: MemberInfo; data: BreakdownItem[] } | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }

  const isAdmin = detail?.myRole === "admin";

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const [d, e, h, r, dd] = await Promise.all([
        api.get<GroupDetail>(`/groups/${groupId}`),
        api.get<{ expenses: ExpenseDto[] }>(`/groups/${groupId}/expenses`),
        api.get<{ events: HistoryEvent[] }>(`/groups/${groupId}/history`),
        api.get<{ requests: ModificationRequestDto[] }>(`/groups/${groupId}/requests`).catch(() => null),
        api.get<{ debts: InformalDebtDto[] }>(`/groups/${groupId}/informal-debts`).catch(() => null),
      ]);
      setDetail(d);
      setExpenses(e.expenses);
      setHistory(h.events);
      if (r) setRequests(r.requests);
      if (dd) setDebts(dd.debts);
      setError("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error cargando el grupo");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
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

      <main className="mx-auto max-w-2xl px-4 pt-5">
        <div className="mb-5 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Tu balance</p>
          <p className={`mt-1 text-3xl font-extrabold ${balanceColor}`}>
            {negative ? "-" : ""}
            <Money amount={Math.abs(myBalance)} currency={group.currency} />
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-400">
              Te deben <Money amount={myBalance > 0.004 ? myBalance : 0} currency={group.currency} />
            </span>
            <span className="rounded-lg bg-rose-500/10 px-2.5 py-1 font-semibold text-rose-400">
              Debes <Money amount={myBalance < -0.004 ? -myBalance : 0} currency={group.currency} />
            </span>
          </div>
        </div>

        <Tabs
          tabs={[
            { key: "expenses", label: "Gastos" },
            { key: "balances", label: "Saldos" },
            { key: "members", label: "Miembros" },
            { key: "history", label: "Historial" },
            ...(hasDebts ? [{ key: "debts", label: "Piques" }] : []),
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
              requests={requests}
              onDecide={decideRequest}
            />
          ) : null}
          {tab === "balances" ? (
            <BalancesTab detail={detail} myUserId={user.id} onOpenMember={openBreakdown} />
          ) : null}
          {tab === "members" ? (
            <MembersTab
              detail={detail}
              myUserId={user.id}
              isAdmin={isAdmin}
              onCopyInvite={copyInvite}
              onChanged={load}
              onOpenMember={openBreakdown}
            />
          ) : null}
          {tab === "history" ? <HistoryTab events={history} currency={group.currency} memberName={memberName} /> : null}
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
          onClick={() => setShowAddExpense(true)}
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
        onClose={() => setShowAddExpense(false)}
        groupId={group.id}
        groupCurrency={group.currency}
        members={detail.members}
        defaultPayerId={user.id}
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

      <Toast show={Boolean(toast)}>{toast}</Toast>
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
  requests: ModificationRequestDto[];
  onDecide: (id: string, d: "approve" | "reject") => void;
}) {
  const pending = requests.filter((r) => r.status === "pending");

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
          title="Sin gastos todavía"
          subtitle="Añade tu primer gasto con el botón +"
          icon={
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
            </svg>
          }
        />
      ) : (
        <div className="space-y-2">
          {expenses.map((e) => (
            <div
              key={e.id}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-4 transition hover:border-slate-700"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-100">
                    {e.description}
                    {e.deleted ? <span className="ml-2 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-400">eliminado</span> : null}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {e.payerName} pagó · {e.participantsCount} participante{e.participantsCount !== 1 ? "s" : ""}
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

function BalancesTab({
  detail,
  myUserId,
  onOpenMember,
}: {
  detail: GroupDetail;
  myUserId: string;
  onOpenMember: (m: MemberInfo) => void;
}) {
  const { group, balances, transfers, exMembers } = detail;
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        {balances.map((b) => (
          <button
            key={b.userId}
            onClick={() => onOpenMember({ userId: b.userId, name: b.name, email: null, avatarUrl: null, emailVerified: b.emailVerified ?? false, isGhost: b.isGhost ?? false, role: "member", status: "active", joinedAt: "", leftAt: null, frozenBalance: null })}
            className={`flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-left transition hover:border-slate-700 ${
              b.isMe ? "border-indigo-500/50" : ""
            }`}
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
        ))}
      </div>

      {transfers.length > 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <p className="mb-3 text-sm font-bold text-slate-100">Pagos sugeridos (liquidación optimizada)</p>
          <p className="mb-3 text-[11px] text-slate-500">
            {transfers.length} transferencia{transfers.length !== 1 ? "s" : ""} para liquidar todo el grupo.
            Las deudas en cadena se consolidan (si A debe a B y B a C, se propone A → C).
          </p>
          <div className="space-y-2">
            {transfers.map((t, i) => (
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
      ) : null}

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

// ---------- Miembros ----------

function MembersTab({
  detail,
  myUserId,
  isAdmin,
  onCopyInvite,
  onChanged,
  onOpenMember,
}: {
  detail: GroupDetail;
  myUserId: string;
  isAdmin: boolean;
  onCopyInvite: () => void;
  onChanged: () => void;
  onOpenMember: (m: MemberInfo) => void;
}) {
  const { group, members } = detail;
  const active = members.filter((m) => m.status === "active");
  const ex = members.filter((m) => m.status === "ex_member");
  const [ghostOpen, setGhostOpen] = useState(false);

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
      <button
        onClick={onNew}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-indigo-500/50 bg-indigo-500/5 px-4 py-3 text-sm font-semibold text-indigo-300 transition hover:bg-indigo-500/10"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Lanzar un pique o apuesta
      </button>

      {sorted.length === 0 ? (
        <EmptyState
          title="Sin piques todavía"
          subtitle="Registra aquí apuestas o deudas informales entre miembros, sin tocar el balance de gastos"
          icon={
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
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
  memberName,
}: {
  events: HistoryEvent[];
  currency: string;
  memberName: (id: string) => string;
}) {
  return (
    <div className="space-y-1">
      {events.length === 0 ? (
        <EmptyState title="Sin actividad" subtitle="Aquí aparecerán gastos y pagos saldados en orden cronológico" />
      ) : (
        events.map((e, i) => {
          const isMemberEvent = e.type === "member_joined" || e.type === "member_left";
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
            <div key={`${e.type}-${e.id}-${i}`} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-slate-900">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconColor}`}>
                {isMemberEvent ? (
                  e.type === "member_joined" ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
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
                      {e.type === "member_joined" ? "se unió al grupo" : "abandonó el grupo"}
                    </>
                  ) : isPayment ? (
                    <>
                      <strong>{e.fromName}</strong> pagó a <strong>{e.toName}</strong>
                      {e.note ? ` · ${e.note}` : ""}
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
                <span className={`shrink-0 text-sm font-bold ${isPayment ? "text-emerald-400" : "text-slate-100"}`}>
                  <Money amount={isPayment ? (e.amount ?? 0) : (e.amountGroup ?? 0)} currency={isPayment ? currency : (e.currency ?? currency)} />
                </span>
              ) : null}
            </div>
          );
        })
      )}
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
      setError("");
    }
  }, [open, group]);

  const isDataUrl = logoUrl.startsWith("data:image");

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
      await api.patch(`/groups/${group.id}`, { name, currency, type, logoUrl: logoUrl.trim() || null, enabledExtras });
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
            <Input
              label="Logo (URL)"
              placeholder="https://... o déjalo vacío"
              value={isDataUrl ? "Imagen subida desde tu dispositivo" : logoUrl}
              readOnly={isDataUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
            />
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
              <button
                type="button"
                onClick={() =>
                  setEnabledExtras((prev) =>
                    prev.includes("informal_debts") ? prev.filter((x) => x !== "informal_debts") : [...prev, "informal_debts"]
                  )
                }
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-left transition hover:border-slate-600"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-200">Piques y Apuestas</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    Deudas informales entre miembros (apuestas, favores...), aparte del balance de gastos.
                  </span>
                </span>
                <span
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                    enabledExtras.includes("informal_debts") ? "bg-indigo-600" : "bg-slate-700"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                      enabledExtras.includes("informal_debts") ? "translate-x-6" : "translate-x-1"
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
