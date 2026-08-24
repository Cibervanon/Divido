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

type TourStatus = "idle" | "evaluating" | "ready" | "active" | "completed" | "dismissed";

interface StepStatus {
  step: TourStep;
  isSkipped: boolean;
  targetExists: boolean;
  targetElement: HTMLElement | null;
}

export function useGuidedTour() {
  const [status, setStatus] = useState<TourStatus>("idle");
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>([]);
  const [hasGroups, setHasGroups] = useState(false);
  const [dashboardReady, setDashboardReady] = useState(false);

  const observerRef = useRef<MutationObserver | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const evaluationCountRef = useRef(0);

  // Evaluate all skipIf functions and find target elements
  const evaluateSteps = useCallback((): StepStatus[] => {
    evaluationCountRef.current += 1;
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

  // Get the current step status
  const currentStepStatus = stepStatuses[currentStepIndex];
  const currentStep = currentStepStatus?.step ?? null;
  const isActive = status === "active";
  const isLoading = status === "idle" || status === "evaluating";
  const isReady = status === "ready" || status === "active";

  // Check if user has groups - directly query DOM for reactivity
  const checkHasGroups = useCallback(() => {
    const cards = document.querySelectorAll(".group");
    const has = cards.length > 0;
    setHasGroups(has);
    return has;
  }, []);

  // Check if dashboard is ready (not loading, not error)
  const checkDashboardReady = useCallback(() => {
    const loading = document.querySelector(".animate-spin") !== null;
    const error = document.querySelector("[class*='bg-rose-500']") !== null;
    const ready = !loading && !error;
    setDashboardReady(ready);
    return ready;
  }, []);

  // Initialize tour system - evaluate steps continuously
  useEffect(() => {
    const initialEval = evaluateSteps();
    setStepStatuses(initialEval);
    checkHasGroups();
    checkDashboardReady();
    setStatus("evaluating");

    // Setup MutationObserver to re-evaluate when DOM changes
    observerRef.current = new MutationObserver(() => {
      setStepStatuses(evaluateSteps());
      checkHasGroups();
      checkDashboardReady();
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
      checkHasGroups();
      checkDashboardReady();
      pollTimeoutRef.current = setTimeout(poll, 1000);
    };
    pollTimeoutRef.current = setTimeout(poll, 1000);

    return () => {
      observerRef.current?.disconnect();
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, [evaluateSteps, checkHasGroups, checkDashboardReady]);

  // State machine: transition from evaluating -> ready when conditions met
  useEffect(() => {
    if (status !== "evaluating") return;

    const done = localStorage.getItem(TOUR_DONE_KEY) === "true";
    const dismissed = localStorage.getItem(TOUR_DISMISSED_KEY) === "true";

    if (done || dismissed) {
      setStatus(done ? "completed" : "dismissed");
      return;
    }

    // Wait for: dashboard ready + at least one active step with existing target
    if (dashboardReady && activeSteps.length > 0 && activeSteps[0] && stepStatuses[0]?.targetExists) {
      setStatus("ready");
    }
  }, [status, dashboardReady, activeSteps.length, stepStatuses]);

  // Auto-start when ready
  useEffect(() => {
    if (status !== "ready") return;

    const firstRun = localStorage.getItem("divido.tour_first_run") !== "false";
    const shouldAutoStart = !hasGroups || firstRun;

    if (!shouldAutoStart) {
      // User has groups and not first run -> don't auto-start
      setStatus("dismissed");
      return;
    }

    // Auto-start
    if (firstRun) {
      localStorage.setItem("divido.tour_first_run", "false");
    }
    setCurrentStepIndex(0);
    setStatus("active");
    localStorage.setItem(TOUR_STEP_KEY, "0");
  }, [status, hasGroups, activeSteps]);

  // Auto-advance when current step becomes skipped or target disappears
  useEffect(() => {
    if (!isActive || activeSteps.length === 0) return;

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
  }, [activeSteps, currentStepIndex, isActive, stepStatuses]);

  // Persist step changes
  useEffect(() => {
    if (isActive) {
      localStorage.setItem(TOUR_STEP_KEY, String(currentStepIndex));
    }
  }, [currentStepIndex, isActive]);

  const startTour = useCallback(() => {
    const steps = evaluateSteps().filter((s) => !s.isSkipped).map((s) => s.step);
    if (steps.length === 0) return;
    setCurrentStepIndex(0);
    setStatus("active");
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
    setStatus("dismissed");
    localStorage.setItem(TOUR_DISMISSED_KEY, "true");
    localStorage.removeItem(TOUR_STEP_KEY);
  }, []);

  const completeTour = useCallback(() => {
    setStatus("completed");
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
    setStepStatuses(evaluateSteps());
    checkHasGroups();
    checkDashboardReady();
    setStatus("evaluating");
  }, [evaluateSteps]);

  return {
    // State
    status,
    isActive,
    isLoading,
    isReady,
    currentStep,
    currentStepIndex,
    activeSteps,
    stepStatuses,
    hasGroups,
    dashboardReady,
    // Actions
    startTour,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
    resetTour,
  };
}