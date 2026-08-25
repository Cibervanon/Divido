import { useAuth } from "../lib/auth";
import { HelpModal } from "./HelpModal";
import { Button } from "./ui";
import { HelpCircle } from "lucide-react";

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
      data-tour="help-button"
    >
      <HelpCircle className="h-5 w-5" />
    </button>
  );
}

// Simple context for showing help modal across the app
import { createContext, useContext, useState, ReactNode } from "react";

interface HelpModalContextValue {
  showHelpModal: () => void;
  toggleHelpModal: () => void;
}

const HelpModalContext = createContext<HelpModalContextValue | null>(null);

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const [showHelp, setShowHelp] = useState(false);
  const toggleHelp = () => setShowHelp(prev => !prev);
  return (
    <HelpModalContext.Provider value={{ showHelpModal: () => setShowHelp(true), toggleHelpModal: toggleHelp }}>
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