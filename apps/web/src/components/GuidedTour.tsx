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
    isReady,
    activeSteps,
    stepStatuses,
  } = useGuidedTour();

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);

  // Update target rect when current step status changes
  useEffect(() => {
    if (!currentStep) return;

    const currentStatus = stepStatuses[currentStepIndex];
    const el = currentStatus?.targetElement ?? null;
    targetRef.current = el;

    if (el) {
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [currentStep, currentStepIndex, stepStatuses]);

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

  // Wait for: not loading, system ready, tour active, current step exists, target rect available
  if (isLoading || !isReady || !isActive || !currentStep || !targetRect) return null;

  return (
    <>
      <div className="guided-tour-portal" role="dialog" aria-modal="true" aria-label="Tutorial guiado">
        <SpotlightOverlay
          targetRect={targetRect}
          radius={10}
        />

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
      </div>
    </>
  );
}