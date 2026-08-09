import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button, Spinner } from "../components/ui";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { user, refreshUser } = useAuth();
  const userRef = useRef(user);
  const refreshRef = useRef(refreshUser);
  userRef.current = user;
  refreshRef.current = refreshUser;
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function verify() {
      if (!token) {
        setState("error");
        setMessage("Falta el token de verificación");
        return;
      }
      try {
        await api.post("/auth/verify-email", { token });
        if (userRef.current) await refreshRef.current();
        setState("done");
      } catch (err) {
        setState("error");
        setMessage(err instanceof ApiError ? err.message : "Error al verificar el email");
      }
    }
    verify();
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center shadow-xl">
        {state === "loading" ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <Spinner className="h-8 w-8" />
            <p className="text-sm text-slate-400">Verificando tu email...</p>
          </div>
        ) : state === "done" ? (
          <>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-2xl text-emerald-400">
              ✓
            </div>
            <h1 className="text-lg font-bold text-slate-100">Email verificado</h1>
            <p className="mt-1 text-sm text-slate-400">Tu cuenta ya está verificada.</p>
            <Link to="/">
              <Button className="mt-5 w-full">Ir a mi panel</Button>
            </Link>
          </>
        ) : (
          <>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/15 text-2xl text-rose-400">
              ✕
            </div>
            <h1 className="text-lg font-bold text-slate-100">No se pudo verificar</h1>
            <p className="mt-1 text-sm text-rose-400">{message}</p>
            <Link to="/">
              <Button variant="secondary" className="mt-5 w-full">
                Ir a mi panel
              </Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
