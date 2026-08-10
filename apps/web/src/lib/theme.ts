export type ThemeId = "indigo" | "emerald" | "violet" | "rose" | "sky" | "amber";

export interface ThemeOption {
  id: ThemeId;
  name: string;
  swatch: string;
  accent: string;
  description: string;
}

export const THEMES: ThemeOption[] = [
  { id: "indigo", name: "Índigo", swatch: "#6366f1", accent: "#4f46e5", description: "Por defecto" },
  { id: "emerald", name: "Esmeralda", swatch: "#10b981", accent: "#059669", description: "Verde natural" },
  { id: "violet", name: "Violeta", swatch: "#8b5cf6", accent: "#7c3aed", description: "Morado intenso" },
  { id: "rose", name: "Rosa", swatch: "#f43f5e", accent: "#e11d48", description: "Cálido" },
  { id: "sky", name: "Cielo", swatch: "#0ea5e9", accent: "#0284c7", description: "Azul claro" },
  { id: "amber", name: "Ámbar", swatch: "#f59e0b", accent: "#d97706", description: "Dorado" },
];

const STORAGE_KEY = "divido-theme";

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEMES.some((t) => t.id === value);
}

export function getStoredTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isThemeId(stored)) return stored;
  } catch {
    // localStorage no disponible
  }
  return "indigo";
}

export function applyTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
}

export function setStoredTheme(id: ThemeId) {
  applyTheme(id);
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // localStorage no disponible
  }
}
