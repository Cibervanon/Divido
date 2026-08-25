import { Money, currencySymbol } from "./ui";
import type { MemberBalance, SettlementTransfer } from "@divido/shared";

interface FinancialSummaryProps {
  groupName: string;
  groupCurrency: string;
  balances: MemberBalance[];
  transfers: SettlementTransfer[];
  myUserId: string;
  totalExpenses: number;
  totalAmount: number;
}

function formatSigned(amount: number, currency: string): string {
  const sym = currencySymbol(currency);
  const sign = amount > 0.004 ? "+" : amount < -0.004 ? "-" : "";
  const abs = Math.abs(amount);
  return `${sign}${sym}${abs.toFixed(2).replace(".", ",")}`;
}

function formatAmount(amount: number, currency: string): string {
  const sym = currencySymbol(currency);
  return `${sym}${amount.toFixed(2).replace(".", ",")}`;
}

export function FinancialSummary({
  groupName,
  groupCurrency,
  balances,
  transfers,
  myUserId,
  totalExpenses,
  totalAmount,
}: FinancialSummaryProps) {
  const myBalance = balances.find((b) => b.userId === myUserId)?.net ?? 0;
  const positive = myBalance > 0.004;
  const negative = myBalance < -0.004;
  const balanceColor = positive ? "text-emerald-400" : negative ? "text-rose-400" : "text-slate-400";

  const owedToMe = balances
    .filter((b) => b.net > 0.004 && b.userId !== myUserId)
    .reduce((sum, b) => sum + b.net, 0);
  const owedByMe = balances
    .filter((b) => b.net < -0.004 && b.userId !== myUserId)
    .reduce((sum, b) => sum + Math.abs(b.net), 0);

  const hasDebts = transfers.length > 0;

  return (
    <div className="space-y-4">
      {/* Main balance card */}
      <div className="relative rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-400">Tu balance en {groupName}</p>
            <p className="mt-2 text-3xl font-bold {balanceColor}">
              <Money amount={myBalance} currency={groupCurrency} />
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {positive ? "Te deben dinero" : negative ? "Debes dinero" : "Cuentas al día"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="rounded-xl bg-emerald-500/10 px-3 py-1.5 text-right">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Te deben</p>
              <p className="text-sm font-bold text-emerald-400">{formatAmount(owedToMe, groupCurrency)}</p>
            </div>
            <div className="rounded-xl bg-rose-500/10 px-3 py-1.5 text-right">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Debes</p>
              <p className="text-sm font-bold text-rose-400">{formatAmount(owedByMe, groupCurrency)}</p>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-slate-800/50 px-3 py-2.5 text-center">
            <p className="text-2xl font-bold text-slate-100">{totalExpenses}</p>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Gastos totales</p>
          </div>
          <div className="rounded-xl bg-slate-800/50 px-3 py-2.5 text-center">
            <p className="text-2xl font-bold text-slate-100">{formatAmount(totalAmount, groupCurrency)}</p>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Importe total</p>
          </div>
          <div className="rounded-xl bg-slate-800/50 px-3 py-2.5 text-center">
            <p className="text-2xl font-bold text-slate-100">{transfers.length}</p>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Pagos pendientes</p>
          </div>
        </div>
      </div>

      {/* Top creditors/debtors */}
      {(owedToMe > 0.004 || owedByMe > 0.004) && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="mb-3 text-sm font-bold text-slate-100">Resumen rápido</p>
          <div className="space-y-2">
            {balances
              .filter((b) => b.userId !== myUserId && b.net > 0.004)
              .sort((a, b) => b.net - a.net)
              .slice(0, 3)
              .map((b) => (
                <div key={b.userId} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{b.name}</span>
                  <span className="font-bold text-emerald-400">{formatSigned(b.net, groupCurrency)}</span>
                </div>
              ))}
            {balances
              .filter((b) => b.userId !== myUserId && b.net < -0.004)
              .sort((a, b) => a.net - b.net)
              .slice(0, 3)
              .map((b) => (
                <div key={b.userId} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{b.name}</span>
                  <span className="font-bold text-rose-400">{formatSigned(b.net, groupCurrency)}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}