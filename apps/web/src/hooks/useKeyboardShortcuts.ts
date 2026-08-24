import { useEffect, useCallback } from "react";

interface ShortcutHandler {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  handler: () => void;
  description?: string;
}

export function useKeyboardShortcuts(shortcuts: ShortcutHandler[], enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      // No activar si el usuario está escribiendo en un input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        // Permitir Escape siempre
        if (e.key !== "Escape") return;
      }

      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = !!shortcut.ctrlKey === (e.ctrlKey || e.metaKey);
        const shiftMatch = !!shortcut.shiftKey === e.shiftKey;
        const altMatch = !!shortcut.altKey === e.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault();
          shortcut.handler();
          break;
        }
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [shortcuts, enabled]);
}

// Shortcuts comunes predefinidos
export const commonShortcuts = {
  newExpense: (handler: () => void) => ({ key: "n", handler, description: "Nuevo gasto" }),
  search: (handler: () => void) => ({ key: "/", handler, description: "Buscar" }),
  closeModal: (handler: () => void) => ({ key: "Escape", handler, description: "Cerrar modal" }),
};