import { lazy, type LazyExoticComponent, type ComponentType } from "react";

interface RouteChunk {
  key: string;
  load: () => Promise<{ default: ComponentType<unknown> }>;
  Component: LazyExoticComponent<ComponentType<unknown>>;
}

function chunk(
  key: string,
  load: () => Promise<{ default: ComponentType<unknown> }>
): RouteChunk {
  return { key, load, Component: lazy(load) };
}

export const routeChunks: RouteChunk[] = [
  chunk("LoginPage", () => import("../pages/LoginPage")),
  chunk("ForgotPasswordPage", () => import("../pages/ForgotPasswordPage")),
  chunk("ResetPasswordPage", () => import("../pages/ResetPasswordPage")),
  chunk("PrivacyPage", () => import("../pages/PrivacyPage")),
  chunk("TermsPage", () => import("../pages/TermsPage")),
  chunk("CookiesPage", () => import("../pages/CookiesPage")),
  chunk("DashboardPage", () => import("../pages/DashboardPage")),
  chunk("GroupPage", () => import("../pages/GroupPage")),
  chunk("JoinPage", () => import("../pages/JoinPage")),
  chunk("ClaimPage", () => import("../pages/ClaimPage")),
  chunk("GoogleCallbackPage", () => import("../pages/GoogleCallbackPage")),
  chunk("VerifyEmailPage", () => import("../pages/VerifyEmailPage")),
];

let prefetchStarted = false;

function runIdle(task: () => void): void {
  const w = window as { requestIdleCallback?: (cb: () => void) => void };
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(task);
  } else {
    window.setTimeout(task, 300);
  }
}

export function prefetchRouteChunks(): void {
  if (prefetchStarted) return;
  prefetchStarted = true;
  runIdle(() => {
    for (const { load } of routeChunks) {
      // A failed prefetch should never break the app; the on-demand
      // import will retry when the route is actually navigated to.
      load().catch(() => undefined);
    }
  });
}

export const pageChunks = Object.fromEntries(
  routeChunks.map(({ key, Component }) => [key, Component])
) as Record<string, LazyExoticComponent<ComponentType<unknown>>>;