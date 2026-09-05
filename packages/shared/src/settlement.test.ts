import { describe, it, expect } from "vitest";
import { computeNetBalances, round2, simplifyDebts, type MemberBalance } from "./settlement.js";

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

  it("desfase grande sin deudores: no inventa pagos fantasma", () => {
    const balances: MemberBalance[] = [
      makeBalance({ userId: "a", name: "A", net: 10, paidForOthers: 10 }),
      makeBalance({ userId: "b", name: "B", net: 20, paidForOthers: 20 }),
      makeBalance({ userId: "c", name: "C", net: 30, paidForOthers: 30 }),
    ];
    const transfers = simplifyDebts(balances);
    expect(transfers).toEqual([]);
  });

  it("desfase grande sin acreedores: no inventa pagos fantasma", () => {
    const balances: MemberBalance[] = [
      makeBalance({ userId: "a", name: "A", net: -10, owesOthers: 10 }),
      makeBalance({ userId: "b", name: "B", net: -20, owesOthers: 20 }),
      makeBalance({ userId: "c", name: "C", net: -30, owesOthers: 30 }),
    ];
    const transfers = simplifyDebts(balances);
    expect(transfers).toEqual([]);
  });

  it("residuo de redondeo dentro del umbral se normaliza y todos cobran exacto", () => {
    // Suma = -70.1 -30.05 +100.16 = 0.01 (residuo plausible: <= 0.005*n + 0.001).
    // Al normalizar, el crédito de mayor magnitud baja a 100.15 para casar con
    // las deudas (70.1 + 30.05 = 100.15) y así todo deudor paga completo.
    const balances: MemberBalance[] = [
      makeBalance({ userId: "a", name: "A", net: -70.1, owesOthers: 70.1 }),
      makeBalance({ userId: "b", name: "B", net: -30.05, owesOthers: 30.05 }),
      makeBalance({ userId: "c", name: "C", net: 100.16, paidForOthers: 100.16 }),
    ];
    const transfers = simplifyDebts(balances);
    const received = transfers.reduce((s, t) => s + t.amount, 0);
    expect(received).toBeCloseTo(100.15, 2);
  });

  describe("propiedades (escenarios aleatorios deterministas)", () => {
    // RNG con semilla fija: mismos escenarios en cada ejecución, sin dependencias.
    function mulberry32(seed: number) {
      return () => {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    /** Parte `total` en `parts` trozos positivos cuya suma es exactamente `total`. */
    function splitAmount(total: number, parts: number, rand: () => number): number[] {
      const out: number[] = [];
      let rem = total;
      for (let i = 0; i < parts; i++) {
        const isLast = i === parts - 1;
        const amt = isLast ? round2(rem) : round2(Math.min(rem * (0.15 + 0.85 * rand()), rem));
        out.push(amt);
        if (!isLast) rem = round2(rem - amt);
        else break;
      }
      return out;
    }

    function randomScenario(rand: () => number): MemberBalance[] {
      const n = 2 + Math.floor(rand() * 8); // entre 2 y 9 personas
      const debtorsCount = 1 + Math.floor(rand() * (n - 1)); // al menos 1 deudor y 1 acreedor
      const creditorsCount = n - debtorsCount;
      const total = round2(10 + rand() * 990);
      const debts = splitAmount(total, debtorsCount, rand);
      const credits = splitAmount(total, creditorsCount, rand);

      const ids = Array.from({ length: n }, (_, i) => `u${i}`).sort(() => rand() - 0.5);
      const balances: MemberBalance[] = [];
      debts.forEach((amount, i) =>
        balances.push(makeBalance({ userId: ids[i], name: ids[i], net: -amount, owesOthers: amount }))
      );
      credits.forEach((amount, j) =>
        balances.push(
          makeBalance({
            userId: ids[debtorsCount + j],
            name: ids[debtorsCount + j],
            net: amount,
            paidForOthers: amount,
          })
        )
      );
      return balances;
    }

    it("en 300 escenarios aleatorios: todo deudor paga su deuda completa", () => {
      const rand = mulberry32(42);
      for (let s = 0; s < 300; s++) {
        const balances = randomScenario(rand).map((b) => ({ ...b }));
        const transfers = simplifyDebts(balances);

        const pagado = new Map<string, number>();
        const recibido = new Map<string, number>();
        for (const t of transfers) {
          expect(t.amount).toBeGreaterThan(0);
          pagado.set(t.fromUserId, (pagado.get(t.fromUserId) ?? 0) + t.amount);
          recibido.set(t.toUserId, (recibido.get(t.toUserId) ?? 0) + t.amount);
        }
        for (const b of balances) {
          expect(pagado.get(b.userId) ?? 0).toBeCloseTo(Math.max(-b.net, 0), 2);
          expect(recibido.get(b.userId) ?? 0).toBeCloseTo(Math.max(b.net, 0), 2);
        }
      }
    });

    it("en 300 escenarios aleatorios: nunca más de n-1 transferencias", () => {
      const rand = mulberry32(1337);
      for (let s = 0; s < 300; s++) {
        const balances = randomScenario(rand);
        const transfers = simplifyDebts(balances);
        expect(transfers.length).toBeLessThanOrEqual(Math.max(balances.length - 1, 0));
      }
    });

    it("computeNetBalances suma casi cero en cualquier escenario (residuo de redondeo acotado)", () => {
      const rand = mulberry32(777);
      for (let s = 0; s < 200; s++) {
        const n = 2 + Math.floor(rand() * 6);
        const memberIds = Array.from({ length: n }, (_, i) => `u${i}`);
        const names = Object.fromEntries(memberIds.map((id, i) => [id, `P${i}`]));
        const expenseCount = Math.floor(rand() * 10);
        const expenses = Array.from({ length: expenseCount }, () => ({
          payerId: memberIds[Math.floor(rand() * n)],
          amountGroup: round2(rand() * 500),
          participants: memberIds.filter(() => rand() > 0.3),
        })).filter((e) => e.participants.length > 0 && e.amountGroup > 0);
        const payments = Array.from({ length: Math.floor(rand() * 4) }, () => ({
          fromUserId: memberIds[Math.floor(rand() * n)],
          toUserId: memberIds[Math.floor(rand() * n)],
          amount: round2(rand() * 100),
        }));
        const result = computeNetBalances({ memberIds, names, expenses, payments });
        const sum = result.reduce((acc, b) => acc + b.net, 0);
        // El redondeo individual por persona introduce hasta ~0,005 por miembro.
        expect(Math.abs(sum)).toBeLessThanOrEqual(0.005 * n + 0.001);
      }
    });
  });
});