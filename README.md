# Divido — Gastos compartidos y liquidación de deudas

Aplicación completa (frontend + backend + PWA) para gestionar gastos en grupo: registro de gastos con reparto equitativo, optimización de deudas (mínimo número de transferencias), pagos externos "marcados como saldados", multidivisa con tipo de cambio congelado, roles por grupo, invitaciones y gestión de exmiembros.

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | React 18 + Vite + Tailwind CSS + React Router + PWA (instalable, offline) |
| Backend | Node.js + Fastify + SQLite nativo (`node:sqlite`, sin dependencias nativas) |
| Auth | JWT (email/contraseña con bcrypt) + OAuth 2.0 Google |
| Shared | `@divido/shared`: tipos + algoritmo de liquidación de deudas |

## Estructura

```
packages/shared   → tipos y algoritmo de simplificación de deudas
apps/api          → API REST (Fastify + SQLite)
apps/web          → PWA React (dashboard, grupo, auth, invitación)
```

## Requisitos

- Node.js ≥ 22.5 (usa `node:sqlite` integrado)

## Puesta en marcha

```bash
npm install          # instala todas las workspaces
npm run dev:api      # terminal 1 → API en http://localhost:4000
npm run dev:web      # terminal 2 → app en http://localhost:5173
```

Abre **http://localhost:5173**. El dev server de Vite hace proxy de `/api` al backend.

### Configuración (opcional)

Copia `apps/api/.env.example` a `apps/api/.env` y ajusta:

- `JWT_SECRET` → obligatorio en producción.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` → para activar el login con Google (consola de Google Cloud, redirect URI `http://localhost:5173/auth/google/callback`).
- `WEB_ORIGIN` / `CORS_ORIGIN` → si despliegas la web en otro dominio.

## Construcción y despliegue

```bash
npm run build        # compila shared + web (PWA generada en apps/web/dist)
npm run start:api    # sirve la API en producción
```

Para servir la PWA construida con Vite Preview: `npm run preview -w @divido/web`.

## Funcionalidades

- **Auth**: registro/login por email, login con Google, sesión JWT.
- **Grupos**: abiertos (todos invitan) o cerrados (solo admins). Roles admin/miembro.
- **Invitar**: enlace único por grupo. Vista previa anónima; se exige login en el momento de participar o unirse. Re-unión recupera saldo e histórico.
- **Gastos**: reparto equitativo entre participantes (la parte del pagador se excluye), multidivisa con tipo de cambio congelado, bloqueo nativo tras 24h con solicitud de modificación aprobada por admin.
- **Liquidación**: algoritmo de optimización de deudas (≤ n-1 transferencias), pagos externos "marcar como saldado", historial cronológico transparente.
- **Exmiembros**: balance congelado visible aparte; evita desajustes contables.
- **UX**: dashboard con tarjetas y balance de color, acción rápida "+" por grupo, vista de grupo con pestañas (Gastos, Saldos, Miembros, Historial) y desglose por persona.

## Endpoints principales

| Método | Ruta | Descripción |
| --- | --- | --- |
| POST | `/api/auth/register` `/api/auth/login` | Alta / sesión |
| GET/POST | `/api/join/:token` | Preview pública / unirse |
| GET/POST | `/api/groups` | Listar / crear grupos |
| GET/PATCH | `/api/groups/:id` | Detalle / editar grupo (admin) |
| POST | `/api/groups/:id/invite` | Regenerar enlace |
| POST/DELETE | `/api/groups/:id/leave` `/members/:userId` | Abandonar / expulsar |
| POST | `/api/groups/:id/expenses` | Crear gasto |
| PATCH/DELETE | `/api/expenses/:id` | Editar / eliminar (ventana 24h) |
| POST | `/api/expenses/:id/modification-request` | Solicitar cambio >24h |
| POST | `/api/requests/:id/approve\|reject` | Decidir solicitud (admin) |
| POST | `/api/groups/:id/payments` | Marcar pago como saldado |
| GET | `/api/groups/:id/balances` `/history` | Saldos optimizados / historial |
| GET | `/api/groups/:id/members/:userId/breakdown` | Desglose por persona |

## Pruebas rápidas

```powershell
# crear grupo y unir a otro usuario (usando el inviteUrl devuelto)
Invoke-RestMethod http://localhost:4000/api/auth/register -Method Post -ContentType application/json -Body '{"email":"a@x.com","password":"123456","name":"Ana"}'
Invoke-RestMethod http://localhost:4000/api/groups -Method Post -ContentType application/json -Headers @{Authorization="Bearer <token>"} -Body '{"name":"Viaje","currency":"EUR","type":"open"}'
```
