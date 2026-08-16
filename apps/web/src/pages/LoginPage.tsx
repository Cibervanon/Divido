import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, ApiError } from "../lib/auth";
import { Button, Input, PasswordField } from "../components/ui";
import { Logo } from "../components/Logo";

export default function LoginPage() {
  const { user, login, register, googleLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(searchParams.get("error") ?? "");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to={next ?? "/"} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(name, email, password);
      navigate(next ?? location.state?.from ?? "/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center">
            <Logo className="h-14 w-14" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100">Divido</h1>
          <p className="mt-1 text-sm text-slate-400">Gastos en grupo, saldados sin fricción</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-950 p-1">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError("");
                }}
                className={`rounded-lg py-2 text-sm font-semibold transition ${
                  mode === m ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {m === "login" ? "Entrar" : "Crear cuenta"}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "register" ? (
              <Input
                label="Nombre"
                placeholder="Ej. María García"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            ) : null}
            <Input
              label="Email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div>
              <PasswordField
                label="Contraseña"
                placeholder={mode === "register" ? "Mínimo 6 caracteres" : "••••••••"}
                value={password}
                onChange={setPassword}
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              {mode === "login" ? (
                <div className="mt-1.5 text-right">
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
                  >
                    ¿Has olvidado tu contraseña?
                  </Link>
                </div>
              ) : null}
            </div>
            {error ? (
              <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-400">{error}</p>
            ) : null}
            <Button type="submit" className="w-full" loading={loading}>
              {mode === "login" ? "Entrar" : "Crear cuenta"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-slate-600">
            <div className="h-px flex-1 bg-slate-800" />
            o
            <div className="h-px flex-1 bg-slate-800" />
          </div>

          <Button variant="secondary" className="w-full" onClick={() => googleLogin()} type="button">
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.44 3.45 1.18 4.94l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
              />
            </svg>
            Continuar con Google
          </Button>
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          Al continuar aceptas los términos de uso de Divido.
        </p>
      </div>
    </div>
  );
}
