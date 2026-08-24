import { useGuidedTour } from "../hooks/useGuidedTour";
import { GuidedTour } from "./GuidedTour";

export function GuidedTourPortal() {
  useGuidedTour(); // Initialize the tour system

  return (
    <>
      {/* The GuidedTour component handles its own rendering when active */}
      <GuidedTour />
    </>
  );
}