import React, { useEffect, useRef, useState, useCallback, useContext } from "react";
import { createPortal } from "react-dom";
import { useGuidedTourContext } from "./GuidedTourPortal";
import { SpotlightOverlay } from "./SpotlightOverlay";
import { GuidedTourTooltip } from "./GuidedTourTooltip";

export function GuidedTour() {
  const {
    isOpen,
    currentStepIndex,
    activeSteps,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
    openTour,
    debugState,
    showDebug,
    setShowDebug,
  } = useGuidedTourContext();

  const currentStep = activeSteps[currentStepIndex];
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);

  // Find target element for current step
  useEffect(() => {
    // Clean up previous target
    if (targetRef.current) {
      targetRef.current.classList.remove("guided-tour-target");
    }

    if (!currentStep) {
      setTargetRect(null);
      targetRef.current = null;
      return;
    }

    const el = document.querySelector(currentStep.target) as HTMLElement | null;
    targetRef.current = el;

    if (el) {
      el.classList.add("guided-tour-target");
      console.log('[Tour] Found target for step', currentStep.id, ':', currentStep.target, el);
      setTargetRect(el.getBoundingClientRect());
    } else {
      console.warn('[Tour] Target NOT found for step', currentStep.id, ':', currentStep.target);
      setTargetRect(null);
    }

    return () => {
      if (el) el.classList.remove("guided-tour-target");
    };
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

  // Handle next: on last step, call completeTour
  const handleNext = useCallback(() => {
    if (currentStepIndex === activeSteps.length - 1) {
      completeTour();
    } else {
      nextStep();
    }
  }, [currentStepIndex, activeSteps.length, nextStep, completeTour]);

  const handlePrev = useCallback(() => prevStep(), [prevStep]);
  const handleSkip = useCallback(() => skipTour(), [skipTour]);
  const handleClose = useCallback(() => skipTour(), [skipTour]);

  // Keyboard shortcuts: T to open tour, ? for help, arrows for navigation, R to reset
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case 't':
        case 'T':
          if (!isOpen) {
            e.preventDefault();
            openTour();
          }
          break;
        case '?':
          if (!isOpen) {
            e.preventDefault();
            openTour();
          }
          break;
        case 'r':
        case 'R':
          // Reset tour: clear localStorage and reopen
          e.preventDefault();
          localStorage.removeItem("divido.tour_completed");
          localStorage.removeItem("divido.tour_first_visit");
          openTour();
          break;
        case 'ArrowRight':
          if (isOpen) {
            e.preventDefault();
            handleNext();
          }
          break;
        case 'ArrowLeft':
          if (isOpen) {
            e.preventDefault();
            handlePrev();
          }
          break;
        case 'Escape':
          if (isOpen) {
            e.preventDefault();
            handleSkip();
          }
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, openTour, handleNext, handlePrev, handleSkip]);

  // Toggle debug with D key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') {
        if (e.ctrlKey || e.metaKey) return;
        setShowDebug(!showDebug);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showDebug]);

  // Render debug panel
  const debugPanel = showDebug ? (
    <div style={{
      position: 'fixed',
      bottom: 10,
      right: 10,
      zIndex: 999999,
      background: 'rgba(0,0,0,0.95)',
      color: '#0f0',
      padding: '12px',
      borderRadius: '8px',
      fontFamily: 'monospace',
      fontSize: '11px',
      maxWidth: '400px',
      maxHeight: '80vh',
      overflow: 'auto',
      border: '2px solid #0f0',
      boxShadow: '0 0 20px #0f0',
    }}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}>
        <strong>🔍 TOUR DEBUG</strong>
        <button onClick={()=>setShowDebug(false)} style={{background:'none',border:'none',color:'#0f0',cursor:'pointer'}}>✕</button>
      </div>
      <div>isOpen: {String(debugState.isOpen)}</div>
      <div>currentStepIndex: {debugState.currentStepIndex}</div>
      <div>activeStepsCount: {debugState.activeStepsCount}</div>
      <div>activeSteps: {debugState.activeStepsIds.join(', ') || 'none'}</div>
      <div>hasEvaluated: {String(debugState.hasEvaluated)}</div>
      <div style={{marginTop:'8px',borderTop:'1px solid #0f0',paddingTop:'8px'}}>
        <strong>All Steps:</strong>
        <pre style={{margin:'4px 0',whiteSpace:'pre-wrap'}}>{JSON.stringify(debugState.allSteps, null, 2)}</pre>
      </div>
      <div style={{marginTop:'8px',fontSize:'10px',color:'#8f8'}}>
        Teclas: T=abrir tour | R=reset | D=toggle debug
      </div>
    </div>
  ) : null;

  // Render nothing if not ready
  if (!isOpen) return debugPanel;
  if (!currentStep) return debugPanel;

  console.log('[Tour] Rendering step:', currentStep.id, 'targetRect:', targetRect);

  const content = (
    <>
      {debugPanel}
      <div className="guided-tour-portal" role="dialog" aria-modal="true" aria-label="Tutorial guiado">
        {targetRect && (
          <SpotlightOverlay
            targetRect={targetRect}
            radius={10}
          />
        )}

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

        {/* Skip banner at bottom */}
        <div className="guided-tour-skip-banner">
          <span>¿Quieres saltar el tutorial?</span>
          <button className="guided-tour-btn guided-tour-btn-ghost" onClick={handleSkip}>
            Saltar
          </button>
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
}