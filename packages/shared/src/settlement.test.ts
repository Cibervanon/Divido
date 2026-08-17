import { describe, it, expect } from "vitest";
import { computeNetBalances, simplifyDebts, type MemberBalance } from "./settlement.js";

describe("computeNetBalances", () => {
  it("reparte equitativamente cuando no hay shares personalizados", () => {
    const result = computeNetBalances({
      memberIds: ["a", "b"],
      names: { a: "Ana", b: "Bea" },
      expenses: [{ payerId: "a", amountGroup: 100, participants: ["a", "b"] }],
      payments: [],
    });
    expect(result.find((r) => r.userId === "b")?.net).toBe(-50);
    expect(result.find((r) => r.userId === "a")?.net).toBe(50);
  });

  it("un pago reduce exactamente el saldo entre las dos partes", () => {
    const result = computeNetBalances({
      memberIds: ["a", "b"],
      names: { a: "Ana", b: "Bea" },
      expenses: [{ payerId: "a", amountGroup: 100, participants: ["a", "b"] }],
      payments: [{ fromUserId: "b", toUserId: "a", amount: 50 }],
    });
    expect(result.find((r) => r.userId === "b")?.net).toBe(0);
  });

  it("múltiples gastos y pagadores", () => {
    const result = computeNetBalances({
      memberIds: ["a", "b", "c"],
      names: { a: "Ana", b: "Bea", c: "Carlos" },
      expenses: [
        { payerId: "a", amountGroup: 60, participants: ["a", "b", "c"] },
        { payerId: "b", amountGroup: 30, participants: ["a", "b"] },
      ],
      payments: [],
    });
    const ana = result.find((r) => r.userId === "a")!.net;
    const bea = result.find((r) => r.userId === "b")!.net;
    const carlos = result.find((r) => r.userId === "c")!.net;
    // Gasto 1: Ana paga 60, 3 participantes -> cada uno debe 20. Ana pagó, así que Bea y Carlos deben 20 cada uno a Ana.
    // Gasto 2: Bea paga 30, 2 participantes -> cada uno debe 15. Bea pagó, así que Ana debe 15 a Bea.
    // Ana: +20 (de Bea) +20 (de Carlos) -15 (a Bea) = +25
    // Bea: -20 (a Ana) +15 (de Ana) = -5
    // Carlos: -20 (a Ana) = -20
    // Suma = 0 ✓
    expect(ana).toBe(25);
    expect(bea).toBe(-5);
    expect(carlos).toBe(-20);
  });

  it("gasto del bote común (payerId null) crea deudas entre participantes (comportamiento actual)", () => {
    const result = computeNetBalances({
      memberIds: ["a", "b"],
      names: { a: "Ana", b: "Bea" },
      expenses: [{ payerId: null, amountGroup: 50, participants: ["a", "b"] }],
      payments: [],
    });
    // Con payerId null, nadie recibe crédito pero todos los participantes se debitan
    // Cada uno debe 25, net = -25 cada uno (suma = -50, no balanceado)
    // Nota: esto puede ser un bug; el bote común debería trackearse aparte
    expect(result.find((r) => r.userId === "a")?.net).toBe(-25);
    expect(result.find((r) => r.userId === "b")?.net).toBe(-25);
  });

  it("gastos eliminados (deleted=true) se ignoran", () => {
    const result = computeNetBalances({
      memberIds: ["a", "b"],
      names: { a: "Ana", b: "Bea" },
      expenses: [
        { payerId: "a", amountGroup: 100, participants: ["a", "b"], deleted: true },
        { payerId: "a", amountGroup: 50, participants: ["a", "b"], deleted: false },
      ],
      payments: [],
    });
    expect(result.find((r) => r.userId === "a")?.net).toBe(25);
    expect(result.find((r) => r.userId === "b")?.net).toBe(-25);
  });

  it("shares personalizados se respetan", () => {
    const result = computeNetBalances({
      memberIds: ["a", "b", "c"],
      names: { a: "Ana", b: "Bea", c: "Carlos" },
      expenses: [
        { payerId: "a", amountGroup: 100, participants: ["a", "b", "c"], participantShares: { b: 70, c: 30 } },
      ],
      payments: [],
    });
    // Ana paga 100. Bea debe 70, Carlos 30. Ana no se debe a sí misma.
    // Ana: +70 +30 = +100
    // Bea: -70
    // Carlos: -30
    expect(result.find((r) => r.userId === "a")?.net).toBe(100);
    expect(result.find((r) => r.userId === "b")?.net).toBe(-70);
    expect(result.find((r) => r.userId === "c")?.net).toBe(-30);
  });
});

