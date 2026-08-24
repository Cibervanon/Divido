import { useAuth } from "../lib/auth";
import { HelpModal } from "./HelpModal";
import { Button } from "./ui";

export function HelpButton() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <HelpButtonInternal />
  );
}

function HelpButtonInternal() {
  const { showHelpModal } = useHelpModal();
  return (
    <button
      type="button"
      onClick={() => showHelpModal()}
      className="touch-manipulation rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
      aria-label="Ayuda"
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.778-2 1.748 0 3.41.826 4.5 2.082C21 7.892 21 12 21 12s0 4.108-3.238 5.082c-1.09 1.148-2.76 2.082-4.5 2.082-1.748 0-3.41-.826-4.5-2.082C4.755 16.108 4.755 11.892 4.755 11.892s0-4.108 3.238-5.082z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>
  );
}

// Simple context for showing help modal across the app
import { createContext, useContext, useState, ReactNode } from "react";

interface HelpModalContextValue {
  showHelpModal: () => void;
}

const HelpModalContext = createContext<{ showHelpModal: () => void } | null>(null);

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const [showHelp, setShowHelp] = useState(false);
  return (
    <HelpModalContext.Provider value={{ showHelpModal: () => setShowHelp(true) }}>
      {children}
      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />
    </HelpModalContext.Provider>
  );
}

export function useHelpModal() {
  const ctx = useContext(HelpModalContext);
  if (!ctx) throw new Error("useHelpModal must be used within HelpProvider");
  return ctx;
}