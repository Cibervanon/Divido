import { useState, useEffect, useCallback, useMemo } from "react";
import { tourSteps, getActiveSteps } from "../data/tourSteps.ts";

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

export function useGuidedTour() {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Compute active steps reactively (skipIf evaluated on each render)
  const activeSteps = useMemo(() => getActiveSteps(), []);

  // Initialize from localStorage
  useEffect(() => {
    const done = localStorage.getItem(TOUR_DONE_KEY) === "true";
    const dismissed = localStorage.getItem(TOUR_DISMISSED_KEY) === "true";
    const savedStep = parseInt(localStorage.getItem(TOUR_STEP_KEY) || "0", 10);
    const firstRun = localStorage.getItem(TOUR_FIRST_RUN_KEY) !== "false";

    // If tour was completed or explicitly dismissed, don't auto-start
    if (done || dismissed) {
      setIsActive(false);
      setIsLoading(false);
      return;
    }

    // If no active steps at all, don't start
    if (activeSteps.length === 0) {
      setIsActive(false);
      setIsLoading(false);
      return;
    }

    // First run: auto-start from step 0
    if (firstRun) {
      localStorage.setItem(TOUR_FIRST_RUN_KEY, "false");
      setCurrentStepIndex(0);
      setIsActive(true);
      localStorage.setItem(TOUR_STEP_KEY, "0");
      setIsLoading(false);
      return;
    }

    // Returning user with saved step: restore if valid
    const validStep = Math.min(savedStep, activeSteps.length - 1);
    setCurrentStepIndex(validStep);
    setIsActive(true);
    setIsLoading(false);
  }, [activeSteps.length]); // Re-run when active steps count changes

  // Auto-advance if current step becomes skipped (e.g., user navigated to page with target)
  useEffect(() => {
    if (!isActive || activeSteps.length === 0) return;

    const currentStep = activeSteps[currentStepIndex];
    if (currentStep && currentStep.skipIf && currentStep.skipIf()) {
      // Current step is now skipped, advance to next valid step
      const nextIndex = Math.min(currentStepIndex + 1, activeSteps.length - 1);
      if (nextIndex !== currentStepIndex) {
        setCurrentStepIndex(nextIndex);
        localStorage.setItem(TOUR_STEP_KEY, String(nextIndex));
      } else if (nextIndex === currentStepIndex && nextIndex === activeSteps.length - 1) {
        // Last step and it's skipped -> complete tour
        completeTour();
      }
    }
  }, [activeSteps, currentStepIndex, isActive]);

  const startTour = useCallback(() => {
    const steps = getActiveSteps();
    if (steps.length === 0) return;
    setCurrentStepIndex(0);
    setIsActive(true);
    localStorage.removeItem(TOUR_DONE_KEY);
    localStorage.removeItem(TOUR_DISMISSED_KEY);
    localStorage.setItem(TOUR_STEP_KEY, "0");
    localStorage.setItem(TOUR_FIRST_RUN_KEY, "false");
  }, []);

  const nextStep = useCallback(() => {
    const steps = getActiveSteps();
    setCurrentStepIndex((prev) => {
      const next = Math.min(prev + 1, steps.length - 1);
      localStorage.setItem(TOUR_STEP_KEY, String(next));
      return next;
    });
  }, []);

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
    setCurrentStepIndex(0);
    setIsActive(true);
  }, []);

  const currentStep = activeSteps[currentStepIndex];

  return {
    isActive,
    currentStep,
    currentStepIndex,
    isLoading,
    activeSteps,
    startTour,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
    resetTour,
  };
}