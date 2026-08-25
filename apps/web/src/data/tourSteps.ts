/**
 * Tour Steps Definition
 * 7 Steps aligned with the reference specification
 */
import type { TourStep } from "../hooks/useGuidedTour";

export const TOUR_STEPS: TourStep[] = [
  {
    id: "dashboard-groups",
    title: "Bienvenido a Divido",
    content: `
      <p>Bienvenido a <strong>Divido</strong>, la app para gestionar gastos en grupo y liquidar deudas sin fricción.</p>
      <p>Desde aquí verás todos tus grupos y tu balance neto en cada uno.</p>
    `,
    target: ".group:first-of-type",
    position: "bottom",
    when: "hasGroups",
  },
  {
    id: "create-group",
    title: "Crea tu primer grupo",
    content: `
      <p>Pulsa el botón <strong>+</strong> para crear tu primer grupo.</p>
      <p>Elige nombre, moneda y tipo (abierto/cerrado).</p>
    `,
    target: "[data-tour='create-group']",
    position: "top",
    when: "noGroups",
  },
  {
    id: "add-expense",
    title: "Añade tu primer gasto",
    content: `
      <p>Dentro de un grupo, pulsa <strong>+ Gasto</strong> para registrar un gasto.</p>
      <ul>
        <li><strong>Quién pagó</strong>: tú u otro miembro</li>
        <li><strong>Cuánto</strong>: importe y moneda</li>
        <li><strong>Reparto</strong>: equitativo, porcentajes o importes exactos</li>
        <li><strong>Categoría</strong>: se detecta automáticamente o elige manual</li>
      </ul>
    `,
    target: "[data-tour='add-expense']",
    position: "top",
  },
  {
    id: "split-modes",
    title: "Repartos flexibles",
    content: `
      <p>Divido ofrece <strong>3 modos de reparto</strong> para adaptarse a cualquier situación:</p>
      <ul>
        <li><strong>Iguales</strong>: todos pagan lo mismo (por defecto)</li>
        <li><strong>Porcentajes</strong>: cada uno paga un % (ej. 60/40)</li>
        <li><strong>Importes exactos</strong>: cada uno paga lo que debe exactamente</li>
      </ul>
      <p>El pagador <strong>no se reparte a sí mismo</strong> (solo los demás le deben).</p>
    `,
    target: "[data-tour='split-modes']",
    position: "bottom",
  },
  {
    id: "balances-tab",
    title: "Saldos y liquidación óptima",
    content: `
      <p>En la pestaña <strong>Saldos</strong> verás:</p>
      <ul>
        <li><strong>Verde</strong>: te deben dinero</li>
        <li><strong>Rojo</strong>: debes dinero</li>
        <li><strong>Gris</strong>: al día</li>
      </ul>
      <p>Divido calcula la <strong>liquidación óptima</strong> (mínimo de transferencias) para que paguéis lo justo.</      `,
    target: "[data-tour='balances-tab']",
    position: "left",
  },
  {
    id: "help-section",
    title: "Ayuda y tutorial interactivo",
    content: `
      <p>En cualquier momento, pulsa el icono <strong>❓</strong> en la cabecera para abrir esta ayuda interactiva.</p>
      <p>También puedes pulsar <kbd>?</kbd> en cualquier momento para volver a ver este tutorial.</p>
    `,
    target: "[data-tour='help-button']",
    position: "bottom",
  },
  {
    id: "pwa-install",
    title: "Instala Divido como app nativa",
    content: `
      <p>Divido es una <strong>PWA</strong>: puedes instalarla como app nativa en tu móvil u ordenador.
      <ul>
        <li><strong>Android/Chrome</strong>: Menú ▸ «Instalar Divido»</li>
        <li><strong>iOS/Safari</strong>: Compartir ▸ «Añadir a pantalla de inicio»</li>
        <li><strong>Escritorio</strong>: Icono ▸ «Instalar Divido»</li>
      </ul>
      <p>Funciona <strong>offline</strong> y recibe notificaciones push.</p>
    `,
    target: "body",
    position: "center",
    when: "notPWA",
  },
];

// Conditional step getters
export function getActiveSteps(context: { hasGroups: boolean; isPWA: boolean; inGroup: boolean }): typeof TOUR_STEPS {
  const steps = [...TOUR_STEPS];

  // Filter based on context
  return steps.filter(step => {
    if (!step.when) return true;
    
    switch (step.when) {
      case "hasGroups":
        return context.hasGroups;
      case "noGroups":
        return !context.hasGroups;
      case "inGroup":
        return context.inGroup;
      case "notPWA":
        return !context.isPWA;
      default:
        return true;
    }
  });
}

// Tour configuration
export const TOUR_CONFIG = {
  storageKey: "divido.tour_completed",
  firstVisitKey: "divido.tour_first_visit",
  autoStartDelay: 1000,
  keyboardShortcuts: {
    next: "ArrowRight",
    previous: "ArrowLeft",
    skip: "Escape",
    open: "KeyT",
    help: "Question",
  },
};