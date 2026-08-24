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
const TOUR_FIRST_VISIT_KEY = "divido.tour_first_visit";

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
  const [showDebug, setShowDebug] = useState(false);

  // Refs
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const mountedRef = useRef(true);

  // Auto-clear localStorage on FIRST VISIT ever (prevents stale done/dismissed blocking)
  useEffect(() => {
    const firstVisit = localStorage.getItem(TOUR_FIRST_VISIT_KEY) !== "false";
    if (firstVisit) {
      console.log('[Tour] FIRST VISIT - clearing stale tour state');
      localStorage.removeItem(TOUR_DONE_KEY);
      localStorage.removeItem(TOUR_DISMISSED_KEY);
      localStorage.removeItem(TOUR_STEP_KEY);
      localStorage.setItem(TOUR_FIRST_VISIT_KEY, "false");
    }
  }, []);

  // Simple step evaluator
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
    const debugMsg = newSteps.map(s => 
      `${s.step.id}: target="${s.step.target}" skipped=${s.skipped} element=${!!s.element}`
    ).join(" | ");
    console.log('[Tour] EVAL:', debugMsg);
  }, []);

  // Get active (non-skipped) steps with existing elements
  const activeSteps = useMemo(() => 
    steps.filter(s => !s.skipped && s.element).map(s => s.step),
    [steps]
  );

  const currentStep = activeSteps[currentStepIndex] ?? null;

  // Check if tour should be shown (respects done/dismissed)
  const shouldShowTour = useMemo(() => {
    const done = localStorage.getItem(TOUR_DONE_KEY) === "true";
    const dismissed = localStorage.getItem(TOUR_DISMISSED_KEY) === "true";
    if (done || dismissed) return false;
    return activeSteps.length > 0;
  }, [activeSteps.length]);

  // Initialize: evaluate steps continuously
  useEffect(() => {
    mountedRef.current = true;
    console.log('[Tour] INIT - starting polling');
    
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
      console.log('[Tour] MutationObserver attached');
    } catch (e) {
      console.warn('[Tour] MutationObserver failed:', e);
    }

    return () => {
      mountedRef.current = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      observerRef.current?.disconnect();
    };
  }, [evaluateAllSteps]);

  // Auto-open logic: aggressive - open immediately when first active step has element
  useEffect(() => {
    if (!hasEvaluated) return;
    if (isOpen) return;
    if (!shouldShowTour) {
      console.log('[Tour] shouldShowTour=false (done/dismissed or no active steps)');
      return;
    }

    console.log('[Tour] Checking auto-open:', {
      activeStepsCount: activeSteps.length,
      firstStep: activeSteps[0]?.id,
      firstStepElement: steps.find(s => s.step === activeSteps[0])?.element,
      shouldShowTour
    });

    // Open immediately if we have any active step with element
    if (activeSteps.length > 0) {
      const firstActive = activeSteps[0];
      const firstStepInfo = steps.find(s => s.step === firstActive);
      if (firstStepInfo?.element) {
        console.log('[Tour] AUTO-OPENING at step:', firstActive.id);
        setCurrentStepIndex(0);
        setIsOpen(true);
        localStorage.setItem("divido.tour_step", "0");
      } else {
        console.log('[Tour] First active step has no element yet:', firstActive.id);
      }
    } else {
      console.log('[Tour] No active steps available');
    }
  }, [hasEvaluated, activeSteps, steps, shouldShowTour, isOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't interfere with input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === 'd' || e.key === 'D') {
        setShowDebug(!showDebug);
      }
      if (e.key === 't' || e.key === 'T') {
        console.log('[Tour] Manual trigger via T key');
        if (activeSteps.length > 0) {
          setCurrentStepIndex(0);
          setIsOpen(true);
        } else {
          console.log('[Tour] Manual trigger failed - no active steps');
        }
      }
      if (e.key === 'r' || e.key === 'R') {
        console.log('[Tour] Manual reset via R key');
        localStorage.removeItem(TOUR_DONE_KEY);
        localStorage.removeItem(TOUR_DISMISSED_KEY);
        localStorage.removeItem("divido.tour_step");
        evaluateAllSteps();
        setTimeout(() => {
          if (activeSteps.length > 0) {
            setCurrentStepIndex(0);
            setIsOpen(true);
          }
        }, 100);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeSteps, evaluateAllSteps, showDebug]);

  // Persist step changes
  useEffect(() => {
    if (isOpen) {
      localStorage.setItem("divido.tour_step", String(currentStepIndex));
    }
  }, [currentStepIndex, isOpen]);

  // Debug panel state
  const debugState = useMemo(() => ({
    isOpen,
    currentStepIndex,
    activeStepsCount: activeSteps.length,
    activeStepsIds: activeSteps.map(s => s.id),
    allSteps: steps.map(s => ({
      id: s.step.id,
      target: s.step.target,
      skipped: s.skipped,
      hasElement: !!s.element
    })),
    shouldShowTour,
    hasEvaluated
  }), [isOpen, currentStepIndex, activeSteps, steps, shouldShowTour, hasEvaluated]);

  // Actions
  const nextStep = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < activeSteps.length) {
      setCurrentStepIndex(nextIndex);
      localStorage.setItem("divido.tour_step", String(nextIndex));
    } else {
      completeTour();
    }
  }, [currentStepIndex, activeSteps.length]);

  const prevStep = useCallback(() => {
    const prevIndex = Math.max(0, currentStepIndex - 1);
    setCurrentStepIndex(prevIndex);
    localStorage.setItem("divido.tour_step", String(prevIndex));
  }, [currentStepIndex]);

  const completeTour = useCallback(() => {
    setIsOpen(false);
    localStorage.setItem(TOUR_DONE_KEY, "true");
    localStorage.removeItem("divido.tour_step");
    localStorage.removeItem(TOUR_DISMISSED_KEY);
    console.log('[Tour] Completed');
  }, []);

  const skipTour = useCallback(() => {
    setIsOpen(false);
    localStorage.setItem(TOUR_DISMISSED_KEY, "true");
    localStorage.removeItem("divido.tour_step");
    console.log('[Tour] Skipped');
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem(TOUR_DONE_KEY);
    localStorage.removeItem(TOUR_DISMISSED_KEY);
    localStorage.removeItem("divido.tour_step");
    setCurrentStepIndex(0);
    setIsOpen(true);
    evaluateAllSteps();
    console.log('[Tour] Reset');
  }, [evaluateAllSteps]);

  return {
    isOpen,
    currentStep: activeSteps[currentStepIndex] ?? null,
    currentStepIndex,
    activeSteps,
    totalSteps: activeSteps.length,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
    resetTour,
    debugState,
    showDebug,
    setShowDebug,
  };
}

// Refs
const pollTimerRef = { current: null as ReturnType<typeof setInterval> | null };
const observerRef = { current: null as MutationObserver | null };
const mountedRef = { current: true };