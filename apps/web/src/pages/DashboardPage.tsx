import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Avatar, Button, Input, Modal, Money, Select, Spinner, EmptyState } from "../components/ui";
import { Logo } from "../components/Logo";
import { ProfileModal } from "../components/ProfileModal";
import type { GroupDetail, GroupSummary } from "../lib/types";

export default function DashboardPage() {
  const { user } = useAuth();
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

  const owedToMe = groups.reduce((s, g) => s + g.totalOwedToMe, 0);
  const owedByMe = groups.reduce((s, g) => s + g.totalOwedByMe, 0);
  const netTotal = owedToMe - owedByMe;
  const allSettled = owedToMe < 0.005 && owedByMe < 0.005;
  const summaryCurrency = groups[0]?.currency ?? "EUR";

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Logo className="h-9 w-9" />
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="rounded-full transition hover:ring-2 hover:ring-indigo-500/50"
            aria-label="Tu perfil"
          >
            <Avatar name={user?.name ?? ""} url={user?.avatarUrl} size="md" />
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

        {groups.length > 0 ? (
          <div className="mb-5 rounded-2xl border border-slate-800/60 bg-gradient-to-br from-slate-900 to-slate-900/50 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Balance total</p>
            {allSettled ? (
              <p className="mt-2 text-lg font-extrabold text-emerald-400">Estás al día en todos tus grupos</p>
            ) : (
              <>
                <p
                  className={`mt-1 text-3xl font-extrabold ${
                    netTotal > 0.004 ? "text-emerald-400" : netTotal < -0.004 ? "text-rose-400" : "text-slate-100"
                  }`}
                >
                  <Money amount={netTotal} currency={summaryCurrency} />
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-400">
                    Te deben <Money amount={owedToMe} currency={summaryCurrency} />
                  </span>
                  <span className="rounded-lg bg-rose-500/10 px-2.5 py-1 font-semibold text-rose-400">
                    Debes <Money amount={owedByMe} currency={summaryCurrency} />
                  </span>
                </div>
              </>
            )}
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
              <GroupCard key={g.id} group={g} />
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
            <Button onClick={createGroup} loading={creating} disabled={!name.trim()} className="flex-1">
              Crear grupo
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-slate-400">
          Crea un grupo para empezar a repartir gastos y llevar las cuentas con tus compañeros.
        </p>
        <div className="space-y-4 pb-1">
          <Input
            label="Nombre del grupo"
            placeholder="Ej. Viaje a Roma"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}

function GroupCard({ group }: { group: GroupSummary }) {
  const positive = group.myBalance > 0.004;
  const negative = group.myBalance < -0.004;

  return (
    <Link
      to={`/groups/${group.id}`}
      className="flex items-center gap-4 rounded-2xl border border-slate-800/60 bg-slate-900 p-4 transition hover:border-slate-700 hover:bg-slate-800/60 active:scale-[0.99]"
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
      </div>
      {positive ? (
        <span className="shrink-0 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
          +<Money amount={group.myBalance} currency={group.currency} />
        </span>
      ) : negative ? (
        <span className="shrink-0 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-400">
          <Money amount={group.myBalance} currency={group.currency} />
        </span>
      ) : (
        <span className="shrink-0 rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-400">
          Al día
        </span>
      )}
    </Link>
  );
}
