import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { currencySymbol } from "../../components/ui";
import { CATEGORIES } from "../../constants/categories";
import type { GroupDetail, ExpenseDto, MemberBalance } from "../../lib/types";
import type { SettlementTransfer } from "@divido/shared";

interface ExportSummaryProps {
  group: GroupDetail["group"];
  expenses: ExpenseDto[];
  transfers: SettlementTransfer[];
  memberBalances: MemberBalance[];
  currency: string;
  onClose: () => void;
}

function categoryLabel(key: string): string {
  const cfg = (CATEGORIES as Record<string, { label: string } | undefined>)[key];
  return cfg?.label ?? key.charAt(0).toUpperCase() + key.slice(1);
}

export function ExportSummary({ group, expenses, transfers, memberBalances, currency, onClose }: ExportSummaryProps) {
  const sym = currencySymbol(currency);

  const fmt = (n: number) => `${sym}${n.toFixed(2)}`;

  const sortedExpenses = useMemo(
    () => [...expenses].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [expenses]
  );

  const total = useMemo(() => sortedExpenses.reduce((acc, e) => acc + (e.amountGroup ?? 0), 0), [sortedExpenses]);

  const now = useMemo(() => new Date(), []);
  const fechaGen = now.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  const horaGen = now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch {
      return iso;
    }
  };

  // Abre el diálogo nativo de impresión automáticamente al montar
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);

  const situationFor = (net: number) =>
    net < -0.004 ? "Debe dinero" : net > 0.004 ? "Saldo a favor" : "Al día";

  const doc = (
    <div className="print-doc mx-auto my-6 w-[210mm] max-w-[95vw] bg-white p-10 text-slate-900 shadow-2xl">
      {/* Cabecera oficial */}
      <header className="avoid-break border-b-2 border-slate-900 pb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
          Informe de gastos compartidos
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">{group.name}</h1>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 text-sm text-slate-600">
          <span>
            Generado el {fechaGen} a las {horaGen}
          </span>
          <span>
            {sortedExpenses.length} gasto{sortedExpenses.length !== 1 ? "s" : ""}{" · "}
            <strong className="text-lg font-bold text-slate-900">Total: {fmt(total)}</strong>
          </span>
        </div>
      </header>

      {/* Integrantes y balances */}
      <section className="avoid-break mt-8">
        <h2 className="mb-3 border-b border-slate-300 pb-1 text-sm font-bold uppercase tracking-wider text-slate-700">
          1. Integrantes y balances
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-400 bg-slate-100 text-left">
              <th className="px-3 py-2 font-semibold">Miembro</th>
              <th className="px-3 py-2 font-semibold">Situación</th>
              <th className="px-3 py-2 text-right font-semibold">Importe</th>
            </tr>
          </thead>
          <tbody>
            {[...memberBalances]
              .sort((a, b) => a.net - b.net)
              .map((b) => (
                <tr key={b.userId} className="border-b border-slate-200">
                  <td className="px-3 py-2">
                    {b.name}
                    {b.isGhost ? <span className="ml-1.5 text-xs text-slate-500">(sin cuenta)</span> : null}
                  </td>
                  <td className="px-3 py-2">{situationFor(b.net)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(b.net)}</td>
                </tr>
              ))}
            {memberBalances.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-slate-500">
                  Sin miembros registrados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <h3 className="mt-5 mb-2 text-sm font-bold text-slate-700">Liquidación sugerida</h3>
        {transfers.length === 0 ? (
          <p className="text-sm text-slate-600">Cuentas al día: nadie debe dinero a nadie.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {transfers.map((t, i) => (
              <li key={i} className="flex items-baseline justify-between rounded bg-slate-50 px-3 py-1.5">
                <span>
                  <strong>{t.fromName}</strong> paga a <strong>{t.toName}</strong>
                </span>
                <span className="font-mono tabular-nums">{fmt(t.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Desglose de gastos */}
      <section className="mt-8">
        <h2 className="mb-3 border-b border-slate-300 pb-1 text-sm font-bold uppercase tracking-wider text-slate-700">
          2. Desglose de gastos
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-400 bg-slate-100 text-left">
              <th className="px-3 py-2 font-semibold">Fecha</th>
              <th className="px-3 py-2 font-semibold">Concepto</th>
              <th className="px-3 py-2 font-semibold">Categoría</th>
              <th className="px-3 py-2 font-semibold">Pagador</th>
              <th className="px-3 py-2 text-right font-semibold">Importe</th>
            </tr>
          </thead>
          <tbody>
            {sortedExpenses.map((e) => (
              <tr key={e.id} className="border-b border-slate-200">
                <td className="whitespace-nowrap px-3 py-1.5">{fmtDate(e.createdAt)}</td>
                <td className="px-3 py-1.5">{e.description}</td>
                <td className="px-3 py-1.5">{categoryLabel(e.category)}</td>
                <td className="px-3 py-1.5">{e.payerName}</td>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums">{fmt(e.amountGroup ?? 0)}</td>
              </tr>
            ))}
            {sortedExpenses.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-slate-500">
                  Sin gastos registrados.
                </td>
              </tr>
            ) : null}
          </tbody>
          {sortedExpenses.length > 0 ? (
            <tfoot>
              <tr className="border-t-2 border-slate-900 font-bold">
                <td colSpan={4} className="px-3 py-2 text-right">
                  Total
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(total)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </section>

      <footer className="mt-10 border-t border-slate-300 pt-3 text-center text-xs text-slate-500">
        Documento generado automáticamente por Divido{" · "}{group.currency}
      </footer>
    </div>
  );

  const preview = (
    /* Vista previa en pantalla (oculta al imprimir) */
    <div className="fixed inset-0 z-[100] overflow-auto bg-black/70 print:hidden">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-4 py-3">
        <p className="text-sm font-semibold text-slate-200">Vista previa de impresión</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-500"
          >
            Imprimir / Guardar PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700"
          >
            Cerrar
          </button>
        </div>
      </div>
      {doc}
    </div>
  );

  return (
    <>
      {createPortal(preview, document.body)}
      {createPortal(doc, document.getElementById("print-root") ?? document.body)}
    </>
  );
}
