import { useMemo } from "react";
import { Money } from "../../components/ui";
import type { GroupDetail, ExpenseDto } from "../../lib/types";
import type { SettlementTransfer } from "@divido/shared";

interface ExportSummaryProps {
  group: GroupDetail["group"];
  expenses: ExpenseDto[];
  balances: { transfers: SettlementTransfer[] };
  currency: string;
}

export function ExportSummary({ group, expenses, balances, currency }: ExportSummaryProps) {
  const sortedExpenses = useMemo(
    () => [...expenses].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [expenses]
  );

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch {
      return iso;
    }
  };

  return (
    <div className="print-only bg-white text-black p-8 max-w-3xl mx-auto">
      <header className="mb-6 border-b border-slate-300 pb-4">
        <h1 className="text-2xl font-bold text-slate-900">Resumen de {group.name}</h1>
        <p className="text-sm text-slate-600 mt-1">
          Exportado el {new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })}
        </p>
      </header>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Gastos ({expenses.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="px-3 py-2 text-left border-b border-slate-300 font-semibold">Fecha</th>
                <th className="px-3 py-2 text-left border-b border-slate-300 font-semibold">Descripción</th>
                <th className="px-3 py-2 text-left border-b border-slate-300 font-semibold">Categoría</th>
                <th className="px-3 py-2 text-left border-b border-slate-300 font-semibold">Pagador</th>
                <th className="px-3 py-2 text-right border-b border-slate-300 font-semibold">Importe</th>
              </tr>
            </thead>
            <tbody>
              {sortedExpenses.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 border-b border-slate-200">{formatDate(e.createdAt)}</td>
                  <td className="px-3 py-2 border-b border-slate-200">{e.description}</td>
                  <td className="px-3 py-2 border-b border-slate-200 capitalize">{e.category}</td>
                  <td className="px-3 py-2 border-b border-slate-200">{e.payerName}</td>
                  <td className="px-3 py-2 border-b border-slate-200 text-right font-mono">
                    <Money amount={e.amountGroup} currency={currency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Liquidación final</h2>
        {balances.transfers.length === 0 ? (
          <p className="text-slate-600 text-center py-4">¡Cuentas al día! Nadie debe dinero a nadie.</p>
        ) : (
          <div className="space-y-2">
            {balances.transfers.map((t, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm border border-slate-200">
                <span className="font-medium text-slate-700">{t.fromName}</span>
                <span className="mx-2 text-slate-400">→</span>
                <span className="font-medium text-slate-700">{t.toName}</span>
                <span className="ml-4 font-bold text-emerald-600">
                  <Money amount={t.amount} currency={currency} />
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}