import type { TourStep } from "../hooks/useGuidedTour";

export const tourSteps: TourStep[] = [
  {
    id: "dashboard-groups",
    target: ".group:first-of-type",
    title: "Tus grupos",
    content: "Aquí ves tus grupos anclados. <strong>Verde = te deben</strong>, <strong>rojo = debes</strong>. El neto está arriba a la derecha.",
    position: "right",
    skipIf: () => {
      const cards = document.querySelectorAll(".group");
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
      // Skip if user already has groups (they'll see step 0 instead)
      const cards = document.querySelectorAll(".group");
      if (cards.length > 0) return true;
      // Skip if EmptyState create button doesn't exist yet (dashboard still loading)
      const emptyStateBtn = document.querySelector("[data-tour='create-group']");
      return !emptyStateBtn;
    },
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

export function getActiveSteps(): TourStep[] {
  return tourSteps.filter((step) => !step.skipIf || !step.skipIf());
}