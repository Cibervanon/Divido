import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Spinner } from "./ui";
import {
  analyticsEnabled,
  getAnalyticsConsent,
  acceptAnalyticsConsent,
  declineAnalyticsConsent,
} from "../lib/analytics";

/** Pausa breve para que el feedback de "Aceptando…" llegue a verse. */
const ACCEPT_FEEDBACK_MS = 600;

export function AnalyticsConsentBanner() {
  // Estado interno: al decidir ocultamos el banner al instante sin depender
  // de un re-render del padre (antes había que recargar la página).
  const [hidden, setHidden] = useState(false);
  const [accepting, setAccepting] = useState(false);

  if (!analyticsEnabled || hidden) return null;
  if (getAnalyticsConsent() !== null) return null;

  function handleAccept() {
    if (accepting) return;
    setAccepting(true);
    window.setTimeout(() => {
      acceptAnalyticsConsent();
      setHidden(true);
    }, ACCEPT_FEEDBACK_MS);
  }

  function handleDecline() {
    declineAnalyticsConsent();
    setHidden(true);
  }

  return (
    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
      <span className="mt-0.5 text-lg">📊</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-amber-300">Ayúdanos a mejorar Divido</p>
        <p className="mt-0.5 text-xs text-amber-400/90">
          Usamos analítica anónima (PostHog, alojado en la UE) para entender cómo se usa la app y
          priorizar mejoras. No vendemos tus datos ni los usamos para publicidad.
          <Link to="/cookies" className="ml-0.5 underline hover:text-amber-200">
            Política de cookies
          </Link>
        </p>
      </div>
      {accepting ? (
        <span className="flex shrink-0 items-center gap-1.5 py-1.5 text-xs font-semibold text-amber-300">
          <Spinner className="h-3.5 w-3.5" />
          Aceptando…
        </span>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={handleDecline}>
            Ahora no
          </Button>
          <Button variant="primary" className="!px-3 !py-1.5 text-xs" onClick={handleAccept} loading={accepting}>
            Aceptar
          </Button>
        </div>
      )}
    </div>
  );
}
