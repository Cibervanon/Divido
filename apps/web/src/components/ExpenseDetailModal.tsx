import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import {
  Avatar,
  Button,
  Input,
  Modal,
  Money,
  VerifiedBadge,
  GhostBadge,
  currencySymbol,
} from "./ui";
import type { ExpenseDto, ExpenseCommentDto, MemberInfo } from "../lib/types";
import { fmtDate } from "../pages/group/utils";
import { CATEGORIES } from "../constants/categories";
import { compressImageToJpeg, dataUrlToBlob, blobToDataUrl, RECEIPT_MAX_BYTES, RECEIPT_MAX_DIMENSION, RECEIPT_JPEG_QUALITY } from "../lib/compressImage";

interface ExpenseDetailModalProps {
  open: boolean;
  onClose: () => void;
  expense: ExpenseDto | null;
  groupId: string;
  groupCurrency: string;
  members: MemberInfo[];
  myUserId: string;
  onEdit: (e: ExpenseDto) => void;
  onDelete: (e: ExpenseDto) => void;
  onChanged: () => void;
}

function categoryLabel(key?: string): string {
  if (!key) return "General";
  const cfg = (CATEGORIES as Record<string, { label: string } | undefined>)[key];
  return cfg?.label ?? key.charAt(0).toUpperCase() + key.slice(1);
}

function formatAmount(amount: number, currency: string): string {
  const sym = currencySymbol(currency);
  return `${sym}${amount.toFixed(2).replace(".", ",")}`;
}

