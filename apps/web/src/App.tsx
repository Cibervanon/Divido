import { Suspense, lazy, useEffect, Component, ErrorInfo, ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { Spinner } from "./components/ui";
import { analyticsEnabled, track } from "./lib/analytics";
import { OnboardingModal } from "./components/OnboardingModal";
import { PWAInstallBanner } from "./components/PWAInstallBanner";
import { GuidedTourProviderWithSetter } from "./components/GuidedTourPortal";
import { HelpProvider } from "./components/HelpButton";
import { HelpModal } from "./components/HelpModal";

class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { hasError: boolean; error: Error | null }> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex h-screen items-center justify-center bg-slate-950 text-center px-4">
          <div className="max-w-md">
            <h2 className="text-xl font-semibold text-white mb-2">Algo salió mal</h2>
            <p className="text-slate-400 mb-4">{this.state.error?.message || "Error inesperado"}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition"
            >
              Recargar la página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    <GuidedTourProviderWithSetter>
      {children}
      {showOnboarding && <OnboardingModal />}
      <PWAInstallBanner />
    </GuidedTourProviderWithSetter>
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
    <HelpProvider>
      <ErrorBoundary>
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
      </ErrorBoundary>
    </HelpProvider>
  );
}
