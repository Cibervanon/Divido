const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? "https://eu.i.posthog.com";

export const analyticsEnabled = Boolean(key);

const CONSENT_KEY = "divido.analytics_consent";

type PosthogInstance = import("posthog-js").PostHog;

let posthogPromise: Promise<PosthogInstance | null> | null = null;

/** Carga posthog-js bajo demanda (chunk separado) y lo cachea. Devuelve null si no está habilitado. */
function getPosthog(): Promise<PosthogInstance | null> {
  if (!analyticsEnabled) return Promise.resolve(null);
  if (!posthogPromise) {
    posthogPromise = import("posthog-js")
      .then((m) => {
        const posthog = m.default;
        posthog.init(key!, {
          api_host: host,
          autocapture: false,
          capture_pageview: false,
          persistence: "localStorage",
          opt_out_capturing_by_default: true,
        });
        const consent = localStorage.getItem(CONSENT_KEY);
        if (consent === "yes") posthog.opt_in_capturing();
        return posthog;
      })
      .catch(() => null);
  }
  return posthogPromise;
}

export function initAnalytics(): void {
  void getPosthog();
}

export function getAnalyticsConsent(): "yes" | "no" | null {
  return localStorage.getItem(CONSENT_KEY) as "yes" | "no" | null;
}

export function acceptAnalyticsConsent(): void {
  localStorage.setItem(CONSENT_KEY, "yes");
  void getPosthog().then((p) => p?.opt_in_capturing());
}

export function declineAnalyticsConsent(): void {
  localStorage.setItem(CONSENT_KEY, "no");
  void getPosthog().then((p) => p?.opt_out_capturing());
}

export function track(event: string, properties?: Record<string, unknown>): void {
  if (!analyticsEnabled) return;
  void getPosthog().then((p) => p?.capture(event, properties));
}

export function identifyUser(userId: string): void {
  if (!analyticsEnabled) return;
  void getPosthog().then((p) => p?.identify(userId));
}

export function resetAnalytics(): void {
  if (!analyticsEnabled) return;
  void getPosthog().then((p) => p?.reset());
}