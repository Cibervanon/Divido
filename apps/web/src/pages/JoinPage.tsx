import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button, Spinner } from "../components/ui";
import type { InvitePreview } from "@divido/shared";

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      .get<{ preview: InvitePreview }>(`/join/${token}`)
      .then((res) => {
        setPreview(res.preview);
        setError("");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Error"))
      .finally(() => setLoading(false));
  }, [token]);

  async function join() {
    if (!token) return;
    setJoining(true);
    try {
      const res = await api.post<{ groupId: string }>(`/join/${token}`);
      navigate(`/groups/${res.groupId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al unirse");
      setJoining(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-2xl font-black text-white shadow-lg">
            €
          </div>
          <h1 className="text-xl font-extrabold text-slate-100">Invitación a grupo</h1>
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
                {preview.groupName[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-lg font-bold text-slate-100">{preview.groupName}</p>
                <p className="mt-1 text-sm text-slate-400">
                  {preview.memberCount} miembro{preview.memberCount !== 1 ? "s" : ""} · Moneda {preview.currency}
                </p>
                {preview.existingMember ? (
                  <p className="mt-2 text-xs font-medium text-amber-400">
                    Ya eres miembro de este grupo
                  </p>
                ) : null}
              </div>

              {user ? (
                <Button onClick={join} loading={joining} className="w-full">
                  Unirse al grupo
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">
                    Puedes ver el grupo sin cuenta, pero necesitas entrar para participar.
                  </p>
                  <Link to={`/login?next=/join/${token}`}>
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
