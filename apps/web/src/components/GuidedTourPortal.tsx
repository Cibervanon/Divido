import { useEffect } from "react";
import { useGuidedTour } from "../hooks/useGuidedTour";
import { GuidedTour } from "./GuidedTour";

export function GuidedTourPortal() {
  const { isLoading, isActive } = useGuidedTour();

  // Auto-start tour on first visit (after auth)
  useEffect(() => {
    if (!isLoading) {
      // The tour auto-starts via useGuidedTour effect
    }
  }, []);

  return (
    <>
      {/* The GuidedTour component handles its own rendering when active */}
      <GuidedTour />
    </>
  );
}