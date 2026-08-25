import { useState, useEffect, useCallback, useMemo, useRef } from "react";

export interface TourStep {
  id: string;
  title: string;
  content: string;
  target: string;
  position?: "top" | "bottom" | "left" | "right" | "center";
  when?: string;
}

export interface TourDebugState {
  isOpen: boolean;
  currentStepIndex: number;
  activeStepsCount: number;
  activeStepsIds: string[];
  hasEvaluated: boolean;
  allSteps: TourStep[];
}

interface GuidedTourState {
  isOpen: boolean;
  currentStepIndex: number;
  activeSteps: TourStep[];
  hasEvaluated: boolean;
  skipped: boolean;
}

const STORAGE_KEY = "divido.tour_completed";
const FIRST_VISIT_KEY = "divido.tour_first_visit";

interface UseGuidedTourReturn {
  isOpen: boolean;
  currentStep: number;
  activeSteps: Array<{
    id: string;
    title: string;
    content: string;
    target: string;
    position?: string;
    when?: string;
  }>;
  currentStepIndex: number;
  isOpen: boolean;
  isLoading: boolean;
  debugState: {
    isOpen: boolean;
    currentStepIndex: number;
    activeStepsCount: number;
    activeStepsIds: string[];
    hasEvaluated: boolean;
    allSteps: any[];
  };
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  openTour: () => void;
  closeTour: () => void;
  showDebug: boolean;
  setShowDebug: (show: boolean) => void;
  debugState: any;
  setShowDebug: (show: boolean) => void;
}

interface UseGuidedTourOptions {
  hasGroups: boolean;
  isPWA: boolean;
  inGroup: boolean;
  hasGroups: boolean;
}

export function useGuidedTour(options: UseGuidedTourOptions = { 
  hasGroups: false, 
  isPWA: false, 
  inGroup: false, 
  hasGroups: false 
}): any {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showDebug, setShowDebug] = useState(false);

  const steps = useMemo(() => {
    const steps = [
      {
        id: "dashboard-groups",
        title: "Bienvenido a Divido",
        content: `<p>Bienvenido a <strong>Divido</strong>, la app para gestionar gastos en grupo y liquidar deudas sin fricción.</<p>Desde aquí verás todos tus grupos y tu balance neto en cada uno.</      `,
        target: ".group:first-of-type",
        position: "bottom",
      },
      {
        id: "create-group",
        title: "Crea tu primer grupo",
        content: `<p>Pulsa el botón <strong>+</strong> para crear tu primer grupo.</p><p>Elige nombre, moneda y tipo (abierto/cerrado).</p>`,
        target: "[data-tour='create-group']",
        position: "top",
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
          <p>Divido calcula la <strong>liquidación óptima</strong> (mínimo de transferencias) para que paguéis lo justo.
        `,
        target: "[data-tour='balances-tab']",
        position: "left",
      },
      {
        id: "help-section",
        title: "Ayuda y tutorial interactivo",
        content: `
          <p>En cualquier momento, pulsa el icono <strong>❓</strong> en la cabecera para abrir esta ayuda interactiva.</        `,
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

    return steps;
  }, []);

  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showDebug, setShowDebug] = useState(false);

  const activeSteps = [] as any[];
  const currentStepIndex = 0;
  const isOpen = false;
  const isLoading = false;
  const showDebug = false;

  const openTour = () => {};
  const closeTour = () => {};
  const handleNext = () => {};
  const handlePrev = () => {};
  const skipTour = () => {};
  const completeTour = () => {};
  const openTour = () => {};
  const closeTour = () => {};
  const showDebug = false;
  const setShowDebug = () => {};
  const debugState = {};
  const setShowDebug = () => {};

  // TODO: Implement proper tour logic

  return {
    isOpen: false,
    currentStep: 0,
    activeSteps: [],
    currentStepIndex: 0,
    isOpen: false,
    isLoading: false,
    debugState: {
      isOpen: false,
      currentStepIndex: 0,
      activeStepsCount: 0,
      activeStepsIds: [],
      hasEvaluated: false,
      allSteps: [],
    },
    nextStep: () => {},
    prevStep: () => {},
    skipTour: () => {},
    completeTour: () => {},
    openTour: () => {},
    closeTour: () => {},
    showDebug: false,
    setShowDebug: () => {},
    debugState: {},
    setShowDebug: () => {},
  };
}