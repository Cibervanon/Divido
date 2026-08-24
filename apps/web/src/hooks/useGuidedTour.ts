import { useState, useEffect, useCallback } from "react";
import { getActiveSteps } from "../data/tourSteps";

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

export function useGuidedTour() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from localStorage
  useEffect(() => {
    const done = localStorage.getItem(TOUR_DONE_KEY) === "true";
    const dismissed = localStorage.getItem(TOUR_DISMISSED_KEY) === "true";
    const savedStep = parseInt(localStorage.getItem(TOUR_STEP_KEY) || "0", 10);

    if (done || dismissed) {
      setIsActive(false);
      setIsLoading(false);
      return;
    }

    const activeSteps = getActiveSteps();
    if (activeSteps.length === 0) {
      setIsActive(false);
      setIsLoading(false);
      return;
    }

    const validStep = Math.min(savedStep, activeSteps.length - 1);
    setCurrentStep(validStep);
    setIsActive(true);
    setIsLoading(false);
  }, []);

  const startTour = useCallback(() => {
    const activeSteps = getActiveSteps();
    if (activeSteps.length === 0) return;
    setCurrentStep(0);
    setIsActive(true);
    localStorage.removeItem(TOUR_DONE_KEY);
    localStorage.removeItem(TOUR_DISMISSED_KEY);
    localStorage.setItem(TOUR_STEP_KEY, "0");
  }, []);

  const nextStep = useCallback(() => {
    const activeSteps = getActiveSteps();
    setCurrentStep((prev) => {
      const next = Math.min(prev + 1, activeSteps.length - 1);
      localStorage.setItem(TOUR_STEP_KEY, String(next));
      return next;
    });
  }, []);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => {
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
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  return {
    isActive,
    currentStep,
    isLoading,
    startTour,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
    resetTour,
  };
}