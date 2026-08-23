import posthog from "posthog-js";

const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? "https://eu.i.posthog.com";

export const analyticsEnabled = Boolean(key);

const CONSENT_KEY = "divido.analytics_consent";

export function initAnalytics() {
  if (!analyticsEnabled) return;
  posthog.init(key!, {
    api_host: host,
    autocapture: false,
    capture_pageview: false,
    persistence: "localStorage",
    opt_out_capturing_by_default: true,
  });
  const consent = localStorage.getItem(CONSENT_KEY);
  if (consent === "yes") posthog.opt_in_capturing();
}

export function getAnalyticsConsent(): "yes" | "no" | null {
  return localStorage.getItem(CONSENT_KEY) as "yes" | "no" | null;
}

export function acceptAnalyticsConsent() {
  localStorage.setItem(CONSENT_KEY, "yes");
  if (analyticsEnabled) posthog.opt_in_capturing();
}

export function declineAnalyticsConsent() {
  localStorage.setItem(CONSENT_KEY, "no");
  if (analyticsEnabled) posthog.opt_out_capturing();
}

export function track(event: string, properties?: Record<string, unknown>) {
  if (!analyticsEnabled) return;
  posthog.capture(event, properties);
}

export function identifyUser(userId: string) {
  if (!analyticsEnabled) return;
  posthog.identify(userId);
}

export function resetAnalytics() {
  if (!analyticsEnabled) return;
  posthog.reset();
}