import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Avatar, Button, EmptyState, Input, Modal, Money, Select, Spinner, Tabs } from "../components/ui";
import { ExpenseModal } from "../components/ExpenseModal";
import { PaymentModal } from "../components/PaymentModal";
import type {
  BreakdownItem,
  ExpenseDto,
  GroupDetail,
  HistoryEvent,
  MemberInfo,
  ModificationRequestDto,
} from "../lib/types";

type Tab = "expenses" | "balances" | "members" | "history";

export default function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [expenses, setExpenses] = useState<ExpenseDto[]>([]);
  const [requests, setRequests] = useState<ModificationRequestDto[]>([]);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [tab, setTab] = useState<Tab>("expenses");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [editTarget, setEditTarget] = useState<ExpenseDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseDto | null>(null);
  const [breakdownTarget, setBreakdownTarget] = useState<MemberInfo | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [memberDetail, setMemberDetail] = useState<{ member: MemberInfo; data: BreakdownItem[] } | null>(null);

  const isAdmin = detail?.myRole === "admin";

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const [d, e, h, r] = await Promise.all([
        api.get<GroupDetail>(`/groups/${groupId}`),
        api.get<{ expenses: ExpenseDto[] }>(`/groups/${groupId}/expenses`),
        api.get<{ events: HistoryEvent[] }>(`/groups/${groupId}/history`),
        api.get<{ requests: ModificationRequestDto[] }>(`/groups/${groupId}/requests`).catch(() => null),
      ]);
      setDetail(d);
      setExpenses(e.expenses);
      setHistory(h.events);
      if (r) setRequests(r.requests);
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
  const myBalance = g.balances.find((b) => b.isMe)?.net ?? 0;
  const positive = myBalance > 0.004;
  const negative = myBalance < -0.004;
  const balanceColor = positive ? "text-emerald-400" : negative ? "text-rose-400" : "text-slate-400";

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(g.inviteUrl);
    } catch {
      window.prompt("Copia este enlace de invitación:", g.inviteUrl);
    }
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
              Te deben <Money amount={detail.balances.filter((b) => b.net > 0 && !b.isMe).reduce((s, b) => s + b.net, 0)} currency={group.currency} />
            </span>
            <span className="rounded-lg bg-rose-500/10 px-2.5 py-1 font-semibold text-rose-400">
              Debes <Money amount={detail.balances.filter((b) => b.net < 0 && !b.isMe).reduce((s, b) => s - b.net, 0)} currency={group.currency} />
            </span>
          </div>
        </div>

        <Tabs
          tabs={[
            { key: "expenses", label: "Gastos" },
            { key: "balances", label: "Saldos" },
            { key: "members", label: "Miembros" },
            { key: "history", label: "Historial" },
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
    </div>
  );
}

// ---------- Gastos ----------

function ExpensesTab({
  expenses,
  memberName,
  isAdmin,
  groupCurrency,
  onEdit,
  onDelete,
  requests,
  onDecide,
}: {
  expenses: ExpenseDto[];
  memberName: (id: string) => string;
  isAdmin: boolean;
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
                  <p className="mt-0.5 text-[11px] text-slate-500">cada uno {e.share.toFixed(2)}</p>
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
            </div>
          ))}
        </div>
      )}
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
            onClick={() => onOpenMember({ userId: b.userId, name: b.name, email: null, avatarUrl: null, role: "member", status: "active", joinedAt: "", leftAt: null, frozenBalance: null })}
            className={`flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-left transition hover:border-slate-700 ${
              b.isMe ? "border-indigo-500/50" : ""
            }`}
          >
            <Avatar name={b.name} size="sm" />
            <span className="flex-1 text-sm font-medium text-slate-200">
              {b.name}
              {b.isMe ? <span className="ml-2 text-[10px] text-indigo-400">tú</span> : null}
            </span>
            <span className={`text-sm font-bold ${b.net > 0.004 ? "text-emerald-400" : b.net < -0.004 ? "text-rose-400" : "text-slate-500"}`}>
              <Money amount={b.net} currency={group.currency} />
            </span>
          </button>
        ))}
      </div>

      {transfers.length > 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <p className="mb-3 text-sm font-bold text-slate-100">Pagos sugeridos (optimizados)</p>
          <p className="mb-3 text-[11px] text-slate-500">
            {transfers.length} transferencia{transfers.length !== 1 ? "s" : ""} para liquidar todo el grupo
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
      <button
        onClick={onCopyInvite}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-indigo-500/50 bg-indigo-500/5 px-4 py-3 text-sm font-semibold text-indigo-300 transition hover:bg-indigo-500/10"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
        Copiar enlace de invitación
      </button>

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
                <p className="truncate text-sm font-medium text-slate-200">
                  {m.name} {isMe ? <span className="text-[10px] text-indigo-400">tú</span> : null}
                </p>
                <p className="text-[11px] text-slate-500">
                  {m.role === "admin" ? "Administrador" : "Miembro"}
                </p>
              </div>
              {isAdmin && !isMe ? (
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
    </div>
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
        events.map((e, i) => (
          <div key={`${e.type}-${e.id}-${i}`} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-slate-900">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                e.type === "payment" ? "bg-emerald-500/15 text-emerald-400" : "bg-indigo-500/15 text-indigo-400"
              }`}
            >
              {e.type === "payment" ? (
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
                {e.type === "payment" ? (
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
            <span className={`shrink-0 text-sm font-bold ${e.type === "payment" ? "text-emerald-400" : "text-slate-100"}`}>
              <Money amount={e.type === "payment" ? (e.amount ?? 0) : (e.amountGroup ?? 0)} currency={e.type === "payment" ? currency : (e.currency ?? currency)} />
            </span>
          </div>
        ))
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(group.name);
      setCurrency(group.currency);
      setType(group.type);
      setError("");
    }
  }, [open, group]);

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/groups/${group.id}`, { name, currency, type });
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
    <Modal open onClose={onClose} title={`Transacciones con ${member.name}`}>
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
