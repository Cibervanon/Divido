import React, { useEffect, useRef, useState, useCallback } from "react";
import { useGuidedTour } from "../hooks/useGuidedTour";
import { SpotlightOverlay } from "./SpotlightOverlay";
import { GuidedTourTooltip } from "./GuidedTourTooltip";

export function GuidedTour() {
  const {
    isActive,
    currentStep,
    currentStepIndex,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
    isLoading,
    activeSteps,
  } = useGuidedTour();

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);

  // Find target element
  useEffect(() => {
    if (!currentStep) return;
    const el = document.querySelector(currentStep.target) as HTMLElement | null;
    targetRef.current = el;
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [currentStep]);

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
    nextStep();
  }, [nextStep]);

  const handlePrev = useCallback(() => {
    prevStep();
  }, [prevStep]);

  const handleSkip = useCallback(() => {
    skipTour();
  }, [skipTour]);

  const handleClose = useCallback(() => {
    skipTour();
  }, [skipTour]);

  if (!isActive || isLoading || !currentStep) return null;

  return (
    <>
      <div className="guided-tour-portal" role="dialog" aria-modal="true" aria-label="Tutorial guiado">
        <SpotlightOverlay
          targetRect={targetRect}
          radius={10}
        />

        {targetRect && (
          <GuidedTourTooltip
            step={currentStep}
            targetRect={targetRect}
            onNext={handleNext}
            onPrev={handlePrev}
            onSkip={handleSkip}
            currentIndex={currentStepIndex}
            totalSteps={activeSteps.length}
            onClose={handleClose}
          />
        )}
      </div>
    </>
  );
}