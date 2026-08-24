import type { TourStep } from "../hooks/useGuidedTour";

// 6 pasos principales + Help (7 total) alineados con la referencia
export const tourSteps: TourStep[] = [
  // 1. Dashboard - Groups → Highlights anchored groups, explains balance colors
  {
    id: "dashboard-groups",
    target: ".group:first-of-type",
    title: "🏠 Tus grupos",
    content: "Aquí ves todos tus grupos. Los <strong>anclados (📌)</sub> están arriba. <strong style='color:#3fb950'>Verde = te deben</strong>, <strong style='color:#f85149'>Rojo = debes</strong>. El neto total está en la tarjeta superior.",
    position: "right",
    skipIf: () => {
      const cards = document.querySelectorAll(".group");
      return cards.length === 0;
    },
  },

  // 2. Create Group → FAB button walkthrough (only shows if no groups exist)
  {
    id: "create-group",
    target: "[data-tour='create-group']",
    title: "➕ Crear tu primer grupo",
    content: "Pulsa el botón <strong>+</strong> para crear un grupo. Elige nombre, <strong>moneda</strong> (no se puede cambiar después) y tipo: <strong>Abierto</strong> (todos invitan) o <strong>Cerrado</strong> (solo admins).",
    position: "top",
    skipIf: () => {
      const cards = document.querySelectorAll(".group");
      if (cards.length > 0) return true; // Solo si NO hay grupos
      const btn = document.querySelector("[data-tour='create-group']");
      return !btn; // Skip si el botón no existe aún
    },
  },

  // 3. Add Expense → FAB in group, explains fields & split types
  {
    id: "add-expense",
    target: "[data-tour='add-expense']",
    title: "🧾 Añadir un gasto",
    content: "En el grupo, pulsa <strong>Nuevo gasto</strong> (FAB). Rellena: descripción, importe, <strong>quién pagó</strong> y elige cómo repartir: <strong>Iguales</strong>, <strong>%</strong>, <strong>€</strong> o <strong>Bote</strong>. Puedes adjuntar foto del tique.",
    position: "top",
    skipIf: () => {
      if (!window.location.pathname.includes("/groups/")) return true;
      const btn = document.querySelector("[data-tour='add-expense']");
      return !btn;
    },
  },

  // 4. Split Modes → Chips for Equal/Percent/Amount with explanations
  {
    id: "split-modes",
    target: "[data-tour='split-modes']",
    title: "⚖️ Modos de reparto",
    content: "Al crear gasto, elige el reparto:\n• <strong>Iguales</strong> → a partes iguales\n• <strong>%</strong> → porcentajes (ej. 60/40)\n• <strong>€</strong> → importes exactos por persona\n• <strong>Bote</strong> → se paga desde el bote común\n\nPuedes combinar: algunos en iguales, otros personalizados.",
    position: "right",
    skipIf: () => {
      if (!window.location.pathname.includes("/groups/")) return true;
      const chips = document.querySelector("[data-tour='split-modes']");
      return !chips;
    },
  },

  // 5. Balances Tab → Shows debt colors & simplification explanation
  {
    id: "balances-tab",
    target: "[data-tour='balances-tab']",
    title: "💰 Saldos y simplificación",
    content: "Pestaña <strong>Saldos</strong> → ves <strong>quién debe a quién</strong>. <span style='color:#3fb950'>Verde</span> = te deben, <span style='color:#f85149'>Rojo</span> = debes. La <strong>Simplificación</strong> reduce pagos al mínimo (máx. n−1 transferencias). Pulsa <strong>Ver desglose</strong> para ver pagos exactos.",
    position: "left",
    skipIf: () => {
      if (!window.location.pathname.includes("/groups/")) return true;
      const tab = document.querySelector("[data-tour='balances-tab']");
      return !tab;
    },
  },

  // 6. Help → Before PWA install CTA
  {
    id: "help-section",
    target: "[data-tour='help-button']",
    title: "❓ Ayuda y Soporte",
    content: "¿Tienes dudas? Pulsa el icono <strong>❓</strong> en la cabecera para acceder a:\n• <strong>Temas</strong> guías paso a paso\n• <strong>Atajos</strong> de teclado\n• <strong>Iconos</strong> y su significado\n• <strong>Categorías</strong> de gasto con palabras clave\n• <strong>FAQ</strong> preguntas frecuentes\n\nBusca con <strong>?</strong> o <strong>Ctrl+K</strong>.",
    position: "bottom",
    skipIf: () => {
      const btn = document.querySelector("[data-tour='help-button']");
      return !btn;
    },
  },

  // 7. PWA Install → Only shows if not installed & not dismissed
  {
    id: "pwa-install",
    target: "body",
    title: "📱 Instala Divido como app nativa",
    content: "Funciona <strong>offline</strong>, recibe <strong>push nativas</strong> y tiene icono en pantalla de inicio.\n\n<strong>iOS:</strong> Safari → <strong>Compartir → Añadir a pantalla de inicio</strong>\n<strong>Android / Escritorio:</strong> botón <strong>Instalar</strong> en barra de direcciones o menú ⋮\n\n¿Ya lo sabes todo? ¡Instala y llévalo a todas partes!",
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