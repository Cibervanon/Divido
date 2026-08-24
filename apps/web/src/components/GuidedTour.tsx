import React, { useEffect, useRef, useState, useCallback } from "react";
import { useGuidedTour } from "../hooks/useGuidedTour";
import { SpotlightOverlay } from "./SpotlightOverlay";
import { GuidedTourTooltip } from "./GuidedTourTooltip";
import { GuidedTourDots } from "./GuidedTourDots";
import { getActiveSteps } from "../data/tourSteps";
import { TourStep } from "../hooks/useGuidedTour";

export function GuidedTour() {
  const {
    isActive,
    currentStep,
    startTour,
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

  if (!isActive || isLoading || !currentStepData) return null;

  const handleNext = useCallback(() => {
    const activeSteps = getActiveSteps();
    if (currentStep < activeSteps.length - 1) {
      nextStep();
    } else {
      completeTour();
    }
  }, [nextStep, completeTour]);

  const handlePrev = useCallback(() => {
    prevStep();
  }, [prevStep]);

  const handleSkip = useCallback(() => {
    skipTour();
  }, [skipTour]);

  const handleClose = useCallback(() => {
    skipTour();
  }, [skipTour]);

  return (
    <>
      <div className="guided-tour-portal" role="dialog" aria-modal="true" aria-label="Tutorial guiado">
        <SpotlightOverlay
          targetRect={targetRef.current?.getBoundingClientRect() ?? null}
          radius={10}
        />

        {targetRef.current && (
          <React.Fragment>
            <div
              className="guided-tour-target"
              style={{
                position: "relative",
                zIndex: 9998,
              }}
            >
              {targetRef.current ? <div dangerouslySetInnerHTML={{ __html: targetRef.current.outerHTML }} /> : null}
            </div>

            <GuidedTourTooltip
              step={currentStepData}
              targetRect={targetRef.current.getBoundingClientRect()}
              onNext={() => {
                const activeSteps = getActiveSteps();
                if (currentStep < activeSteps.length - 1) nextStep();
                else completeTour();
              }}
              onPrev={() => prevStep()}
              onSkip={() => skipTour()}
              currentIndex={currentStep}
              totalSteps={getActiveSteps().length}
              onClose={() => skipTour()}
            />
          </React.Fragment>
        )}

        <div className="guided-tour-skip-banner" role="status" aria-live="polite">
          <span>Tutorial en progreso</span>
          <button className="guided-tour-btn ghost" onClick={() => skipTour()}>
            Cerrar tutorial
          </button>
        </div>
      </div>
    </>
  );
}