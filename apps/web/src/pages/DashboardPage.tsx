import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpDown, Check, MoreVertical, Pin } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useNotifications } from "../lib/useNotifications";
import { markPushAsked, shouldAskPush, subscribeToPush } from "../lib/push";
import { Avatar, Button, DropdownMenu, EmptyState, Input, Modal, Money, Select, Spinner } from "../components/ui";
import { NotificationBell } from "../components/NotificationBell";
import { NotificationDrawer } from "../components/NotificationDrawer";
import { Logo } from "../components/Logo";
import { ProfileModal } from "../components/ProfileModal";
import type { GroupDetail, GroupSummary } from "../lib/types";

type GroupSort = "activity" | "name" | "amount";

const SORT_OPTIONS: Array<{ value: GroupSort; label: string }> = [
  { value: "activity", label: "Actividad reciente" },
  { value: "name", label: "Nombre A-Z" },
  { value: "amount", label: "Por saldo" },
];

export default function DashboardPage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [pinnedIds, setPinnedIds] = useState<string[]>(user?.pinnedGroupIds ?? []);
  const [sort, setSort] = useState<GroupSort>("activity");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [type, setType] = useState<"open" | "closed">("open");
  const [creating, setCreating] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showPushBanner, setShowPushBanner] = useState(shouldAskPush());
  const [enablingPush, setEnablingPush] = useState(false);
  const [pushError, setPushError] = useState("");
  const { notifications, unreadCount, initialized, markRead, markAllRead } = useNotifications();

  useEffect(() => {
    if (user) setPinnedIds(user.pinnedGroupIds ?? []);
  }, [user]);

  function compareGroups(a: GroupSummary, b: GroupSummary): number {
    if (sort === "name") return a.name.localeCompare(b.name, "es");
    if (sort === "amount") {
      return b.myBalance - a.myBalance || b.lastActivity.localeCompare(a.lastActivity);
    }
    return b.lastActivity.localeCompare(a.lastActivity) || a.name.localeCompare(b.name, "es");
  }

  const pinnedSet = new Set(pinnedIds);
  const pinnedGroups = groups.filter((g) => pinnedSet.has(g.id)).sort(compareGroups);
  const otherGroups = groups.filter((g) => !pinnedSet.has(g.id)).sort(compareGroups);

  async function togglePin(id: string) {
    const prev = pinnedIds;
    const next = pinnedIds.includes(id) ? pinnedIds.filter((x) => x !== id) : [...pinnedIds, id];
    setPinnedIds(next);
    updateUser({ pinnedGroupIds: next });
    try {
      await api.patch("/users/me", { pinnedGroupIds: next });
    } catch {
      setPinnedIds(prev);
      updateUser({ pinnedGroupIds: prev });
    }
  }

  async function load() {
    try {
      const res = await api.get<{ groups: GroupSummary[] }>("/groups");
      setGroups(res.groups);
      debugBalances(res.groups);
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

  async function enablePush() {
    setEnablingPush(true);
    setPushError("");
    try {
      const result = await subscribeToPush();
      if (result.ok) {
        setShowPushBanner(false);
        return;
      }
      if (result.permanent) markPushAsked();
      setPushError(result.error);
    } catch {
      // Aunque subscribeToPush ya devuelve errores como resultado, este
      // guard garantiza que la bandera de carga siempre se libera.
      setPushError("No se pudo activar. Inténtalo de nuevo.");
    } finally {
      setEnablingPush(false);
    }
  }

  // Regla estricta por grupo: el balance neto propio (myBalance) indica o bien
  // "te deben" (positivo) o bien "debes" (negativo). Nunca se mezclan.
  const debtGroups = groups
    .filter((g) => g.myBalance < -0.004)
    .map((g) => ({ group: g, amount: -g.myBalance }))
    .sort((a, b) => b.amount - a.amount);
  const creditGroups = groups
    .filter((g) => g.myBalance > 0.004)
    .map((g) => ({ group: g, amount: g.myBalance }))
    .sort((a, b) => b.amount - a.amount);

  const owedByMe = debtGroups.reduce((s, d) => s + d.amount, 0);
  const owedToMe = creditGroups.reduce((s, c) => s + c.amount, 0);
  const netTotal = owedToMe - owedByMe;
  const hasDebt = owedByMe > 0.004;
  const hasCredit = owedToMe > 0.004;
  const allSettled = !hasDebt && !hasCredit;
  const crossAccounts = hasDebt && hasCredit;
  const summaryCurrency = groups[0]?.currency ?? "EUR";

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Logo className="h-9 w-9" />
          <div className="flex items-center gap-1">
            <NotificationBell unreadCount={unreadCount} onClick={() => setNotifOpen(true)} />
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="rounded-full transition hover:ring-2 hover:ring-indigo-500/50"
              aria-label="Tu perfil"
            >
              <Avatar name={user?.name ?? ""} url={user?.avatarUrl} size="md" />
            </button>
          </div>
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

        {showPushBanner ? (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4">
            <span className="mt-0.5 text-lg">🔔</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-indigo-300">Activa las notificaciones</p>
              <p className="mt-0.5 text-xs text-indigo-400/80">
                Te avisaremos al instante de gastos, pagos y piques nuevos en tus grupos, incluso con la app cerrada.
              </p>
              {pushError ? (
                <p className="mt-1.5 text-xs font-medium text-red-400">{pushError}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  markPushAsked();
                  setShowPushBanner(false);
                }}
                className="text-xs font-medium text-slate-400 transition hover:text-slate-200"
              >
                Ahora no
              </button>
              <Button
                variant="primary"
                className="!px-3 !py-1.5 text-xs"
                loading={enablingPush}
                onClick={() => void enablePush()}
              >
                Activar
              </Button>
            </div>
          </div>
        ) : null}

        {groups.length > 0 ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => setShowDetail((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setShowDetail((v) => !v);
              }
            }}
            className="mb-5 cursor-pointer rounded-2xl border border-slate-800/60 bg-gradient-to-br from-slate-900 to-slate-900/50 p-5 transition hover:border-slate-700"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  {crossAccounts ? "Cuentas cruzadas" : "Balance total"}
                </p>
                {allSettled ? (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </span>
                    <p className="text-lg font-extrabold text-emerald-400">
                      Estás al día · <Money amount={0} currency={summaryCurrency} />
                    </p>
                  </div>
                ) : (
                  <p
                    className={`mt-2 text-3xl font-extrabold ${
                      netTotal > 0.004 ? "text-emerald-400" : netTotal < -0.004 ? "text-rose-400" : "text-slate-100"
                    }`}
                  >
                    <Money amount={netTotal} currency={summaryCurrency} />
                  </p>
                )}
                {crossAccounts ? (
                  <p className="mt-1.5 text-xs text-slate-400">
                    Debes dinero en algún grupo, aunque tu balance neto sea 0.
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5 text-xs">
                {hasCredit ? (
                  <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-400">
                    Te deben <Money amount={owedToMe} currency={summaryCurrency} />
                  </span>
                ) : null}
                {hasDebt ? (
                  <span className="rounded-lg bg-rose-500/10 px-2.5 py-1 font-semibold text-rose-400">
                    Debes <Money amount={owedByMe} currency={summaryCurrency} />
                  </span>
                ) : null}
                <span className="flex items-center gap-1 font-medium text-slate-500">
                  {showDetail ? "Ocultar detalle" : "Ver detalle"}
                  <svg
                    className={`h-3.5 w-3.5 transition-transform ${showDetail ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </span>
              </div>
            </div>

            {showDetail ? (
              <div className="mt-4 space-y-2 border-t border-slate-800 pt-3">
                {creditGroups.length === 0 && debtGroups.length === 0 ? (
                  <p className="text-sm text-slate-400">No tienes saldos pendientes en ningún grupo.</p>
                ) : (
                  <>
                    {creditGroups.map(({ group, amount }) => (
                      <Link
                        key={`c-${group.id}`}
                        to={`/groups/${group.id}?tab=balances`}
                        className="flex items-center justify-between gap-3 rounded-xl bg-emerald-500/5 px-3 py-2 transition hover:bg-emerald-500/10"
                      >
                        <span className="truncate text-sm text-slate-300">
                          Te deben en <span className="font-semibold text-slate-100">{group.name}</span>
                        </span>
                        <span className="shrink-0 text-sm font-bold text-emerald-400">
                          +<Money amount={amount} currency={group.currency} />
                        </span>
                      </Link>
                    ))}
                    {debtGroups.map(({ group, amount }) => (
                      <Link
                        key={`d-${group.id}`}
                        to={`/groups/${group.id}?tab=balances`}
                        className="flex items-center justify-between gap-3 rounded-xl bg-rose-500/5 px-3 py-2 transition hover:bg-rose-500/10"
                      >
                        <span className="truncate text-sm text-slate-300">
                          Debes en <span className="font-semibold text-slate-100">{group.name}</span>
                        </span>
                        <span className="shrink-0 text-sm font-bold text-rose-400">
                          -<Money amount={amount} currency={group.currency} />
                        </span>
                      </Link>
                    ))}
                  </>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mb-5 flex items-center justify-between gap-3">
          <h1 className="text-xl font-extrabold text-slate-100">Mis grupos</h1>
          <div className="flex items-center gap-2">
            {groups.length > 0 ? (
              <DropdownMenu
                button={
                  <button
                    type="button"
                    aria-label="Ordenar grupos"
                    className="touch-manipulation rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-300 transition hover:bg-slate-800 hover:text-slate-100"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                  </button>
                }
              >
                {(close) => (
                  <div className="p-1">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setSort(opt.value);
                          close();
                        }}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-slate-800"
                      >
                        <span className={sort === opt.value ? "font-semibold text-slate-100" : "text-slate-300"}>
                          {opt.label}
                        </span>
                        {sort === opt.value ? <Check className="h-4 w-4 shrink-0 text-indigo-400" /> : null}
                      </button>
                    ))}
                  </div>
                )}
              </DropdownMenu>
            ) : null}
            {user?.emailVerified ? (
              <Button onClick={() => setCreateOpen(true)} className="!py-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Nuevo grupo
              </Button>
            ) : null}
          </div>
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
            {pinnedGroups.length > 0 ? (
              <>
                <p className="pt-2 text-xs font-bold uppercase tracking-wider text-indigo-400">Anclados</p>
                {pinnedGroups.map((g) => (
                  <GroupCard key={g.id} group={g} pinned onTogglePin={() => void togglePin(g.id)} />
                ))}
              </>
            ) : null}
            {otherGroups.length > 0 ? (
              <>
                {pinnedGroups.length > 0 ? (
                  <p className="pt-2 text-xs font-bold uppercase tracking-wider text-slate-500">Tus grupos</p>
                ) : null}
                {otherGroups.map((g) => (
                  <GroupCard key={g.id} group={g} pinned={false} onTogglePin={() => void togglePin(g.id)} />
                ))}
              </>
            ) : null}
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

      <NotificationDrawer
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        initialized={initialized}
        onMarkAllRead={() => void markAllRead()}
        onMarkRead={(id) => void markRead(id)}
        onOpenSettings={() => {
          setNotifOpen(false);
          setProfileOpen(true);
        }}
        onOpen={(n) => {
          setNotifOpen(false);
          void markRead(n.id);
          const url = safeNotificationUrl(n.linkUrl);
          if (url) navigate(url);
        }}
      />
    </div>
  );
}

function GroupCard({
  group,
  pinned,
  onTogglePin,
}: {
  group: GroupSummary;
  pinned: boolean;
  onTogglePin: () => void;
}) {
  const positive = group.myBalance > 0.004;
  const negative = group.myBalance < -0.004;

  return (
    <Link
      to={`/groups/${group.id}`}
      className={`group flex items-center gap-4 rounded-2xl border p-4 transition active:scale-[0.99] ${
        negative
          ? "border-rose-500/40 bg-rose-950/40 hover:border-rose-500/60 hover:bg-rose-950/60"
          : pinned
            ? "border-indigo-500/50 bg-indigo-950/30 hover:border-indigo-500/70 hover:bg-indigo-950/50"
            : "border-slate-800/60 bg-slate-900 hover:border-slate-700 hover:bg-slate-800/60"
      }`}
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
        <p className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-slate-100">{group.name}</span>
          {pinned ? (
            <Pin className="h-3.5 w-3.5 shrink-0 text-amber-400" fill="currentColor" aria-label="Anclado" />
          ) : null}
          {negative ? (
            <span className="shrink-0 rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-400">
              Pendiente
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {group.memberCount} miembro{group.memberCount !== 1 ? "s" : ""} · {group.currency}
        </p>
      </div>
      {positive ? (
        <span className="shrink-0 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
          +<Money amount={group.myBalance} currency={group.currency} />
        </span>
      ) : negative ? (
        <span className="shrink-0 rounded-full bg-rose-500/15 px-3 py-1 text-xs font-bold text-rose-400">
          <Money amount={group.myBalance} currency={group.currency} />
        </span>
      ) : (
        <span className="shrink-0 rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-400">
          Al día
        </span>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onTogglePin();
        }}
        aria-label={pinned ? "Quitar de anclados" : "Anclar grupo"}
        title={pinned ? "Quitar de anclados" : "Anclar grupo"}
        className={`hidden shrink-0 rounded-lg p-1.5 opacity-0 transition focus:opacity-100 group-hover:opacity-100 sm:inline-flex ${
          pinned
            ? "text-amber-400 hover:bg-amber-500/10"
            : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
        }`}
      >
        <Pin className="h-4 w-4" fill={pinned ? "currentColor" : "none"} />
      </button>
      <DropdownMenu
        className="shrink-0 sm:hidden"
        button={
          <button
            type="button"
            aria-label="Opciones del grupo"
            className="touch-manipulation rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        }
      >
        {(close) => (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTogglePin();
              close();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
          >
            <Pin className="h-4 w-4" fill={pinned ? "currentColor" : "none"} />
            {pinned ? "Desanclar grupo" : "Anclar grupo"}
          </button>
        )}
      </DropdownMenu>
    </Link>
  );
}

// Depuración temporal: imprime en consola el balance detectado por cada grupo.
function debugBalances(groups: GroupSummary[]) {
  console.log("[Divido] Saldos por grupo (myBalance):");
  for (const g of groups) {
    const kind = g.myBalance > 0.004 ? "te deben" : g.myBalance < -0.004 ? "debes" : "al día";
    console.log(`  - ${g.name} [${g.currency}]: ${g.myBalance.toFixed(2)} → ${kind}`);
  }
  const debt = groups.filter((g) => g.myBalance < -0.004).reduce((s, g) => s - g.myBalance, 0);
  const credit = groups.filter((g) => g.myBalance > 0.004).reduce((s, g) => s + g.myBalance, 0);
  console.log(
    `[Divido] Total → Te deben: ${credit.toFixed(2)} | Debes: ${debt.toFixed(2)} | Neto: ${(credit - debt).toFixed(2)}`
  );
}

// Solo permite rutas internas de la app (evita URLs externas o javascript:).
function safeNotificationUrl(url: string | undefined | null): string | null {
  if (typeof url !== "string" || url === "") return null;
  if (!url.startsWith("/") || url.startsWith("//")) return null;
  return url;
}
