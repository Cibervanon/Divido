import { describe, expect, it } from "vitest";
import { simplifyDebts } from "./debtSimplifier";

describe("simplifyDebts", () => {
  it("no duplica deudas: la suma de las transferencias coincide con la de los saldos y no la supera", () => {
    const balances = [
      { userId: "u1", name: "A", net: 130.39 },
      { userId: "u2", name: "B", net: 96.89 },
      { userId: "u3", name: "C", net: -43.08 },
      { userId: "u4", name: "D", net: -70.87 },
      { userId: "u5", name: "E", net: -113.32 },
    ];

    const result = simplifyDebts([], balances);

    const sumTransfers = result.transfers.reduce((s, t) => s + t.amount, 0);
    const totalDebt = balances.reduce((s, b) => s + Math.max(0, -b.net), 0);
    const totalCredit = balances.reduce((s, b) => s + Math.max(0, b.net), 0);

    // No puede ser mayor que la suma de las deudas ni que la del crédito.
    expect(sumTransfers).toBeLessThanOrEqual(totalDebt + 0.011);
    expect(sumTransfers).toBeLessThanOrEqual(totalCredit + 0.011);
    // Coincide con las deudas salvo el céntimo de residuo de redondeo.
    expect(sumTransfers).toBeCloseTo(totalDebt, 1);

    const positiveIds = new Set(balances.filter((b) => b.net > 0.005).map((b) => b.userId));
    const receivedBy = new Set(result.transfers.map((t) => t.toUserId));
    for (const id of positiveIds) {
      expect(receivedBy.has(id)).toBe(true);
    }
  });

  it("empareja deudores y acreedores sin sobrepasar ningún saldo individual", () => {
    const balances = [
      { userId: "u1", name: "A", net: 130.39 },
      { userId: "u2", name: "B", net: 96.89 },
      { userId: "u3", name: "C", net: -43.08 },
      { userId: "u4", name: "D", net: -70.87 },
      { userId: "u5", name: "E", net: -113.32 },
    ];

    const result = simplifyDebts([], balances);

    const paidBy = new Map<string, number>();
    const receivedBy = new Map<string, number>();
    for (const t of result.transfers) {
      paidBy.set(t.fromUserId, (paidBy.get(t.fromUserId) ?? 0) + t.amount);
      receivedBy.set(t.toUserId, (receivedBy.get(t.toUserId) ?? 0) + t.amount);
    }

    for (const b of balances) {
      const paid = paidBy.get(b.userId) ?? 0;
      const received = receivedBy.get(b.userId) ?? 0;
      if (b.net > 0) {
        expect(received).toBeLessThanOrEqual(b.net + 0.01);
      } else if (b.net < 0) {
        expect(paid).toBeLessThanOrEqual(-b.net + 0.01);
      }
    }
  });
});