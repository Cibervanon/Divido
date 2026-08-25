import { useEffect, useRef } from "react";
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

  useEffect(() => {
    if (!overlayRef.current || !targetRect) return;

    const overlay = overlayRef.current;
    const top = targetRect.top - 4;
    const left = targetRect.left - 4;
    const width = targetRect.width + 8;
    const height = targetRect.height + 8;

    // Set position and size directly (not clip-path inset)
    overlay.style.top = `${top}px`;
    overlay.style.left = `${left}px`;
    overlay.style.width = `${width}px`;
    overlay.style.height = `${height}px`;
    overlay.style.setProperty("--spotlight-radius", `${radius}px`);

    // Trigger animation
    requestAnimationFrame(() => {
      overlay.classList.add("has-target");
    });
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