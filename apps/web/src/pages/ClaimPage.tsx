import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button, Spinner } from "../components/ui";
import { Logo } from "../components/Logo";

interface ClaimPreview {
  groupId: string;
  groupName: string;
  currency: string;
  ghostName: string;
}

export default function ClaimPage() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<ClaimPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      .get<{ preview: ClaimPreview }>(`/claim/${token}`)
      .then((res) => {
        setPreview(res.preview);
        setError("");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Error"))
      .finally(() => setLoading(false));
  }, [token]);

  async function claim() {
    if (!token) return;
    setClaiming(true);
    try {
      const res = await api.post<{ groupId: string }>(`/claim/${token}`);
      navigate(`/groups/${res.groupId}`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al reclamar");
      setClaiming(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center">
            <Logo className="h-14 w-14" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-100">Reclamar tu perfil</h1>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner className="h-6 w-6" />
            </div>
          ) : error ? (
            <div className="py-4 text-center">
              <p className="text-sm text-rose-400">{error}</p>
              <Link to="/" className="mt-3 inline-block text-sm font-semibold text-indigo-400 hover:text-indigo-300">
                Volver al inicio
              </Link>
            </div>
          ) : preview ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800 text-2xl font-black text-indigo-300">
                {preview.ghostName[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm text-slate-400">Te han invitado a reclamar el perfil</p>
                <p className="text-lg font-bold text-slate-100">{preview.ghostName}</p>
                <p className="mt-1 text-sm text-slate-400">
                  en <span className="font-semibold text-slate-200">{preview.groupName}</span> · Moneda {preview.currency}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  Al reclamarlo conservarás los gastos, saldos y piques que había a su nombre.
                </p>
              </div>

              {user ? (
                <Button onClick={claim} loading={claiming} className="w-full">
                  Reclamar mi perfil
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">
                    Necesitas una cuenta para reclamar este perfil.
                  </p>
                  <Link to={`/login?next=/claim/${token}`}>
                    <Button className="w-full">Iniciar sesión o crear cuenta</Button>
                  </Link>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
