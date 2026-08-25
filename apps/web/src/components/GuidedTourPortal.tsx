import { createContext, useContext } from "react";
import { useGuidedTour } from "../hooks/useGuidedTour";
import { GuidedTour } from "./GuidedTour";

const GuidedTourContext = createContext<ReturnType<typeof useGuidedTour> | null>(null);

export function GuidedTourProvider({ children }: { children?: React.ReactNode }) {
  const tour = useGuidedTour();

  return (
    <GuidedTourContext.Provider value={tour}>
      {children}
      <GuidedTour />
    </GuidedTourContext.Provider>
  );
}

export function useGuidedTourContext() {
  const ctx = useContext(GuidedTourContext);
  if (!ctx) {
    throw new Error("useGuidedTourContext must be used within GuidedTourProvider");
  }
  return ctx;
}