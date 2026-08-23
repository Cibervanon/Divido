# Load-test k6 · T9

Perfil realista de Divido: ~95 % lecturas (detalle, gastos, historial, bote) y ~5 % escrituras
(crear gasto equitativo entre dos miembros), con rampa configurable.

## Requisitos

- [k6](https://k6.io/docs/get-started/installation/) ≥ 0.45
- Un entorno **staging o clonado** con **BD desechable**. NUNCA apuntar a producción:
  las escrituras del test crean gastos reales.

## Variables de entorno del test principal

| Variable | Descripción | Default |
|----------|-------------|---------|
| `BASE_URL` | URL del API staging (ej. `https://divido-staging.onrender.com`) | `http://localhost:8787` |
| `EMAIL` | Usuario de prueba en staging | — |
| `PASSWORD` | Contraseña del usuario | — |
| `GROUP_ID` | UUID del grupo de prueba (con 800+ gastos sembrados) | — |
| `TARGET_VUS` | Usuarios virtuales máximos en meseta (perfil beta: 30; test estrés: 500) | `30` |
| `RAMP_UP_DUR` | Duración subida inicial | `30s` |
| `PLATEAU_DUR` | Duración meseta | `2m` |
| `RAMP_DOWN_DUR` | Duración bajada final | `30s` |

## Uso — Paso A: Smoke test beta (realista, ~30 VUs)

```bash
k6 run \
  -e BASE_URL=https://tu-staging.onrender.com \
  -e EMAIL=test@staging.divido \
  -e PASSWORD=******** \
  -e GROUP_ID=<uuid-grupo-con-800+-gastos> \
  scripts/loadtest/divido-load.js
```

## Uso — Paso B: Test estrés completo (500 VUs, para tier de pago)

```bash
k6 run \
  -e BASE_URL=https://tu-staging.onrender.com \
  -e EMAIL=test@staging.divido \
  -e PASSWORD=******** \
  -e GROUP_ID=<uuid-grupo-con-800+-gastos> \
  -e TARGET_VUS=500 \
  -e PLATEAU_DUR=5m \
  scripts/loadtest/divido-load.js
```

Con `--summary-export=informe.json` se guarda el detalle para actualizar la tabla maestra de la ficha técnica.

## Script de sembrado (seed) — requerido antes del test

El cuello de botella de la paginación (T3) solo se nota con grupos grandes. Antes de correr el load test,
ejecuta el script de seed para crear **800-1000 gastos** en el grupo de staging:

```bash
BASE_URL=https://tu-staging.onrender.com \
EMAIL=test@staging.divido \
PASSWORD=******** \
GROUP_ID=<uuid> \
COUNT=900 \
CONCURRENCY=5 \
node scripts/loadtest/seed-expenses.mjs
```

Opcional: `CATEGORIES=comida,transporte,ocio,otros`

## Qué mirar en Render/Supabase durante la prueba

1. RSS de la API estable (< 150 MB) sin crecimientos sostenidos.
2. Conexiones de BD acotadas ≈ `DB_POOL_MAX` (10) — valida la tarea T6.
3. Sin errores 5xx ni `too many connections`.

## Umbrales (definidos en el script)

- `http_req_failed < 1%`
- Lecturas p95 < 800 ms (`divido_read_duration`)
- Escrituras p95 < 1500 ms (`divido_write_duration`)

## Interpretación en tier gratuito

Render gratis "duerme" a los 15 min y tiene CPU/RAM compartida.
- Si falla el **smoke test (30 VUs)** → hay un problema real en el código/índices.
- Si falla solo el **test 500 VUs** → límite del tier, no del código. Anota en el informe: "fallo por límite tier gratuito Render".