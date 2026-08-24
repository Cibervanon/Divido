import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
const TOUR_FIRST_RUN_KEY = "divido.tour_first_run";

interface StepStatus {
  step: TourStep;
  isSkipped: boolean;
  targetExists: boolean;
  targetElement: HTMLElement | null;
}

export function useGuidedTour() {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false); // Tour system fully initialized
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>([]);

  const observerRef = useRef<MutationObserver | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasStartedRef = useRef(false);

  // Evaluate all skipIf functions and find target elements
  const evaluateSteps = useCallback((): StepStatus[] => {
    return tourSteps.map((step) => {
      const targetEl = document.querySelector(step.target) as HTMLElement | null;
      const targetExists = !!targetEl;
      let isSkipped = false;

      if (step.skipIf) {
        try {
          isSkipped = step.skipIf();
        } catch {
          isSkipped = false;
        }
      }

      // If target doesn't exist but skipIf says don't skip, we still consider it "not ready"
      // The step will be skipped only if skipIf explicitly returns true
      return {
        step,
        isSkipped,
        targetExists,
        targetElement: targetEl,
      };
    });
  }, []);

  // Get active (non-skipped) steps in order
  const activeSteps = useMemo(() => {
    return stepStatuses
      .filter((s) => !s.isSkipped)
      .map((s) => s.step);
  }, [stepStatuses]);

  // Get the current step status
  const currentStepStatus = stepStatuses[currentStepIndex];
  const currentStep = currentStepStatus?.step ?? null;

  // Initialize tour system (evaluate steps, setup observer)
  useEffect(() => {
    // Initial evaluation
    setStepStatuses(evaluateSteps());
    setIsReady(true);

    // Setup MutationObserver to re-evaluate when DOM changes
    observerRef.current = new MutationObserver(() => {
      setStepStatuses(evaluateSteps());
    });
    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "data-tour"],
    });

    // Also poll periodically as fallback (some frameworks don't trigger MutationObserver reliably)
    const poll = () => {
      setStepStatuses(evaluateSteps());
      pollTimeoutRef.current = setTimeout(poll, 1000);
    };
    pollTimeoutRef.current = setTimeout(poll, 1000);

    return () => {
      observerRef.current?.disconnect();
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, [evaluateSteps]);

  // Auto-start logic: wait for isReady, first run, and at least one active step
  useEffect(() => {
    if (!isReady || hasStartedRef.current) return;

    const done = localStorage.getItem(TOUR_DONE_KEY) === "true";
    const dismissed = localStorage.getItem(TOUR_DISMISSED_KEY) === "true";
    const firstRun = localStorage.getItem(TOUR_FIRST_RUN_KEY) !== "false";

    if (done || dismissed) {
      setIsActive(false);
      setIsLoading(false);
      hasStartedRef.current = true;
      return;
    }

    if (activeSteps.length === 0) {
      // No steps available yet - wait for targets to appear
      // Don't set hasStartedRef.current = true, allow re-check
      return;
    }

    // First run: auto-start
    if (firstRun) {
      localStorage.setItem(TOUR_FIRST_RUN_KEY, "false");
      setCurrentStepIndex(0);
      setIsActive(true);
      localStorage.setItem(TOUR_STEP_KEY, "0");
      setIsLoading(false);
      hasStartedRef.current = true;
      return;
    }

    // Returning user: restore saved step if valid
    const savedStep = parseInt(localStorage.getItem(TOUR_STEP_KEY) || "0", 10);
    const validStep = Math.min(savedStep, activeSteps.length - 1);
    setCurrentStepIndex(validStep);
    setIsActive(true);
    setIsLoading(false);
    hasStartedRef.current = true;
  }, [isReady, activeSteps.length]);

  // Auto-advance if current step becomes skipped or target disappears
  useEffect(() => {
    if (!isActive || !isReady || activeSteps.length === 0) return;

    const currentStatus = stepStatuses[currentStepIndex];
    if (!currentStatus) return;

    // If current step is now skipped or target vanished, advance
    if (currentStatus.isSkipped || !currentStatus.targetExists) {
      const nextIndex = Math.min(currentStepIndex + 1, activeSteps.length - 1);
      if (nextIndex !== currentStepIndex) {
        setCurrentStepIndex(nextIndex);
        localStorage.setItem(TOUR_STEP_KEY, String(nextIndex));
      } else if (nextIndex === currentStepIndex && nextIndex === activeSteps.length - 1) {
        completeTour();
      }
    }
  }, [activeSteps, currentStepIndex, isActive, isReady, stepStatuses]);

  const startTour = useCallback(() => {
    const steps = evaluateSteps().filter((s) => !s.isSkipped).map((s) => s.step);
    if (steps.length === 0) return;
    setCurrentStepIndex(0);
    setIsActive(true);
    localStorage.removeItem(TOUR_DONE_KEY);
    localStorage.removeItem(TOUR_DISMISSED_KEY);
    localStorage.setItem(TOUR_STEP_KEY, "0");
    localStorage.setItem(TOUR_FIRST_RUN_KEY, "false");
  }, [evaluateSteps]);

  const nextStep = useCallback(() => {
    setCurrentStepIndex((prev) => {
      const next = Math.min(prev + 1, activeSteps.length - 1);
      localStorage.setItem(TOUR_STEP_KEY, String(next));
      return next;
    });
  }, [activeSteps.length]);

  const prevStep = useCallback(() => {
    setCurrentStepIndex((prev) => {
      const prevStep = Math.max(prev - 1, 0);
      localStorage.setItem(TOUR_STEP_KEY, String(prevStep));
      return prevStep;
    });
  }, []);

  const skipTour = useCallback(() => {
    setIsActive(false);
    localStorage.setItem(TOUR_DISMISSED_KEY, "true");
    localStorage.removeItem(TOUR_STEP_KEY);
  }, []);

  const completeTour = useCallback(() => {
    setIsActive(false);
    localStorage.setItem(TOUR_DONE_KEY, "true");
    localStorage.removeItem(TOUR_STEP_KEY);
    localStorage.removeItem(TOUR_DISMISSED_KEY);
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem(TOUR_DONE_KEY);
    localStorage.removeItem(TOUR_STEP_KEY);
    localStorage.removeItem(TOUR_DISMISSED_KEY);
    localStorage.setItem(TOUR_FIRST_RUN_KEY, "true");
    hasStartedRef.current = false;
    setCurrentStepIndex(0);
    setIsActive(true);
    setIsLoading(true);
    setIsReady(false);
    // Re-evaluate steps
    setStepStatuses(evaluateSteps());
    setIsReady(true);
  }, [evaluateSteps]);

  return {
    isActive,
    currentStep,
    currentStepIndex,
    isLoading,
    isReady,
    activeSteps,
    stepStatuses,
    startTour,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
    resetTour,
  };
}