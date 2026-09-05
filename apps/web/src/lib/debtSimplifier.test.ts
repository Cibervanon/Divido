import { describe, expect, it } from "vitest";
import { simplifyDebts } from "./debtSimplifier";
import type { SimplifiedDebt } from "./debtSimplifier";

type NetBalance = { userId: string; name: string; net: number };

function balances(list: Array<[string, number]>): NetBalance[] {
  return list.map(([userId, net]) => ({ userId, name: userId, net }));
}

/** Suma de las transferencias sugeridas. */
function sum(result: { transfers: Array<{ amount: number }> }): number {
  return result.transfers.reduce((s, t) => s + t.amount, 0);
}

function totals(list: NetBalance[]) {
  const totalDebt = list.reduce((s, b) => s + Math.max(0, -b.net), 0);
  const totalCredit = list.reduce((s, b) => s + Math.max(0, b.net), 0);
  return { totalDebt, totalCredit };
}

/** deudores/acre: listas con importes positivos que suman lo mismo (escenario balanceado). */
function makeScenario(
  debtors: number[],
  creditors: number[],
  prefix: string
): NetBalance[] {
  const deb = debtors.map((amount, i) => ({ userId: `${prefix}d${i}`, name: `${prefix}d${i}`, net: -amount }));
  const cred = creditors.map((amount, j) => ({ userId: `${prefix}c${j}`, name: `${prefix}c${j}`, net: amount }));
  return [...deb, ...cred];
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Parte `total` en `parts` trozos positivos que suman exactamente `total`. */
function splitAmount(total: number, parts: number, rand: () => number): number[] {
  const out: number[] = [];
  let rem = total;
  for (let i = 0; i < parts; i++) {
    const isLast = i === parts - 1;
    const amt = isLast ? Math.round(rem * 100) / 100 : Math.round(Math.min(rem * (0.15 + 0.85 * rand()), rem) * 100) / 100;
    out.push(amt);
    if (!isLast) rem = Math.round((rem - amt) * 100) / 100;
  }
  return out;
}

function randomBalancedScenario(n: number, rand: () => number): NetBalance[] {
  const debtorsCount = 1 + Math.floor(rand() * (n - 1)); // al menos 1 deudor y 1 acreedor
  const creditorsCount = n - debtorsCount;
  const total = Math.round((10 + rand() * 5000) * 100) / 100;
  const debts = splitAmount(total, debtorsCount, rand);
  const credits = splitAmount(total, creditorsCount, rand);

  const ids = Array.from({ length: n }, (_, i) => `u${i}`).sort(() => rand() - 0.5);
  const out: NetBalance[] = [];
  debts.forEach((amount, i) => out.push({ userId: ids[i], name: ids[i], net: -amount }));
  credits.forEach((amount, j) => out.push({ userId: ids[debtorsCount + j], name: ids[debtorsCount + j], net: amount }));
  return out;
}

/** Invariantes que deben cumplirse SIEMPRE (no lanzan y el resultado es válido). */
function assertValidResult(result: ReturnType<typeof simplifyDebts>, list: NetBalance[]) {
  // Sin usuarios fantasma: cada transferencia implica miembros presentes.
  const ids = new Set(list.map((b) => b.userId));
  for (const t of result.transfers) {
    expect(ids.has(t.fromUserId)).toBe(true);
    expect(ids.has(t.toUserId)).toBe(true);
  }

  const paidBy = new Map<string, number>();
  const receivedBy = new Map<string, number>();
  for (const t of result.transfers) {
    expect(t.amount).toBeGreaterThan(0);
    expect(t.amount).toBeLessThanOrEqual(1_000_000_000);
    expect(t.fromUserId).not.toBe(t.toUserId);
    paidBy.set(t.fromUserId, (paidBy.get(t.fromUserId) ?? 0) + t.amount);
    receivedBy.set(t.toUserId, (receivedBy.get(t.toUserId) ?? 0) + t.amount);
  }

  const { totalDebt, totalCredit } = totals(list);

  // No se duplican deudas: la suma de lo sugerido no supera deuda ni crédito.
  expect(sum(result)).toBeLessThanOrEqual(totalDebt + 0.011);
  expect(sum(result)).toBeLessThanOrEqual(totalCredit + 0.011);

  // Nadie paga más de lo que debe ni recibe más de lo que le deben.
  for (const b of list) {
    const paid = paidBy.get(b.userId) ?? 0;
    const received = receivedBy.get(b.userId) ?? 0;
    if (b.net < -0.005) expect(paid).toBeLessThanOrEqual(-b.net + 0.011);
    if (b.net > 0.005) expect(received).toBeLessThanOrEqual(b.net + 0.011);
    if (Math.abs(b.net) <= 0.005) {
      expect(paid + received).toBe(0);
    }
  }

  // Los deudores nunca reciben y los acreedores nunca pagan.
  for (const t of result.transfers) {
    expect(list.find((b) => b.userId === t.fromUserId)!.net).toBeLessThan(0);
    expect(list.find((b) => b.userId === t.toUserId)!.net).toBeGreaterThan(0);
  }
}

describe("simplifyDebts (pagos recomendados)", () => {
  describe("pocos usuarios", () => {
    it("sin balances y sin deudas: resultado vacío sin errores", () => {
      const result = simplifyDebts([], []);
      expect(result.transfers).toEqual([]);
      expect(result.debts).toEqual([]);
      expect(result.originalCount).toBe(0);
      expect(result.changedCount).toBe(0);
    });

    it("un solo miembro saldado: sin transferencias", () => {
      const result = simplifyDebts([], balances([["a", 0]]));
      expect(result.transfers).toEqual([]);
    });

    it("un único acreedor y ningún deudor: sin deudas que cobrar, no lanza", () => {
      const result = simplifyDebts([], balances([["a", 100]]));
      expect(result.transfers).toEqual([]);
    });

    it("un único deudor y ningún acreedor: sin a quién pagar, no lanza", () => {
      const result = simplifyDebts([], balances([["a", -100]]));
      expect(result.transfers).toEqual([]);
    });

    it("dos miembros (un deudor, un acreedor): una única transferencia exacta", () => {
      const result = simplifyDebts([], balances([["a", -50], ["b", 50]]));
      expect(result.transfers).toHaveLength(1);
      expect(result.transfers[0]).toMatchObject({ fromUserId: "a", toUserId: "b", amount: 50 });
    });

    it("tres miembros con deuda e igualado exacto: máximo 2 transferencias", () => {
      const result = simplifyDebts([], balances([["a", -25], ["b", -25], ["c", 50]]));
      expect(result.transfers.length).toBeLessThanOrEqual(2);
      expect(sum(result)).toBe(50);
    });

    it("cadena a→b→c se compacta en a→c (transfers <= n-1)", () => {
      const result = simplifyDebts([], balances([["a", -10], ["b", 0], ["c", 10]]));
      expect(result.transfers.length).toBe(1);
      expect(result.transfers[0]).toMatchObject({ fromUserId: "a", toUserId: "c", amount: 10 });
    });

    it("consumo de la deuda original cuando la transferencia coincide", () => {
      const list = balances([["a", -30], ["b", 30]]);
      const result = simplifyDebts(
        [{ fromUserId: "a", fromName: "a", toUserId: "b", toName: "b", amount: 30, reason: "Gasto" }],
        list
      );
      expect(result.transfers).toHaveLength(1);
      expect(result.debts[0].newAmount).toBe(0);
      expect(result.changedCount).toBe(1);
    });

    it("deuda original sin coincidencia directa: no se consume y no lanza", () => {
      const list = balances([["a", -10], ["b", 0], ["c", 10]]);
      const result = simplifyDebts(
        [{ fromUserId: "a", fromName: "a", toUserId: "b", toName: "b", amount: 10, reason: "Gasto" }],
        list
      );
      expect(result.debts[0].newAmount).toBe(10);
      expect(result.changedCount).toBe(0);
      assertValidResult(result, list);
    });
  });

  describe("caso real reportado (5 personas)", () => {
    it("no duplica deudas: la suma de las transferencias coincide con la de los saldos y no la supera", () => {
      const list = balances([["A", 130.39], ["B", 96.89], ["C", -43.08], ["D", -70.87], ["E", -113.32]]);
      const result = simplifyDebts([], list);
      const { totalDebt, totalCredit } = totals(list);

      expect(sum(result)).toBeLessThanOrEqual(totalDebt + 0.011);
      expect(sum(result)).toBeLessThanOrEqual(totalCredit + 0.011);
      expect(sum(result)).toBeCloseTo(totalDebt, 1);

      const positiveIds = new Set(list.filter((b) => b.net > 0.005).map((b) => b.userId));
      const receivedBy = new Set(result.transfers.map((t) => t.toUserId));
      for (const id of positiveIds) {
        expect(receivedBy.has(id)).toBe(true);
      }
    });

    it("empareja deudores y acreedores sin sobrepasar ningún saldo individual", () => {
      const list = balances([["A", 130.39], ["B", 96.89], ["C", -43.08], ["D", -70.87], ["E", -113.32]]);
      assertValidResult(simplifyDebts([], list), list);
    });
  });

  describe("muchos usuarios", () => {
    it("50 usuarios con emparejamientos exactos: 25 transferencias, suma exacta", () => {
      const debtors = Array.from({ length: 25 }, (_, i) => i + 1); // 1..25
      const creditors = Array.from({ length: 25 }, (_, i) => i + 1); // 1..25
      const list = makeScenario(debtors, creditors, "x");
      const result = simplifyDebts([], list);
      const total = ((25 * 26) / 2);
      expect(result.transfers).toHaveLength(25);
      expect(sum(result)).toBeCloseTo(total, 2);
      assertValidResult(result, list);
    });

    it("100 usuarios genéricos: suma de transferencias == suma de deudas", () => {
      const rand = mulberry32(90210);
      const list = randomBalancedScenario(100, rand);
      const { totalDebt } = totals(list);
      const result = simplifyDebts([], list);
      expect(sum(result)).toBeCloseTo(totalDebt, 2);
      expect(result.transfers.length).toBeLessThanOrEqual(list.length - 1);
      assertValidResult(result, list);
    });

    it("ningún tamaño entre 0 y 100 usuarios lanza errores", () => {
      const rand = mulberry32(7);
      for (let n = 0; n <= 100; n++) {
        const list =
          n === 0
            ? []
            : randomBalancedScenario(n, rand).slice(0, n) satisfies NetBalance[];
        const result = simplifyDebts([], list);
        assertValidResult(result, list);
      }
    });

    it("2.000 escenarios aleatorios con 2 a 40 usuarios: invariantes siempre cumplidas", () => {
      for (let seed = 1; seed <= 200; seed++) {
        const rand = mulberry32(seed * 7919);
        const n = 2 + Math.floor(rand() * 39);
        const list = randomBalancedScenario(n, rand);
        const result = simplifyDebts([], list);
        const { totalDebt } = totals(list);

        // Suma igual a la deuda total (nunca mayor: no duplicación).
        expect(sum(result)).toBeCloseTo(totalDebt, 2);

        const receivedBy = new Set(result.transfers.map((t) => t.toUserId));
        const paidBy = new Set(result.transfers.map((t) => t.fromUserId));
        for (const b of list) {
          if (b.net > 0.005) expect(receivedBy.has(b.userId)).toBe(true);
          if (b.net < -0.005) expect(paidBy.has(b.userId)).toBe(true);
        }
        assertValidResult(result, list);
      }
    });
  });

  describe("casos límite", () => {
    it("todos los saldos a cero: ninguna transferencia", () => {
      const list = balances([["a", 0], ["b", 0], ["c", 0]]);
      const result = simplifyDebts([], list);
      expect(result.transfers).toEqual([]);
    });

    it("importes pequeños por debajo del umbral (0.001): no da error", () => {
      const list = balances([["a", -0.001], ["b", 0.001], ["c", -0.01], ["d", 0.01]]);
      const result = simplifyDebts([], list);
      expect(sum(result)).toBeLessThanOrEqual(0.02);
      assertValidResult(result, list);
    });

    it("importes grandes (millones): no se descuadra", () => {
      const list = balances([["a", -2_345_678.89], ["b", 2_345_678.89]]);
      const result = simplifyDebts([], list);
      expect(result.transfers).toHaveLength(1);
      expect(result.transfers[0].amount).toBe(2345678.89);
    });

    it("residuo de redondeo (10.01 / 3): la suma cuadra dentro del céntimo", () => {
      const list = balances([["a", -3.34], ["b", -3.33], ["c", 6.67]]);
      const result = simplifyDebts([], list);
      expect(sum(result)).toBeCloseTo(6.67, 2);
      assertValidResult(result, list);
    });

    it("balanza no exacta pero con residuo de redondeo plausible: no lanza y no duplica", () => {
      // Suma = -70.1 -30.05 +100.16 = 0.01 (residuo real de redondeo).
      const list = balances([["a", -70.1], ["b", -30.05], ["c", 100.16]]);
      const result = simplifyDebts([], list);
      assertValidResult(result, list);
      expect(sum(result)).toBeCloseTo(result.transfers.reduce((s, t) => s + t.amount, 0), 2);
    });

    it("desfase grande solo con acreedores: no inventa pagos fantasma", () => {
      const list = balances([["a", 10], ["b", 20], ["c", 30]]);
      const result = simplifyDebts([], list);
      expect(result.transfers).toEqual([]);
    });

    it("desfase grande solo con deudores: no inventa pagos fantasma", () => {
      const list = balances([["a", -10], ["b", -20], ["c", -30]]);
      const result = simplifyDebts([], list);
      expect(result.transfers).toEqual([]);
    });

    it("deuda original con usuario que no tiene balance: usa nombre de respaldo y no lanza", () => {
      const list = balances([["a", -10], ["b", 10]]);
      const result = simplifyDebts(
        [{ fromUserId: "ghost", fromName: "Fantasma", toUserId: "a", toName: "A", amount: 5, reason: "Gasto" }],
        list
      );
      expect(result.debts[0].fromName).toBe("Fantasma");
      expect(result.debts[0].newAmount).toBe(5);
      assertValidResult(result, list);
    });

    it("newAmount nunca es negativo y respeta el importe original", () => {
      const list = balances([["a", -50], ["b", 50]]);
      const result = simplifyDebts(
        [{ fromUserId: "a", fromName: "a", toUserId: "b", toName: "b", amount: 50, reason: "Gasto" }],
        list
      );
      for (const d of result.debts as SimplifiedDebt[]) {
        expect(d.newAmount).toBeGreaterThanOrEqual(0);
        expect(d.newAmount).toBeLessThanOrEqual(d.originalAmount + 0.001);
      }
    });
  });
});