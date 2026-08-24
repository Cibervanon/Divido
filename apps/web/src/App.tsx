import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./lib/auth";
import { Spinner } from "./components/ui";
import { analyticsEnabled, track } from "./lib/analytics";
import { OnboardingModal } from "./components/OnboardingModal";
import { PWAInstallBanner } from "./components/PWAInstallBanner";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const CookiesPage = lazy(() => import("./pages/CookiesPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const GroupPage = lazy(() => import("./pages/GroupPage"));
const JoinPage = lazy(() => import("./pages/JoinPage"));
const ClaimPage = lazy(() => import("./pages/ClaimPage"));
const GoogleCallbackPage = lazy(() => import("./pages/GoogleCallbackPage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));

function FullScreenSpinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

function Protected({ children }: { children: ReactNode }) {
  const { user, loading, showOnboarding } = useAuth();
  const location = useLocation();
  if (loading) {
    return <FullScreenSpinner />;
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return (
    <>
      {children}
      {showOnboarding && <OnboardingModal />}
      <PWAInstallBanner />
    </>
  );
}

function PageviewTracker() {
  const location = useLocation();
  useEffect(() => {
    if (analyticsEnabled) {
      track("$pageview", { path: location.pathname });
    }
  }, [location.pathname]);
  return null;
}

export default function App() {
  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <PageviewTracker />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/cookies" element={<CookiesPage />} />
        <Route path="/join/:token" element={<JoinPage />} />
        <Route path="/claim/:token" element={<ClaimPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
        <Route
          path="/"
          element={
            <Protected>
              <DashboardPage />
            </Protected>
          }
        />
        <Route
          path="/groups/:groupId"
          element={
            <Protected>
              <GroupPage />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
