const TOKEN_KEY = "divido.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// URL base del backend. En local se deja vacío (usa el proxy de Vite).
// En Vercel se define la variable de entorno VITE_API_BASE, ej:
//   https://divido-433u.onrender.com
const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
  }
}

let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(fn: () => void): void {
  onUnauthorized = fn;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (options.body && typeof options.body === "string") {
    headers["Content-Type"] = "application/json";
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}`, { ...options, headers, cache: "no-store" });
  } catch {
    throw new ApiError("No se pudo conectar con el servidor", 0);
  }

  if (!res.ok) {
    let message = res.statusText || "Error";
    let code: string | undefined;
    try {
      const body = (await res.json()) as { error?: string; code?: string };
      message = body.error ?? message;
      code = body.code;
    } catch {
      // respuesta sin cuerpo JSON
    }
    if (res.status === 401) onUnauthorized?.();
    throw new ApiError(message, res.status, code);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
