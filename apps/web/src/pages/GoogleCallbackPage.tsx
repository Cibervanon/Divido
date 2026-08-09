import { useEffect, useRef } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, ApiError } from "../lib/auth";
import { Spinner } from "../components/ui";

export default function GoogleCallbackPage() {
  const [params] = useSearchParams();
  const code = params.get("code");
  const navigate = useNavigate();
  const { user, exchangeGoogleCode } = useAuth();
  const done = useRef(false);

  useEffect(() => {
    if (!code || done.current) return;
    done.current = true;
    const redirectUri = `${window.location.origin}/auth/google/callback`;
    exchangeGoogleCode(code, redirectUri)
      .then(() => navigate("/", { replace: true }))
      .catch((err) => {
        const msg = err instanceof ApiError ? err.message : "Error al iniciar sesión con Google";
        navigate(`/login?error=${encodeURIComponent(msg)}`, { replace: true });
      });
  }, [code, exchangeGoogleCode, navigate]);

  if (user) return <Navigate to="/" replace />;
  if (!code) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-3 text-slate-300">
        <Spinner className="h-8 w-8" />
        <p className="text-sm">Conectando con Google…</p>
      </div>
    </div>
  );
}