export function ExpenseDetailModal({
  open,
  onClose,
  expense,
  groupId,
  groupCurrency,
  members,
  myUserId,
  onEdit,
  onDelete,
  onChanged,
}: ExpenseDetailModalProps) {
  const [comments, setComments] = useState<ExpenseCommentDto[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [viewReceipt, setViewReceipt] = useState<string | null>(null);
  const [receiptNotice, setReceiptNotice] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");

  useEffect(() => {
    if (!receiptNotice) return;
    const t = setTimeout(() => setReceiptNotice(""), 3500);
    return () => clearTimeout(t);
  }, [receiptNotice]);

  useEffect(() => {
    if (expense) {
      setComments(expense.comments ?? []);
    }
  }, [expense]);

  async function openReceipt(expenseId: string, fallback: string | null) {
    try {
      const r = await api.get<{ url: string | null }>(`/expenses/${expenseId}/receipt-url`);
      if (r.url) {
        setViewReceipt(r.url);
        return;
      }
      setReceiptNotice("El tique no está disponible ahora mismo, inténtalo en un momento");
    } catch (err) {
      if (fallback && fallback.startsWith("data:")) {
        setViewReceipt(fallback);
        return;
      }
      setReceiptNotice(
        err instanceof ApiError && err.status === 404
          ? "Este gasto no tiene tique adjunto"
          : "No se pudo abrir el tique"
      );
    }
  }

  async function sendComment() {
    const body = text.trim();
    if (!body || !expense) return;
    setError("");
    setSending(true);
    try {
      const res = await api.post<ExpenseCommentDto>(
        `/groups/${groupId}/expenses/${expense.id}/comments`,
        { body }
      );
      setComments((prev) => [...prev, res]);
      setText("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo enviar el comentario");
    } finally {
      setSending(false);
    }
  }

  async function removeComment(id: string) {
    if (!expense) return;
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

  function startEditingComment(c: ExpenseCommentDto) {
    setEditingCommentId(c.id);
    setEditCommentText(c.body);
  }

  async function saveCommentEdit(id: string) {
    if (!expense) return;
    const body = editCommentText.trim();
    if (!body) return;
    try {
      await api.patch(`/expenses/${expense.id}/comments/${id}`, { body });
      setComments((prev) => prev.map((c) => (c.id === id ? { ...c, body } : c)));
      setEditingCommentId(null);
      setEditCommentText("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo editar el comentario");
    }
  }

  function cancelCommentEdit() {
    setEditingCommentId(null);
    setEditCommentText("");
  }

  function getMemberName(userId: string): string {
    return members.find((m) => m.userId === userId)?.name ?? "Desconocido";
  }

  function isMyComment(authorId: string): boolean {
    return authorId === myUserId;
  }

  const isPaidFromPot = expense?.paidFromPot ?? false;
  const isDeleted = expense?.deleted ?? false;

  const payer = expense ? members.find((m) => m.userId === expense.payerId) : null;

  const participantNames = expense
    ? expense.participants.map(getMemberName).join(", ")
    : "";

  const shareText = expense?.shares
    ? "reparto personalizado"
    : `cada uno ${formatAmount(expense?.share ?? 0, expense?.currency ?? groupCurrency)}`;

  if (!open || !expense) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={expense.description}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          <Button variant="secondary" onClick={() => { onEdit(expense); onClose(); }}>
            Editar
          </Button>
          <Button variant="danger" onClick={() => { onDelete(expense); onClose(); }}>
            Eliminar
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Header with key info */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-semibold text-indigo-300">
              {categoryLabel(expense.category)}
            </span>
            {isPaidFromPot && (
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                Bote común
              </span>
            )}
            {isDeleted && (
              <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-xs font-semibold text-rose-400">
                Eliminado
              </span>
            )}
          </div>
          <div className="flex-1" />
          <span className="text-xs text-slate-500">{fmtDate(expense.createdAt)}</span>
        </div>

        {/* Main info grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Importe</p>
            <p className="mt-1 text-2xl font-bold text-slate-100">
              <Money amount={expense.amount} currency={expense.currency} />
            </p>
            {expense.currency !== groupCurrency && expense.exchangeRate !== 1 ? (
              <p className="mt-1 text-sm text-slate-500">
                ≈ <Money amount={expense.amountGroup} currency={groupCurrency} />
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Reparto</p>
            <p className="mt-1 text-sm text-slate-300">{shareText}</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Pagado por</p>
            <p className="mt-1 text-sm text-slate-300">
              {payer ? (
                <>
                  <Avatar name={payer.name} size="sm" />
                  <span className="ml-1.5">{payer.name}</span>
                  {payer.isGhost && <GhostBadge showLabel={false} />}
                </>
              ) : (
                "—"
              )}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Participantes</p>
            <p className="mt-1 text-sm text-slate-300">{participantNames || "—"}</p>
          </div>
        </div>

        {/* Receipt */}
        {expense.receiptUrl && !isPaidFromPot ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Comprobante</p>
            <button
              type="button"
              onClick={() => openReceipt(expense.id, expense.receiptUrl)}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-indigo-300 transition hover:bg-slate-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Ver tique
            </button>
          </div>
        ) : null}

        {/* Comments section */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              Comentarios ({comments.length})
            </p>
          </div>

          {comments.length > 0 ? (
            <div className="mt-3 space-y-2 max-h-60 overflow-auto">
              {comments.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-xl p-3 ${editingCommentId === c.id ? "bg-slate-800" : "bg-slate-800/60"}`}
                >
                  {editingCommentId === c.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editCommentText}
                        onChange={(e) => setEditCommentText(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none resize-none placeholder:text-slate-600 focus:border-indigo-500"
                        placeholder="Edita tu comentario..."
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={cancelCommentEdit}>
                          Cancelar
                        </Button>
                        <Button size="sm" onClick={() => saveCommentEdit(c.id)} loading={sending}>
                          Guardar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="flex items-center gap-1 text-xs font-semibold text-slate-300">
                          <span className="truncate">{c.authorName}</span>
                          {c.authorVerified && <VerifiedBadge size="xs" />}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-500">{fmtDate(c.createdAt)}</span>
                          {isMyComment(c.authorId) ? (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditingComment(c)}
                                className="text-[10px] font-semibold text-slate-500 transition hover:text-indigo-400"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => removeComment(c.id)}
                                disabled={deletingId === c.id}
                                className="text-[10px] font-semibold text-slate-500 transition hover:text-rose-400"
                              >
                                {deletingId === c.id ? "..." : "Eliminar"}
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <p className="whitespace-pre-wrap break-words text-xs text-slate-300">{c.body}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-slate-500 text-center py-4">Sin comentarios todavía.</p>
          )}

          <div className="mt-3 flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendComment();
                }
              }}
              placeholder="Añade un comentario..."
              maxLength={500}
              className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-500"
            />
            <Button variant="secondary" className="!px-3 !py-2 text-xs" onClick={() => void sendComment()} loading={sending}>
              Enviar
            </Button>
          </div>
          {error ? <p className="mt-2 text-[11px] font-medium text-rose-400">{error}</p> : null}
        </div>

        {/* Receipt modal */}
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

        {receiptNotice ? (
          <div
            role="status"
            className="fixed inset-x-0 bottom-24 z-[60] mx-auto w-fit max-w-[90vw] rounded-full bg-slate-800 px-4 py-2 text-xs font-medium text-slate-200 shadow-lg"
          >
            {receiptNotice}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}