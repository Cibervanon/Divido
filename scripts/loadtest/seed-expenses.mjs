#!/usr/bin/env node
/**
 * Script para sembrar 800-1000 gastos en un grupo de staging.
 * Uso:
 *   BASE_URL=https://staging.onrender.com \
 *   EMAIL=test@staging.divido \
 *   PASSWORD=**** \
 *   GROUP_ID=<uuid> \
 *   node scripts/loadtest/seed-expenses.mjs
 *
 * Variables opcionales:
 *   COUNT=900          número de gastos a crear (default 900)
 *   CONCURRENCY=5      peticiones en paralelo (default 5, para no saturar tier gratis)
 *   CATEGORIES=comida,transporte,ocio  categorías a rotar (default: varias)
 */

import fetch from "node-fetch";

const BASE_URL = process.env.BASE_URL;
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;
const GROUP_ID = process.env.GROUP_ID;
const COUNT = parseInt(process.env.COUNT) || 900;
const CONCURRENCY = parseInt(process.env.CONCURRENCY) || 5;
const CATEGORIES = (process.env.CATEGORIES || "comida,transporte,ocio,otros").split(",");

if (!BASE_URL || !EMAIL || !PASSWORD || !GROUP_ID) {
  console.error("Faltan variables requeridas: BASE_URL, EMAIL, PASSWORD, GROUP_ID");
  process.exit(1);
}

async function login() {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login falló: ${res.status} ${await res.text()}`);
  const { token, user } = await res.json();
  return { token, userId: user.id };
}

async function createExpense(token, memberIds, idx) {
  const amount = Math.round((5 + Math.random() * 95) * 100) / 100; // 5-100 EUR
  const parts = [memberIds[0]];
  if (memberIds.length > 1) parts.push(memberIds[Math.floor(Math.random() * (memberIds.length - 1)) + 1]);

  const payload = {
    description: `Seed gasto ${idx + 1}/${COUNT} - ${new Date().toISOString()}`,
    amount,
    currency: "EUR",
    category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
    participants: parts,
  };

  const res = await fetch(`${BASE_URL}/api/groups/${GROUP_ID}/expenses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gasto ${idx} falló (${res.status}): ${txt}`);
  }
  return res.json();
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log(`\n🌱 Sembrando ${COUNT} gastos en grupo ${GROUP_ID}...`);
  console.log(`   Base: ${BASE_URL} | Concurrencia: ${CONCURRENCY}`);

  const { token, userId } = await login();
  console.log(`   ✅ Logueado como ${userId}`);

  // Obtener miembros del grupo para saber IDs válidos
  const groupRes = await fetch(`${BASE_URL}/api/groups/${GROUP_ID}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!groupRes.ok) throw new Error(`No se pudo leer grupo: ${groupRes.status}`);
  const { members } = await groupRes.json();
  const memberIds = members.map((m) => m.userId).filter((id) => id !== userId);
  if (memberIds.length === 0) {
    // Solo el usuario test en el grupo; usamos su propio ID
    memberIds.push(userId);
  }
  console.log(`   👥 ${memberIds.length} miembro(s) disponibles para repartir`);

  let created = 0;
  let failed = 0;
  const start = Date.now();

  // Procesar en lotes de CONCURRENCY
  for (let i = 0; i < COUNT; i += CONCURRENCY) {
    const batch = Math.min(CONCURRENCY, COUNT - i);
    const promises = [];
    for (let j = 0; j < batch; j++) {
      promises.push(createExpense(token, memberIds, i + j).catch((e) => {
        failed++;
        console.error(`   ❌ Gasto ${i + j + 1}: ${e.message}`);
        return null;
      }));
    }
    await Promise.all(promises);
    created += batch - failed;
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const rate = (created / elapsed).toFixed(1);
    process.stdout.write(`\r   📦 ${created}/${COUNT} (${rate}/s, ${failed} fallos)`);
  }

  console.log(`\n\n✅ Completado en ${((Date.now() - start) / 1000).toFixed(1)}s`);
  console.log(`   Creados: ${created} | Fallos: ${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("💥 Error fatal:", e.message);
  process.exit(1);
});