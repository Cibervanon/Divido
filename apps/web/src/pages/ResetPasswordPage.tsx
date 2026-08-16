import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { Button, PasswordField } from "../components/ui";
import { Logo } from "../components/Logo";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al restablecer la contraseña");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center shadow-xl">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/15 text-2xl text-rose-400">
            ✕
          </div>
          <h1 className="text-lg font-bold text-slate-100">Enlace inválido</h1>
          <p className="mt-1 text-sm text-rose-400">Falta el token de restablecimiento.</p>
          <Link to="/forgot-password">
            <Button variant="secondary" className="mt-5 w-full">
              Solicitar un nuevo enlace
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center">
            <Logo className="h-14 w-14" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100">Nueva contraseña</h1>
          <p className="mt-1 text-sm text-slate-400">Elige una nueva contraseña para tu cuenta</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          {done ? (
            <>
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-2xl text-emerald-400">
                ✓
              </div>
              <h2 className="text-center text-lg font-bold text-slate-100">Contraseña actualizada</h2>
              <p className="mt-1 text-center text-sm text-slate-400">
                Ya puedes iniciar sesión con tu nueva contraseña.
              </p>
              <Link to="/login">
                <Button className="mt-5 w-full">Iniciar sesión</Button>
              </Link>
            </>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <PasswordField
                label="Nueva contraseña"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={setPassword}
                required
                minLength={6}
                autoComplete="new-password"
              />
              <PasswordField
                label="Confirmar contraseña"
                placeholder="Repite la contraseña"
                value={confirm}
                onChange={setConfirm}
                required
                minLength={6}
                autoComplete="new-password"
              />
              {error ? (
                <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-400">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" loading={loading}>
                Restablecer contraseña
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
