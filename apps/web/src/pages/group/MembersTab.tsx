import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { track } from "../../lib/analytics";
import { Avatar, Button, CopyLinkButton, Input, Modal, VerifiedBadge } from "../../components/ui";
import type { GroupDetail, MemberInfo } from "../../lib/types";
import { similarNames } from "./utils";
export function MembersTab({
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
          <CopyLinkButton
            url={detail.inviteUrl ?? ""}
            onCopy={() => track("invitacion_copiada", { groupId: detail.group.id })}
          />
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
                      {isMe ? " · tú" : null}
                      {m.emailVerified ? " · " : null}
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

