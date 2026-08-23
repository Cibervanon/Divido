// Load-test k6 para Divido — tarea T9 del plan de optimización.
//
// Perfil realista: ~95 % lecturas, ~5 % escrituras (crear gasto).
// Ejecutar SOLO contra staging o un entorno clonado con BD desechable:
//   k6 run -e BASE_URL=https://staging.example.com -e EMAIL=tu@divido.app \
//          -e PASSWORD=**** -e GROUP_ID=<uuid> scripts/loadtest/divido-load.js
//
// Variables de entorno para ajustar la carga (defaults: perfil beta realista):
//   TARGET_VUS     usuarios virtuales máximos en la meseta (default: 30; usar 500 para test de estrés)
//   RAMP_UP_DUR    duración subida inicial (default: "30s")
//   PLATEAU_DUR    duración meseta (default: "2m")
//   RAMP_DOWN_DUR  duración bajada final (default: "30s")
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8787";
const EMAIL = __ENV.EMAIL;
const PASSWORD = __ENV.PASSWORD;
const GROUP_ID = __ENV.GROUP_ID;

// Configuración parametrizable: perfil beta por defecto, 500 VUs opcional via TARGET_VUS=500
const TARGET_VUS = parseInt(__ENV.TARGET_VUS) || 30;
const RAMP_UP_DUR = __ENV.RAMP_UP_DUR || "30s";
const PLATEAU_DUR = __ENV.PLATEAU_DUR || "2m";
const RAMP_DOWN_DUR = __ENV.RAMP_DOWN_DUR || "30s";

const writeLatency = new Trend("divido_write_duration");
const readLatency = new Trend("divido_read_duration");
const writeFailRate = new Rate("divido_write_fails");

export const options = {
  scenarios: {
    ramp: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: RAMP_UP_DUR, target: Math.min(10, TARGET_VUS) },
        { duration: "1m", target: Math.min(30, TARGET_VUS) },
        { duration: PLATEAU_DUR, target: TARGET_VUS },
        { duration: RAMP_DOWN_DUR, target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "divido_read_duration{scenario:ramp}": ["p(95)<800"],
    "divido_write_duration{scenario:ramp}": ["p(95)<1500"],
  },
};

function authHeaders(token) {
  return { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } };
}

export function setup() {
  const res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({ email: EMAIL, password: PASSWORD }));
  check(res, { "login 200": (r) => r.status === 200 });
  const token = res.json("token");
  const detail = http.get(`${BASE_URL}/api/groups/${GROUP_ID}`, authHeaders(token));
  check(detail, { "grupo accesible": (r) => r.status === 200 });
  const memberIds = detail.json("members").map((m) => m.userId);
  return { token, memberIds };
}

export default function (data) {
  const H = authHeaders(data.token);

  // --- Lecturas (≈95 %) ---
  const detail = http.get(`${BASE_URL}/api/groups/${GROUP_ID}`, H);
  readLatency.add(detail.timings.duration);
  const expenses = http.get(`${BASE_URL}/api/groups/${GROUP_ID}/expenses?limit=50&offset=0`, H);
  readLatency.add(expenses.timings.duration);
  // http.get(`${BASE_URL}/api/groups/${GROUP_ID}/history?limit=100&offset=0`, H); // TEMP: comentado para verificar cuello de botella
  http.get(`${BASE_URL}/api/groups/${GROUP_ID}/common-pot`, H);

  // --- Escritura (≈5 %): crear gasto equitativo entre 2 miembros ---
  if (__VU % 20 === 0 && data.memberIds.length > 0) {
    const parts = [data.memberIds[0]];
    if (data.memberIds.length > 1) parts.push(data.memberIds[1]);
    const payload = {
      description: `Loadtest gasto VU${__VU} iter${__ITER}`,
      amount: Math.round((5 + Math.random() * 40) * 100) / 100,
      currency: "EUR",
      participants: parts,
    };
    const w = http.post(`${BASE_URL}/api/groups/${GROUP_ID}/expenses`, JSON.stringify(payload), H);
    writeLatency.add(w.timings.duration);
    writeFailRate.add(w.status >= 400);
  }

  sleep(Math.random() * 3 + 1); // pensamiento humano: 1–4 s entre acciones
}