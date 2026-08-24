import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { tourSteps } from "../data/tourSteps.ts";

export interface TourStep {
  id: string;
  target: string;
  title: string;
  content: string;
  position: "top" | "bottom" | "left" | "right" | "center";
  skipIf?: () => boolean;
}

interface StepInfo {
  step: TourStep;
  element: HTMLElement | null;
  skipped: boolean;
}

export function useGuidedTour() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [steps, setSteps] = useState<StepInfo[]>([]);
  const [hasEvaluated, setHasEvaluated] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [completedThisSession, setCompletedThisSession] = useState(false);

  const observerRef = useRef<MutationObserver | null>(null);
  const mountedRef = useRef(true);

  // Auto-clear localStorage on FIRST VISIT ever
  useEffect(() => {
    const firstVisit = localStorage.getItem("divido.tour_first_visit") !== "false";
    if (firstVisit) {
      console.log('[Tour] FIRST VISIT - clearing stale tour state');
      localStorage.removeItem("divido.tour_done");
      localStorage.removeItem("divido.tour_dismissed");
      localStorage.removeItem("divido.tour_step");
      localStorage.setItem("divido.tour_first_visit", "false");
    }
  }, []);

  const evaluateAllSteps = useCallback(() => {
    if (!mountedRef.current) return;
    const newSteps: StepInfo[] = tourSteps.map((step) => {
      let element: HTMLElement | null = null;
      let skipped = false;
      try { element = document.querySelector(step.target); } catch { element = null; }
      if (step.skipIf) { try { skipped = step.skipIf(); } catch { skipped = false; } }
      return { step, element, skipped };
    });
    setSteps(newSteps);
    setHasEvaluated(true);
    console.log('[Tour] EVAL:', newSteps.map(s => `${s.step.id}: skipped=${s.skipped} element=${!!s.element}`).join(" | "));
  }, []);

  const activeSteps = useMemo(() => steps.filter(s => !s.skipped && s.element).map(s => s.step), [steps]);
  const currentStep = activeSteps[currentStepIndex] ?? null;

  const shouldShowTour = useMemo(() => {
    const done = localStorage.getItem("divido.tour_done") === "true";
    const dismissed = localStorage.getItem("divido.tour_dismissed") === "true";
    if (done || dismissed) return false;
    return activeSteps.length > 0;
  }, [activeSteps.length]);

  // Init: continuous evaluation
  useEffect(() => {
    mountedRef.current = true;
    evaluateAllSteps();
    const timer = setInterval(() => { if (mountedRef.current) evaluateAllSteps(); }, 500);
    try {
      const obs = new MutationObserver(() => { if (mountedRef.current) evaluateAllSteps(); });
      obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-tour", "style"] });
      observerRef.current = obs;
    } catch (e) { console.warn('[Tour] MutationObserver failed:', e); }
    return () => { mountedRef.current = false; observerRef.current?.disconnect(); };
  }, []);

  // Auto-open
  useEffect(() => {
    if (!hasEvaluated || isOpen || completedThisSession) return;
    const done = localStorage.getItem("divido.tour_done") === "true";
    const dismissed = localStorage.getItem("divido.tour_dismissed") === "true";
    if (done || dismissed) return;
    if (activeSteps.length > 0) {
      const firstActive = activeSteps[0];
      const firstStepInfo = steps.find(s => s.step === firstActive);
      if (firstStepInfo?.element) {
        console.log('[Tour] AUTO-OPENING at step:', firstActive.id);
        setCurrentStepIndex(0);
        setIsOpen(true);
        localStorage.setItem("divido.tour_step", "0");
      }
    }
  }, [hasEvaluated, activeSteps, isOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'd' || e.key === 'D') setShowDebug(d => !d);
      if ((e.key === 't' || e.key === 'T') && activeSteps.length > 0) { setCurrentStepIndex(0); setIsOpen(true); }
      if (e.key === 'r' || e.key === 'R') {
        localStorage.removeItem("divido.tour_done");
        localStorage.removeItem("divido.tour_dismissed");
        localStorage.removeItem("divido.tour_step");
        evaluateAllSteps();
        setTimeout(() => { if (activeSteps.length > 0) { setCurrentStepIndex(0); setIsOpen(true); } }, 100);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeSteps]);

  // Persist step
  useEffect(() => { if (isOpen) localStorage.setItem("divido.tour_step", String(currentStepIndex)); }, [currentStepIndex, isOpen]);

  // Debug state
  const debugState = useMemo(() => ({ isOpen, currentStepIndex, activeStepsCount: activeSteps.length, activeStepsIds: activeSteps.map(s => s.id), allSteps: steps.map(s => ({ id: s.step.id, target: s.step.target, skipped: s.skipped, hasElement: !!s.element })), hasEvaluated, shouldShowTour }), [isOpen, currentStepIndex, activeSteps, shouldShowTour]);

  // Actions
  const nextStep = useCallback(() => { const next = currentStepIndex + 1; if (next < activeSteps.length) { setCurrentStepIndex(next); localStorage.setItem("divido.tour_step", String(next)); } else completeTour(); }, [activeSteps.length]);
  const prevStep = useCallback(() => { setCurrentStepIndex(Math.max(0, currentStepIndex - 1)); localStorage.setItem("divido.tour_step", String(Math.max(0, currentStepIndex - 1))); }, []);
  const completeTour = useCallback(() => { setCompletedThisSession(true); setIsOpen(false); localStorage.setItem("divido.tour_done", "true"); localStorage.removeItem("divido.tour_step"); localStorage.removeItem("divido.tour_dismissed"); }, []);
  const skipTour = useCallback(() => { setIsOpen(false); localStorage.setItem("divido.tour_dismissed", "true"); localStorage.removeItem("divido.tour_step"); }, []);
  const resetTour = useCallback(() => { localStorage.removeItem("divido.tour_done"); localStorage.removeItem("divido.tour_dismissed"); localStorage.removeItem("divido.tour_step"); setCurrentStepIndex(0); setIsOpen(true); setCompletedThisSession(false); evaluateAllSteps(); }, [evaluateAllSteps]);

  // Return API
  return { isOpen, currentStep: activeSteps[currentStepIndex] ?? null, currentStepIndex, activeSteps, totalSteps: activeSteps.length, nextStep, prevStep, skipTour, completeTour, resetTour, debugState, showDebug, setShowDebug };
}

const observerRef = { current: null as MutationObserver | null };
const mountedRef = { current: true };