import React, { useEffect, useRef, useState, useCallback } from "react";
import { useGuidedTour } from "../hooks/useGuidedTour";
import { SpotlightOverlay } from "./SpotlightOverlay";
import { GuidedTourTooltip } from "./GuidedTourTooltip";
import { getActiveSteps } from "../data/tourSteps.ts";

export function GuidedTour() {
  const {
    isActive,
    currentStep,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
    isLoading,
  } = useGuidedTour();

  const [activeSteps] = useState(getActiveSteps);
  const currentStepData = activeSteps[currentStep];
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);

  // Find target element
  useEffect(() => {
    if (!currentStepData) return;
    const el = document.querySelector(currentStepData.target) as HTMLElement | null;
    targetRef.current = el;
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [currentStepData]);

  // Update target rect on scroll/resize
  useEffect(() => {
    const updateRect = () => {
      if (targetRef.current) {
        setTargetRect(targetRef.current.getBoundingClientRect());
      }
    };

    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, []);

  const handleNext = useCallback(() => {
    const activeSteps = getActiveSteps();
    if (currentStep < activeSteps.length - 1) {
      nextStep();
    } else {
      completeTour();
    }
  }, [currentStep, nextStep, completeTour]);

  const handlePrev = useCallback(() => {
    prevStep();
  }, [prevStep]);

  const handleSkip = useCallback(() => {
    skipTour();
  }, [skipTour]);

  const handleClose = useCallback(() => {
    skipTour();
  }, [skipTour]);

  if (!isActive || isLoading || !currentStepData) return null;

  return (
    <>
      <div className="guided-tour-portal" role="dialog" aria-modal="true" aria-label="Tutorial guiado">
        <SpotlightOverlay
          targetRect={targetRect}
          radius={10}
        />

        {targetRect && (
          <GuidedTourTooltip
            step={currentStepData}
            targetRect={targetRect}
            onNext={handleNext}
            onPrev={handlePrev}
            onSkip={handleSkip}
            currentIndex={currentStep}
            totalSteps={activeSteps.length}
            onClose={handleClose}
          />
        )}
      </div>
    </>
  );
}