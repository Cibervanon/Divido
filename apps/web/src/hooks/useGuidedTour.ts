import { useState, useEffect, useCallback, useMemo } from "react";
import { TOUR_STEPS, getActiveSteps, TOUR_CONFIG } from "../data/tourSteps";

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

interface UseGuidedTourReturn {
  isOpen: boolean;
  currentStep: number;
  activeSteps: TourStep[];
  currentStepIndex: number;
  isLoading: boolean;
  debugState: TourDebugState;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  openTour: () => void;
  closeTour: () => void;
  showDebug: boolean;
  setShowDebug: (show: boolean) => void;
}

interface UseGuidedTourOptions {
  hasGroups: boolean;
  isPWA: boolean;
  inGroup: boolean;
}

export function useGuidedTour(options: UseGuidedTourOptions = { 
  hasGroups: false, 
  isPWA: false, 
  inGroup: false 
}): UseGuidedTourReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showDebug, setShowDebug] = useState(false);

  const activeSteps = useMemo(() => {
    return getActiveSteps({
      hasGroups: options.hasGroups,
      isPWA: options.isPWA,
      inGroup: options.inGroup,
    });
  }, [options.hasGroups, options.isPWA, options.inGroup]);

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_CONFIG.storageKey);
    const firstVisit = localStorage.getItem(TOUR_CONFIG.firstVisitKey);
    
    if (!completed && !firstVisit) {
      localStorage.setItem(TOUR_CONFIG.firstVisitKey, "true");
      setTimeout(() => {
        setIsOpen(true);
        setIsLoading(false);
      }, TOUR_CONFIG.autoStartDelay);
    } else {
      setIsLoading(false);
    }
  }, []);

  const openTour = useCallback(() => {
    setIsOpen(true);
    setCurrentStepIndex(0);
  }, []);

  const closeTour = useCallback(() => {
    setIsOpen(false);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStepIndex(prev => {
      const next = prev + 1;
      if (next >= activeSteps.length) {
        completeTour();
        return prev;
      }
      return next;
    });
  }, [activeSteps.length]);

  const prevStep = useCallback(() => {
    setCurrentStepIndex(prev => Math.max(0, prev - 1));
  }, []);

  const skipTour = useCallback(() => {
    localStorage.setItem(TOUR_CONFIG.storageKey, "true");
    setIsOpen(false);
  }, []);

  const completeTour = useCallback(() => {
    localStorage.setItem(TOUR_CONFIG.storageKey, "true");
    setIsOpen(false);
  }, []);

  const debugState: TourDebugState = useMemo(() => ({
    isOpen,
    currentStepIndex,
    activeStepsCount: activeSteps.length,
    activeStepsIds: activeSteps.map(s => s.id),
    hasEvaluated: true,
    allSteps: TOUR_STEPS,
  }), [isOpen, currentStepIndex, activeSteps]);

  return {
    isOpen,
    currentStep: currentStepIndex,
    activeSteps,
    currentStepIndex,
    isLoading,
    debugState,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
    openTour,
    closeTour,
    showDebug,
    setShowDebug,
  };
}