import { useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    if (!targetRect) return;

    const tooltip = tooltipRef.current;
    if (!tooltip) return;

    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const gap = 16;
    const arrowSize = 12;

    let top = 0;
    let left = 0;
    let arrowPos: "top" | "bottom" | "left" | "right" = "bottom";

    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    // Try positions in order of preference
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

    // Fallback: center if nothing fits
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
  }, [targetRect]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onNext();
      else if (e.key === "ArrowLeft") onPrev();
      else if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onNext, onPrev, onClose]);

  return (
    <div
      ref={tooltipRef}
      className={`guided-tour-tooltip ${position}`}
      style={{ top: position.top, left: position.left }}
      role="dialog"
      aria-label={`Paso ${step.id}`}
      aria-describedby="guided-tour-content"
    >
      <div id="guided-tour-content">
        <h4>{step.title}</h4>
        <p dangerouslySetInnerHTML={{ __html: step.content }} />
      </div>

      <div className="guided-tour-footer">
        <div className="guided-tour-dots" aria-label="Progreso del tutorial">
          {Array.from({ length: totalSteps }, (_, i) => (
            <span
              key={i}
              aria-label={`Paso ${i + 1}`}
              className={`guided-tour-dot ${i === currentIndex ? "active" : ""}`}
            />
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          {currentIndex > 0 && (
            <button
              className="guided-tour-btn ghost"
              onClick={onPrev}
              aria-label="Paso anterior"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              <span style={{ marginLeft: 6 }}>Atrás</span>
            </button>
          )}

          <button
            className="guided-tour-btn primary"
            onClick={onNext}
            aria-label={currentIndex === totalSteps - 1 ? "Finalizar tutorial" : "Siguiente paso"}
          >
            {currentIndex === totalSteps - 1 ? "Finalizar" : "Siguiente"}
          </button>
        </div>
      </div>

      <button
        className="guided-tour-skip"
        onClick={onClose}
        aria-label="Saltar tutorial"
      >
        Saltar
      </button>
    </div>
  );
}