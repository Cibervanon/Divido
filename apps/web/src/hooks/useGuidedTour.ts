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
  const [isReady, setIsReady] = useState(false);
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>([]);

  const observerRef = useRef<MutationObserver | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasEvaluatedOnceRef = useRef(false);

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

  // Check if user has any groups (for tour trigger logic)
  const hasGroups = useMemo(() => {
    const cards = document.querySelectorAll(".group-card");
    return cards.length > 0;
  }, [stepStatuses]); // Re-evaluate when stepStatuses changes

  // Get the current step status
  const currentStepStatus = stepStatuses[currentStepIndex];
  const currentStep = currentStepStatus?.step ?? null;

  // Initialize tour system (evaluate steps, setup observer)
  useEffect(() => {
    // Initial evaluation
    setStepStatuses(evaluateSteps());
    setIsReady(true);
    hasEvaluatedOnceRef.current = true;

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

    // Also poll periodically as fallback
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

  // Auto-start logic:
  // - If tour_done or tour_dismissed → never auto-start
  // - If user has NO groups → auto-start (shows "Crear grupo")
  // - If user has groups AND first run → auto-start (shows "Tus grupos")
  // - If returning user with saved step → restore
  useEffect(() => {
    if (!isReady || isActive) return;

    const done = localStorage.getItem(TOUR_DONE_KEY) === "true";
    const dismissed = localStorage.getItem(TOUR_DISMISSED_KEY) === "true";

    if (done || dismissed) {
      setIsActive(false);
      setIsLoading(false);
      return;
    }

    if (activeSteps.length === 0) {
      // No steps available yet - wait for targets to appear
      return;
    }

    // Determine if we should auto-start
    const firstRun = localStorage.getItem("divido.tour_first_run") !== "false";
    const shouldAutoStart = !hasGroups || firstRun;

    if (!shouldAutoStart) {
      // User has groups and not first run → don't auto-start
      setIsLoading(false);
      return;
    }

    // Auto-start
    if (firstRun) {
      localStorage.setItem("divido.tour_first_run", "false");
    }

    // If user has no groups, step 0 (dashboard-groups) is skipped, so start at step 1
    // But activeSteps already filters out skipped steps, so index 0 is correct
    setCurrentStepIndex(0);
    setIsActive(true);
    localStorage.setItem(TOUR_STEP_KEY, "0");
    setIsLoading(false);
  }, [isReady, activeSteps.length, hasGroups]);

  // Auto-advance if current step becomes skipped or target disappears
  useEffect(() => {
    if (!isActive || !isReady || activeSteps.length === 0) return;

    const currentStatus = stepStatuses[currentStepIndex];
    if (!currentStatus) return;

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
    localStorage.setItem("divido.tour_first_run", "false");
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
    localStorage.setItem("divido.tour_first_run", "true");
    setCurrentStepIndex(0);
    setIsActive(true);
    setIsLoading(true);
    setIsReady(false);
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