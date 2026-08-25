import { createContext, useContext, useState, ReactNode, Dispatch, SetStateAction } from "react";
import { useGuidedTour } from "../hooks/useGuidedTour";
import { GuidedTour } from "./GuidedTour";

interface TourOptions {
  hasGroups: boolean;
  isPWA: boolean;
  inGroup: boolean;
}

const TourOptionsContext = createContext<TourOptions>({
  hasGroups: false,
  isPWA: false,
  inGroup: false,
});

const TourOptionsSetterContext = createContext<Dispatch<SetStateAction<TourOptions>> | null>(null);

const GuidedTourContext = createContext<ReturnType<typeof useGuidedTour> | null>(null);

export function GuidedTourProviderWithSetter({ children }: { children?: ReactNode }) {
  const [options, setOptions] = useState<TourOptions>({
    hasGroups: false,
    isPWA: false,
    inGroup: false,
  });

  const tour = useGuidedTour(options);

  return (
    <TourOptionsContext.Provider value={options}>
      <TourOptionsSetterContext.Provider value={setOptions}>
        <GuidedTourContext.Provider value={tour}>
          {children}
          <GuidedTour />
        </GuidedTourContext.Provider>
      </TourOptionsSetterContext.Provider>
    </TourOptionsContext.Provider>
  );
}

export function useTourOptions() {
  const ctx = useContext(TourOptionsContext);
  if (!ctx) {
    throw new Error("useTourOptions must be used within GuidedTourProviderWithSetter");
  }
  return ctx;
}

export function useTourOptionsSetter() {
  const setter = useContext(TourOptionsSetterContext);
  if (!setter) {
    throw new Error("useTourOptionsSetter must be used within GuidedTourProviderWithSetter");
  }
  return setter;
}

export function useGuidedTourContext() {
  const ctx = useContext(GuidedTourContext);
  if (!ctx) {
    throw new Error("useGuidedTourContext must be used within GuidedTourProviderWithSetter");
  }
  return ctx;
}