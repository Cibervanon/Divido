import type { TourStep } from "../hooks/useGuidedTour";

// Helper: targets that exist in current DashboardPage.tsx and GroupPage.tsx
export const tourSteps: TourStep[] = [
  // PASO 0: Dashboard - Lista de grupos
  {
    id: "dashboard-groups",
    target: ".group:first-of-type",
    title: "🏠 Tus grupos",
    content: "Aquí ves todos tus grupos. <strong>Verde = te deben</strong>, <strong>rojo = debes</strong>. El neto total está en la tarjeta superior. Pulsa un grupo para entrar.",
    position: "right",
    skipIf: () => {
      const cards = document.querySelectorAll(".group");
      return cards.length === 0;
    },
  },

  // PASO 1: Dashboard - Crear grupo (EmptyState o header)
  {
    id: "create-group",
    target: "[data-tour='create-group']",
    title: "➕ Crear tu primer grupo",
    content: "Pulsa <strong>+</strong> para crear un grupo. Elige nombre, <strong>moneda</strong> (no se puede cambiar después) y tipo: <strong>Abierto</strong> (todos invitan) o <strong>Cerrado</strong> (solo admins).",
    position: "top",
    skipIf: () => {
      // Skip if user already has groups (they'll see step 0 instead)
      const cards = document.querySelectorAll(".group");
      if (cards.length > 0) return true;
      // Skip if button doesn't exist yet (dashboard still loading)
      const btn = document.querySelector("[data-tour='create-group']");
      return !btn;
    },
  },

  // PASO 2: Dentro del grupo - Pestaña Gastos / Nuevo gasto
  {
    id: "add-expense",
    target: "[data-tour='add-expense']",
    title: "🧾 Añadir un gasto",
    content: "En el grupo, pulsa <strong>Nuevo gasto</strong>. Rellena: descripción, importe, <strong>quién pagó</strong> y cómo repartir: <strong>Iguales</strong> (a partes iguales), <strong>%</strong> (porcentajes), <strong>€</strong> (importes exactos) o <strong>Bote</strong> (desde el bote común). Puedes adjuntar foto del tique.",
    position: "top",
    skipIf: () => {
      // Only show if we're on a group page (URL contains /groups/)
      if (!window.location.pathname.includes("/groups/")) return true;
      const btn = document.querySelector("[data-tour='add-expense']");
      return !btn;
    },
  },

  // PASO 3: Dentro del grupo - Pestaña Saldos
  {
    id: "balances-tab",
    target: "[data-tour='balances-tab']",
    title: "💰 Ver saldos y simplificación",
    content: "Pestaña <strong>Saldos</strong> → ves <strong>quién debe a quién</strong>. <span style='color:#3fb950'>Verde</span> = te deben, <span style='color:#f85149'>Rojo</span> = debes. La <strong>Simplificación</strong> reduce pagos cruzados al mínimo (máx. n−1 transferencias). Pulsa <strong>Ver desglose</strong> para ver pagos exactos.",
    position: "left",
    skipIf: () => {
      if (!window.location.pathname.includes("/groups/")) return true;
      const tab = document.querySelector("[data-tour='balances-tab']");
      return !tab;
    },
  },

  // PASO 4: Dentro del grupo - Bote común
  {
    id: "common-pot",
    target: "[data-tour='common-pot']",
    title: "🐷 Bote común",
    content: "El <strong>Bote</strong> es una caja compartida: <strong>Aportas</strong> dinero (se te debe) y <strong>Pagas gastos desde el bote</strong> (reparto \"Bote\") sin tocar saldos individuales. Ideal para viajes: metéis dinero al inicio y pagáis todo desde ahí. Ver <strong>Extracto</strong> para auditoría completa.",
    position: "bottom",
    skipIf: () => {
      if (!window.location.pathname.includes("/groups/")) return true;
      const tab = document.querySelector("[data-tour='common-pot']");
      return !tab;
    },
  },

  // PASO 5: Notificaciones
  {
    id: "notifications",
    target: "[data-tour='notifications']",
    title: "🔔 Notificaciones en tiempo real",
    content: "La <strong>campana</strong> muestra avisos al instante: nuevos gastos, pagos, piques, invitaciones. <strong>Número exacto 1-9</strong>, <strong>+9</strong> si hay más. Click en aviso → navega directo. <strong>Marcar todas como leídas</strong> limpia el contador. En Perfil → Ajustes eliges qué avisos recibes.",
    position: "bottom",
    skipIf: () => {
      const bell = document.querySelector("[data-tour='notifications']");
      return !bell;
    },
  },

  // PASO 6: Instalar PWA
  {
    id: "pwa-install",
    target: "body",
    title: "📱 Instala Divido como app nativa",
    content: "Funciona <strong>offline</strong>, recibe <strong>push nativas</strong> y tiene icono en pantalla de inicio.\n\n<strong>iOS:</strong> Safari → <strong>Compartir → Añadir a pantalla de inicio</strong>\n<strong>Android / Escritorio:</strong> botón <strong>Instalar</strong> en barra de direcciones o menú ⋮",
    position: "bottom",
    skipIf: () => {
      const isPWA = window.matchMedia("(display-mode: standalone)").matches;
      const dismissed = localStorage.getItem("pwa_dismissed") === "true";
      return isPWA || dismissed;
    },
  },
];

export function getActiveSteps(): TourStep[] {
  return tourSteps.filter((step) => !step.skipIf || !step.skipIf());
}