import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Avatar, Button, Input, Modal, Money, Select, Spinner, EmptyState } from "../components/ui";
import { ExpenseModal } from "../components/ExpenseModal";
import { ProfileModal } from "../components/ProfileModal";
import type { GroupDetail, GroupSummary } from "../lib/types";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [type, setType] = useState<"open" | "closed">("open");
  const [creating, setCreating] = useState(false);
  const [quickExpense, setQuickExpense] = useState<GroupSummary | null>(null);
  const [quickMembers, setQuickMembers] = useState<GroupDetail["members"]>([]);

  async function load() {
    try {
      const res = await api.get<{ groups: GroupSummary[] }>("/groups");
      setGroups(res.groups);
      setError("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error cargando grupos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createGroup() {
    setCreating(true);
    try {
      const res = await api.post<{ group: GroupDetail }>("/groups", { name, currency, type });
      setCreateOpen(false);
      setName("");
      navigate(`/groups/${res.group.group.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error creando grupo");
    } finally {
      setCreating(false);
    }
  }

  async function openQuickExpense(group: GroupSummary) {
    try {
      const res = await api.get<GroupDetail>(`/groups/${group.id}`);
      setQuickMembers(res.members);
      setQuickExpense(group);
    } catch {
      setError("No se pudo abrir la acción rápida");
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-lg font-black text-white">
              €
            </div>
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="flex touch-manipulation items-center gap-2 rounded-lg px-1.5 py-1 text-left transition hover:bg-slate-800"
            >
              <Avatar name={user?.name ?? ""} url={user?.avatarUrl} size="sm" />
              <span>
                <p className="text-sm font-bold leading-tight text-slate-100">Divido</p>
                <p className="text-[11px] text-slate-500">{user?.name}</p>
              </span>
            </button>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
              />
            </svg>
            Salir
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        {user && !user.emailVerified ? (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
            <span className="mt-0.5 text-lg">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-300">Verifica tu email</p>
              <p className="mt-0.5 text-xs text-amber-400/80">
                Hasta que verifiques tu email no podrás crear grupos ni unirte a más de 3.
              </p>
            </div>
            <Button
              variant="secondary"
              className="!px-3 !py-1.5 text-xs"
              onClick={() => setProfileOpen(true)}
            >
              Verificar
            </Button>
          </div>
        ) : null}

        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-slate-100">Mis grupos</h1>
          {user?.emailVerified ? (
            <Button onClick={() => setCreateOpen(true)} className="!py-2">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nuevo grupo
            </Button>
          ) : null}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-7 w-7" />
          </div>
        ) : error ? (
          <p className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-400">{error}</p>
        ) : groups.length === 0 ? (
          <EmptyState
            title="Aún no tienes grupos"
            subtitle="Crea tu primer grupo o únete a uno con un enlace de invitación"
            icon={
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v12m-6-6h12"
                />
              </svg>
            }
          />
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <GroupCard key={g.id} group={g} onQuickAdd={() => openQuickExpense(g)} />
            ))}
          </div>
        )}
      </main>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nuevo grupo"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={createGroup} loading={creating} disabled={!name.trim()}>
              Crear grupo
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nombre del grupo"
            placeholder="Ej. Viaje a Roma"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Moneda principal" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {["EUR", "USD", "GBP", "MXN", "ARS", "COP", "CLP", "PEN", "BRL", "CHF", "CAD"].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select label="Tipo" value={type} onChange={(e) => setType(e.target.value as "open" | "closed")}>
              <option value="open">Abierto — todos invitan</option>
              <option value="closed">Cerrado — solo admins</option>
            </Select>
          </div>
        </div>
      </Modal>

      {quickExpense ? (
        <ExpenseModal
          open={Boolean(quickExpense)}
          onClose={() => setQuickExpense(null)}
          groupId={quickExpense.id}
          groupCurrency={quickExpense.currency}
          members={quickMembers}
          defaultPayerId={user?.id ?? ""}
          onCreated={() => {
            load();
            if (quickExpense) navigate(`/groups/${quickExpense.id}`);
          }}
        />
      ) : null}

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}

function GroupCard({ group, onQuickAdd }: { group: GroupSummary; onQuickAdd: () => void }) {
  const positive = group.myBalance > 0.004;
  const negative = group.myBalance < -0.004;
  const color = positive
    ? "text-emerald-400"
    : negative
      ? "text-rose-400"
      : "text-slate-500";

  return (
    <Link
      to={`/groups/${group.id}`}
      className="group relative flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 transition hover:border-slate-700 hover:bg-slate-800/60"
    >
      {group.logoUrl ? (
        <img
          src={group.logoUrl}
          alt={group.name}
          className="h-11 w-11 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-lg font-bold text-indigo-300">
          {group.name[0]?.toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-100">{group.name}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {group.memberCount} miembro{group.memberCount !== 1 ? "s" : ""} · {group.currency}
        </p>
        <p className={`mt-1 text-sm font-bold ${color}`}>
          {negative ? "Debes " : positive ? "Te deben " : "Al día "}
          <Money amount={Math.abs(group.myBalance)} currency={group.currency} />
        </p>
      </div>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onQuickAdd();
        }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white opacity-90 shadow transition hover:bg-indigo-500 active:scale-95"
        aria-label="Añadir gasto rápido"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>
    </Link>
  );
}
