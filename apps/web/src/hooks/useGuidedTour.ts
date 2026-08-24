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

const TOUR_DONE_KEY = "divido.tour_done";
const TOUR_STEP_KEY = "divido.tour_step";
const TOUR_DISMISSED_KEY = "divido.tour_dismissed";

interface StepInfo {
  step: TourStep;
  element: HTMLElement | null;
  skipped: boolean;
}

export function useGuidedTour() {
  // Core state
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [steps, setSteps] = useState<StepInfo[]>([]);
  const [hasEvaluated, setHasEvaluated] = useState(false);

  // Refs for cleanup
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const mountedRef = useRef(true);

  // Simple step evaluator - runs synchronously, no complex memo
  const evaluateAllSteps = useCallback(() => {
    if (!mountedRef.current) return;
    
    const newSteps: StepInfo[] = tourSteps.map((step) => {
      let element: HTMLElement | null = null;
      let skipped = false;

      try {
        element = document.querySelector(step.target);
      } catch (e) {
        element = null;
      }

      if (step.skipIf) {
        try {
          skipped = step.skipIf();
        } catch (e) {
          skipped = false;
        }
      }

      return { step, element, skipped };
    });

    setSteps(newSteps);
    setHasEvaluated(true);
    
    // Debug logging
    console.log('[Tour] Evaluated steps:', newSteps.map(s => ({
      id: s.step.id,
      target: s.step.target,
      skipped: s.skipped,
      hasElement: !!s.element
    })));
  }, []);

  // Get active (non-skipped) steps with existing elements
  const activeSteps = useMemo(() => 
    steps.filter(s => !s.skipped && s.element).map(s => s.step),
    [steps]
  );

  const currentStep = activeSteps[currentStepIndex] ?? null;
  const currentStepInfo = steps.find(s => s.step === currentStep) ?? null;

  // Check if tour should be shown (respects done/dismissed)
  const shouldShowTour = useMemo(() => {
    if (localStorage.getItem(TOUR_DONE_KEY) === "true") return false;
    if (localStorage.getItem(TOUR_DISMISSED_KEY) === "true") return false;
    return activeSteps.length > 0;
  }, [activeSteps.length]);

  // Initialize: evaluate steps continuously until we have targets
  useEffect(() => {
    mountedRef.current = true;
    
    // Initial evaluation
    evaluateAllSteps();

    // Poll every 500ms - simple, reliable
    pollTimerRef.current = setInterval(() => {
      if (!mountedRef.current) return;
      evaluateAllSteps();
    }, 500);

    // MutationObserver as backup
    try {
      observerRef.current = new MutationObserver(() => {
        if (!mountedRef.current) return;
        evaluateAllSteps();
      });
      observerRef.current.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "data-tour", "style"],
      });
    } catch (e) {
      console.warn('[Tour] MutationObserver failed:', e);
    }

    return () => {
      mountedRef.current = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      observerRef.current?.disconnect();
    };
  }, [evaluateAllSteps]);

  // Auto-open logic: simple and direct
  useEffect(() => {
    if (!hasEvaluated) return;
    if (isOpen) return;
    if (!shouldShowTour) return;

    // Wait for first active step to have an element
    if (activeSteps.length > 0 && activeSteps[0]) {
      const firstStepInfo = steps.find(s => s.step === activeSteps[0]);
      if (firstStepInfo?.element) {
        console.log('[Tour] Auto-opening at step:', activeSteps[0].id);
        setCurrentStepIndex(0);
        setIsOpen(true);
        localStorage.setItem(TOUR_STEP_KEY, "0");
      }
    }
  }, [hasEvaluated, activeSteps, steps, shouldShowTour, isOpen]);

  // Advance to next valid step
  const nextStep = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < activeSteps.length) {
      setCurrentStepIndex(nextIndex);
      localStorage.setItem(TOUR_STEP_KEY, String(nextIndex));
    } else {
      completeTour();
    }
  }, [currentStepIndex, activeSteps.length]);

  const prevStep = useCallback(() => {
    const prevIndex = Math.max(0, currentStepIndex - 1);
    setCurrentStepIndex(prevIndex);
    localStorage.setItem(TOUR_STEP_KEY, String(prevIndex));
  }, [currentStepIndex]);

  const completeTour = useCallback(() => {
    setIsOpen(false);
    localStorage.setItem(TOUR_DONE_KEY, "true");
    localStorage.removeItem(TOUR_STEP_KEY);
    localStorage.removeItem(TOUR_DISMISSED_KEY);
    console.log('[Tour] Completed');
  }, []);

  const skipTour = useCallback(() => {
    setIsOpen(false);
    localStorage.setItem(TOUR_DISMISSED_KEY, "true");
    localStorage.removeItem(TOUR_STEP_KEY);
    console.log('[Tour] Skipped');
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem(TOUR_DONE_KEY);
    localStorage.removeItem(TOUR_STEP_KEY);
    localStorage.removeItem(TOUR_DISMISSED_KEY);
    setCurrentStepIndex(0);
    setIsOpen(true);
    evaluateAllSteps();
    console.log('[Tour] Reset');
  }, [evaluateAllSteps]);

  // Expose simple API
  return {
    isOpen,
    currentStep,
    currentStepIndex,
    activeSteps,
    totalSteps: activeSteps.length,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
    resetTour,
    // Debug
    debugSteps: steps,
  };
}