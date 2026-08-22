# Load-test k6 · T9

Perfil realista de Divido: ~95 % lecturas (detalle, gastos, historial, bote) y ~5 % escrituras
(crear gasto equitativo entre dos miembros), con rampa hasta 500 usuarios virtuales.

## Requisitos

- [k6](https://k6.io/docs/get-started/installation/) ≥ 0.45
- Un entorno **staging o clonado** con **BD desechable**. NUNCA apuntar a producción:
  las escrituras del test crean gastos reales.

## Uso

```bash
k6 run \
  -e BASE_URL=https://tu-staging.onrender.com \
  -e EMAIL=tu@usuario.com \
  -e PASSWORD=******** \
  -e GROUP_ID=<uuid-de-grupo-del-que-eres-miembro> \
  scripts/loadtest/divido-load.js
```

Al terminar, k6 imprime p50/p90/p95 y throughput. Con `--summary-export=informe.json`
se guarda el detalle para actualizar la tabla maestra de la ficha técnica.

## Qué mirar en Render/Supabase durante la prueba

1. RSS de la API estable (< 150 MB) sin crecimientos sostenidos.
2. Conexiones de BD acotadas ≈ `DB_POOL_MAX` (10) — valida la tarea T6.
3. Sin errores 5xx ni `too many connections`.
