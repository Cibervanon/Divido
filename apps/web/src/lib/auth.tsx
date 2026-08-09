import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, setOnUnauthorized, setToken, ApiError } from "./api";

export interface Me {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

interface AuthContextValue {
  user: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  googleLogin: () => void;
  exchangeGoogleCode: (code: string, redirectUri: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setOnUnauthorized(() => {
      setToken(null);
      setUser(null);
    });
  }, []);

  useEffect(() => {
    async function bootstrap() {
      if (!localStorage.getItem("divido.token")) {
        setLoading(false);
        return;
      }
      try {
        const { user } = await api.get<{ user: Me }>("/auth/me");
        setUser(user);
      } catch {
        setToken(null);
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, []);

  async function afterAuth(token: string, user: Me) {
    setToken(token);
    setUser(user);
  }

  async function login(email: string, password: string) {
    const res = await api.post<{ token: string; user: Me }>("/auth/login", { email, password });
    await afterAuth(res.token, res.user);
  }

  async function register(name: string, email: string, password: string) {
    const res = await api.post<{ token: string; user: Me }>("/auth/register", {
      name,
      email,
      password,
    });
    await afterAuth(res.token, res.user);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  async function googleLogin() {
    const redirectUri = `${window.location.origin}/auth/google/callback`;
    const { url } = await api.get<{ url: string }>(
      `/auth/google/url?redirect_uri=${encodeURIComponent(redirectUri)}`
    );
    window.location.href = url;
  }

  async function exchangeGoogleCode(code: string, redirectUri: string) {
    const res = await api.post<{ token: string; user: Me }>("/auth/google", {
      code,
      redirect_uri: redirectUri,
    });
    await afterAuth(res.token, res.user);
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, googleLogin, exchangeGoogleCode }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}

export { ApiError };