describe("simplifyDebts", () => {
  function makeBalance(overrides: Partial<MemberBalance>): MemberBalance {
    return {
      userId: "u",
      name: "User",
      net: 0,
      paidForOthers: 0,
      owesOthers: 0,
      ...overrides,
    };
  }

  it("nunca genera más de n-1 transferencias", () => {
    const balances: MemberBalance[] = [
      makeBalance({ userId: "a", name: "A", net: -30, owesOthers: 30 }),
      makeBalance({ userId: "b", name: "B", net: -20, owesOthers: 20 }),
      makeBalance({ userId: "c", name: "C", net: 50, paidForOthers: 50 }),
    ];
    const transfers = simplifyDebts(balances);
    expect(transfers.length).toBeLessThanOrEqual(balances.length - 1);
    expect(transfers.reduce((s, t) => s + t.amount, 0)).toBeCloseTo(50, 2);
  });

  it("empareja exactamente deudas y créditos iguales (coincidencia exacta)", () => {
    const balances: MemberBalance[] = [
      makeBalance({ userId: "a", name: "A", net: -25, owesOthers: 25 }),
      makeBalance({ userId: "b", name: "B", net: -25, owesOthers: 25 }),
      makeBalance({ userId: "c", name: "C", net: 25, paidForOthers: 25 }),
      makeBalance({ userId: "d", name: "D", net: 25, paidForOthers: 25 }),
    ];
    const transfers = simplifyDebts(balances);
    // Debe haber 2 transferencias exactas (a->c, b->d o similar)
    expect(transfers.length).toBe(2);
    expect(transfers.every((t) => t.amount === 25)).toBe(true);
  });

  it("caso simple: un deudor, un acreedor", () => {
    const balances: MemberBalance[] = [
      makeBalance({ userId: "a", name: "A", net: -50, owesOthers: 50 }),
      makeBalance({ userId: "b", name: "B", net: 50, paidForOthers: 50 }),
    ];
    const transfers = simplifyDebts(balances);
    expect(transfers.length).toBe(1);
    expect(transfers[0].fromUserId).toBe("a");
    expect(transfers[0].toUserId).toBe("b");
    expect(transfers[0].amount).toBe(50);
  });

  it("redondeo: suma de nets cercana a cero se normaliza", () => {
    // 10.01 / 3 = 3.33666... redondeado a 3.34, 3.34, 3.33 = 10.01
    // nets: -3.34, -3.33, +6.67 = 0.00 (ya redondeado)
    // Pero si hay residuo, simplifyDebts lo normaliza al mayor
    const balances: MemberBalance[] = [
      makeBalance({ userId: "a", name: "A", net: -3.34, owesOthers: 3.34 }),
      makeBalance({ userId: "b", name: "B", net: -3.33, owesOthers: 3.33 }),
      makeBalance({ userId: "c", name: "C", net: 6.67, paidForOthers: 6.67 }),
    ];
    const transfers = simplifyDebts(balances);
    const sum = transfers.reduce((s, t) => s + t.amount, 0);
    expect(sum).toBeCloseTo(6.67, 2);
  });

  it("múltiples deudores y acreedores - voraz", () => {
    const balances: MemberBalance[] = [
      makeBalance({ userId: "a", name: "A", net: -40, owesOthers: 40 }),
      makeBalance({ userId: "b", name: "B", net: -30, owesOthers: 30 }),
      makeBalance({ userId: "c", name: "C", net: -20, owesOthers: 20 }),
      makeBalance({ userId: "d", name: "D", net: 50, paidForOthers: 50 }),
      makeBalance({ userId: "e", name: "E", net: 40, paidForOthers: 40 }),
    ];
    const transfers = simplifyDebts(balances);
    expect(transfers.length).toBeLessThanOrEqual(balances.length - 1);
    const total = transfers.reduce((s, t) => s + t.amount, 0);
    expect(total).toBeCloseTo(90, 2);
  });

  it("ignora balances con net cero (EPS)", () => {
    const balances: MemberBalance[] = [
      makeBalance({ userId: "a", name: "A", net: -0.001, owesOthers: 0.001 }),
      makeBalance({ userId: "b", name: "B", net: 0.001, paidForOthers: 0.001 }),
      makeBalance({ userId: "c", name: "C", net: 50, paidForOthers: 50 }),
      makeBalance({ userId: "d", name: "D", net: -50, owesOthers: 50 }),
    ];
    const transfers = simplifyDebts(balances);
    expect(transfers.length).toBe(1);
    expect(transfers[0].amount).toBe(50);
  });
});