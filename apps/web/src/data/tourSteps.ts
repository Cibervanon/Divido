import type { TourStep } from "../hooks/useGuidedTour";

export const tourSteps: TourStep[] = [
  {
    id: "dashboard-groups",
    target: ".group-card:first-child",
    title: "Tus grupos",
    content: "Aquí ves tus grupos anclados. <strong>Verde = te deben</strong>, <strong>rojo = debes</strong>. El neto está arriba a la derecha.",
    position: "right",
    skipIf: () => {
      const cards = document.querySelectorAll(".group-card");
      return cards.length === 0;
    },
  },
  {
    id: "create-group",
    target: "[data-tour='create-group']",
    title: "Crear grupo",
    content: "Pulsa <strong>+</strong> para crear tu primer grupo. Elige nombre, moneda (no se puede cambiar después) y tipo: <strong>Abierto</strong> (todos invitan) o <strong>Cerrado</strong> (solo admins).",
    position: "top",
    skipIf: () => {
      const cards = document.querySelectorAll(".group-card");
      return cards.length > 0;
    },
  },
  {
    id: "add-expense",
    target: "[data-tour='add-expense']",
    title: "Añadir gasto",
    content: "Registra un gasto: descripción, importe, <strong>quién pagó</strong> y cómo repartir: <strong>Iguales</strong> (equitativo), <strong>%</strong> (porcentajes), <strong>€</strong> (importes exactos) o <strong>Bote</strong> (desde el bote común).",
    position: "top",
    skipIf: () => !document.querySelector("[data-tour='add-expense']"),
  },
  {
    id: "split-chips",
    target: "[data-tour='split-chips']",
    title: "Tipos de reparto",
    content: "<strong>Iguales</strong> = a partes iguales. <strong>%</strong> = porcentajes (ej. 60/40). <strong>€</strong> = importes exactos por persona. Puedes combinar: algunos iguales, otros personalizados.",
    position: "right",
    skipIf: () => !document.querySelector("[data-tour='split-chips']"),
  },
  {
    id: "balances-tab",
    target: "[data-tour='balances-tab']",
    title: "Saldos y simplificación",
    content: "Aquí ves <strong>quién debe a quién</strong>. <span style='color:#3fb950'>Verde</span> = te deben. <span style='color:#f85149'>Rojo</span> = debes. La <strong>simplificación</strong> reduce pagos cruzados al mínimo (máx. n-1 transferencias).",
    position: "left",
    skipIf: () => !document.querySelector("[data-tour='balances-tab']"),
  },
  {
    id: "pwa-install",
    target: "body",
    title: "Instala Divido",
    content: "Instala Divido como app nativa: funciona <strong>offline</strong>, recibe <strong>notificaciones push</strong> y tiene icono en tu pantalla de inicio. En iOS: <strong>Compartir → Añadir a pantalla de inicio</strong>. En Android/Escritorio: botón <strong>Instalar</strong> del navegador.",
    position: "bottom",
    skipIf: () => {
      const isPWA = window.matchMedia("(display-mode: standalone)").matches;
      const dismissed = localStorage.getItem("pwa_dismissed") === "true";
      return isPWA || dismissed;
    },
  },
];

export function getActiveSteps(): typeof tourSteps {
  return tourSteps.filter((step) => !step.skipIf || !step.skipIf());
}