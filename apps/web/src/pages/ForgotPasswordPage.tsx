import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { Button, Input } from "../components/ui";
import { Logo } from "../components/Logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al enviar el enlace");
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
          <h1 className="text-2xl font-extrabold text-slate-100">¿Has olvidado tu contraseña?</h1>
          <p className="mt-1 text-sm text-slate-400">Te enviaremos un enlace para restablecerla</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          {sent ? (
            <>
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-2xl text-emerald-400">
                ✓
              </div>
              <h2 className="text-center text-lg font-bold text-slate-100">Revisa tu email</h2>
              <p className="mt-1 text-center text-sm text-slate-400">
                Si existe una cuenta con ese email, hemos enviado un enlace para restablecer tu
                contraseña.
              </p>
              <Link to="/login">
                <Button variant="secondary" className="mt-5 w-full">
                  Volver a iniciar sesión
                </Button>
              </Link>
            </>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {error ? (
                <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-400">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" loading={loading}>
                Enviar enlace
              </Button>
              <div className="text-center">
                <Link
                  to="/login"
                  className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
                >
                  Volver a iniciar sesión
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
