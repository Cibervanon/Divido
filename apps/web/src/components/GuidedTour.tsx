import React, { useEffect, useRef, useState, useCallback } from "react";
import { useGuidedTour } from "../hooks/useGuidedTour";
import { SpotlightOverlay } from "./SpotlightOverlay";
import { GuidedTourTooltip } from "./GuidedTourTooltip";

export function GuidedTour() {
  const {
    isOpen,
    currentStep,
    currentStepIndex,
    activeSteps,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
  } = useGuidedTour();

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);

  // Find target element for current step
  useEffect(() => {
    if (!currentStep) {
      setTargetRect(null);
      targetRef.current = null;
      return;
    }

    const el = document.querySelector(currentStep.target) as HTMLElement | null;
    targetRef.current = el;

    if (el) {
      console.log('[Tour] Found target for step', currentStep.id, ':', currentStep.target, el);
      setTargetRect(el.getBoundingClientRect());
    } else {
      console.warn('[Tour] Target NOT found for step', currentStep.id, ':', currentStep.target);
      setTargetRect(null);
    }
  }, [currentStep]);

  // Update rect on scroll/resize
  useEffect(() => {
    const updateRect = () => {
      if (targetRef.current) {
        setTargetRect(targetRef.current.getBoundingClientRect());
      }
    };
    window.addEventListener("scroll", updateRect, { passive: true });
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect);
      window.removeEventListener("resize", updateRect);
    };
  }, []);

  const handleNext = useCallback(() => nextStep(), [nextStep]);
  const handlePrev = useCallback(() => prevStep(), [prevStep]);
  const handleSkip = useCallback(() => skipTour(), [skipTour]);
  const handleClose = useCallback(() => skipTour(), [skipTour]);

  // Render nothing if not ready
  if (!isOpen) return null;
  if (!currentStep) return null;
  if (!targetRect) return null;

  console.log('[Tour] Rendering step:', currentStep.id, 'at', targetRect);

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