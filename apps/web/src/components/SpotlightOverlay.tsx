import { useEffect, useRef, useState } from "react";
import "../styles/guidedTour.css";

interface SpotlightOverlayProps {
  targetRect: DOMRect | null;
  radius?: number;
  onAnimationEnd?: () => void;
}

export function SpotlightOverlay({
  targetRect,
  radius = 10,
  onAnimationEnd,
}: SpotlightOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const prevRectRef = useRef<DOMRect | null>(null);

  useEffect(() => {
    if (!overlayRef.current || !targetRect) return;

    const overlay = overlayRef.current;
    const top = Math.max(0, targetRect.top - 4);
    const left = Math.max(0, targetRect.left - 4);
    const bottom = Math.max(0, window.innerHeight - targetRect.bottom - 4);
    const right = Math.max(0, window.innerWidth - targetRect.right - 4);

    // Set CSS custom properties for clip-path
    overlay.style.setProperty("--spotlight-top", `${top}px`);
    overlay.style.setProperty("--spotlight-right", `${right}px`);
    overlay.style.setProperty("--spotlight-bottom", `${bottom}px`);
    overlay.style.setProperty("--spotlight-left", `${left}px`);
    overlay.style.setProperty("--spotlight-radius", `${radius}px`);

    // Trigger animation
    requestAnimationFrame(() => {
      overlay.classList.add("has-target");
    });

    prevRectRef.current = targetRect;
  }, [targetRect, radius]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (overlayRef.current) {
        overlayRef.current.classList.remove("has-target");
      }
    };
  }, []);

  if (!targetRect) return null;

  return (
    <div
      ref={overlayRef}
      className="spotlight-overlay"
      aria-hidden="true"
    />
  );
}