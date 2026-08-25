import { useEffect, useRef, useState, useCallback } from "react";
import { TourStep } from "../hooks/useGuidedTour";
import "../styles/guidedTour.css";

interface GuidedTourTooltipProps {
  step: TourStep;
  targetRect: DOMRect | null;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  currentIndex: number;
  totalSteps: number;
  onClose: () => void;
}

export function GuidedTourTooltip({
  step,
  targetRect,
  onNext,
  onPrev,
  onSkip,
  currentIndex,
  totalSteps,
  onClose,
}: GuidedTourTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [arrowPosition, setArrowPosition] = useState<"top" | "bottom" | "left" | "right">("bottom");
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;

    // Force reflow for animation
    tooltip.style.opacity = "0";
    tooltip.style.transform = "translateY(8px) scale(0.98)";

    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = 0;
    let left = 0;
    let arrowPos: "top" | "bottom" | "left" | "right" = "bottom";

    if (targetRect) {
      // Try positions in order of preference based on step.position
      const positions: Array<{ pos: "top" | "bottom" | "left" | "right"; calc: () => { top: number; left: number } }> = [
        {
          pos: "bottom",
          calc: () => ({
            top: targetRect.bottom + 12,
            left: targetRect.left + targetRect.width / 2 - tooltipRect.width / 2,
          }),
        },
        {
          pos: "top",
          calc: () => ({
            top: targetRect.top - tooltipRect.height - 12,
            left: targetRect.left + targetRect.width / 2 - tooltipRect.width / 2,
          }),
        },
        {
          pos: "right",
          calc: () => ({
            top: targetRect.top + targetRect.height / 2 - tooltipRect.height / 2,
            left: targetRect.right + 12,
          }),
        },
        {
          pos: "left",
          calc: () => ({
            top: targetRect.top + targetRect.height / 2 - tooltipRect.height / 2,
            left: targetRect.left - tooltipRect.width - 12,
          }),
        },
      ];

      // If step has a preferred position, try it first
      const preferredIndex = positions.findIndex(p => p.pos === step.position);
      if (preferredIndex > 0) {
        const [preferred] = positions.splice(preferredIndex, 1);
        positions.unshift(preferred);
      }

      for (const { pos, calc } of positions) {
        const coords = calc();
        const fits =
          coords.top >= 8 &&
          coords.left >= 8 &&
          coords.top + tooltipRect.height <= viewportHeight - 8 &&
          coords.left + tooltipRect.width <= viewportWidth - 8;

        if (fits) {
          top = coords.top;
          left = coords.left;
          arrowPos = pos;
          break;
        }
      }
    }

    // Fallback: center if no targetRect or nothing fits
    if (top === 0 && left === 0) {
      top = viewportHeight / 2 - tooltipRect.height / 2;
      left = viewportWidth / 2 - tooltipRect.width / 2;
      arrowPos = "bottom";
    }

    // Clamp to viewport
    top = Math.max(8, Math.min(top, viewportHeight - tooltipRect.height - 8));
    left = Math.max(8, Math.min(left, viewportWidth - tooltipRect.width - 8));

    setPosition({ top, left });
    setArrowPosition(arrowPos);

    // Animate in
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, [targetRect, step.position]);

  const progress = ((currentIndex + 1) / totalSteps) * 100;

  return (
    <div
      ref={tooltipRef}
      className={`guided-tour-tooltip ${arrowPosition} ${isVisible ? "visible" : ""}`}
      style={{ top: position.top, left: position.left }}
      role="dialog"
      aria-label={`Paso ${currentIndex + 1} de ${totalSteps}: ${step.title}`}
      aria-describedby="guided-tour-content"
    >
      {/* Progress bar */}
      <div className="guided-tour-progress" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
        <div className="guided-tour-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div id="guided-tour-content" className="guided-tour-content">
        <div className="guided-tour-header">
          <h4 className="guided-tour-title">{step.title}</h4>
          <span className="guided-tour-step-counter">{currentIndex + 1} / {totalSteps}</span>
        </div>
        <div className="guided-tour-body" dangerouslySetInnerHTML={{ __html: step.content }} />
      </div>

      <div className="guided-tour-footer">
        <div className="guided-tour-nav">
          {currentIndex > 0 && (
            <button
              className="guided-tour-btn guided-tour-btn-ghost"
              onClick={onPrev}
              aria-label="Paso anterior"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              <span>Atrás</span>
            </button>
          )}

          <button
            className={`guided-tour-btn guided-tour-btn-primary ${currentIndex === totalSteps - 1 ? "final-step" : ""}`}
            onClick={onNext}
            aria-label={currentIndex === totalSteps - 1 ? "Finalizar tutorial" : "Siguiente paso"}
          >
            {currentIndex === totalSteps - 1 ? "Finalizar" : "Siguiente"}
            {currentIndex < totalSteps - 1 && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            )}
          </button>
        </div>

        <button
          className="guided-tour-skip"
          onClick={onClose}
          aria-label="Saltar tutorial"
        >
          Saltar
        </button>
      </div>

      <div className="guided-tour-arrow" data-position={arrowPosition} />
    </div>
  );
}