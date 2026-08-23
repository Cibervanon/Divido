import { Link } from "react-router-dom";
import { Button } from "./ui";
import { getAnalyticsConsent, acceptAnalyticsConsent, declineAnalyticsConsent, analyticsEnabled } from "../lib/analytics";

export function AnalyticsConsentBanner({ onClose }: { onClose: () => void }) {
  if (!analyticsEnabled) return null;
  const consent = getAnalyticsConsent();
  if (consent !== null) return null;

  return (
    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
      <span className="mt-0.5 text-lg">📊</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-300">Ayúdanos a mejorar Divido</p>
        <p className="mt-0.5 text-xs text-amber-400/90">
          Usamos analítica anónima (PostHog, alojado en la UE) para entender cómo se usa la app y
          priorizar mejoras. No vendemos tus datos ni los usamos para publicidad.
          <Link to="/cookies" className="underline hover:text-amber-200 ml-0.5">
            Política de cookies
          </Link>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="ghost"
          className="!px-3 !py-1.5 text-xs"
          onClick={() => {
            declineAnalyticsConsent();
            onClose();
          }}
        >
          Ahora no
        </Button>
        <Button
          variant="primary"
          className="!px-3 !py-1.5 text-xs"
          onClick={() => {
            acceptAnalyticsConsent();
            onClose();
          }}
        >
          Aceptar
        </Button>
      </div>
    </div>
  );
}