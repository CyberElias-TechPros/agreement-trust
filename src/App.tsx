import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Landing from "./pages/Landing";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import AcceptInvite from "./pages/auth/AcceptInvite";
import NotFound from "./pages/NotFound";
import { AppLayout } from "./components/AppLayout";
import { DemoBanner } from "./components/DemoBanner";
import { CommandPalette } from "./components/CommandPalette";
import {
  PricingPage,
  AboutPage,
  PrivacyPage,
  TermsPage,
  SecurityPage,
  ContactPage,
  HelpPage,
  StatusPage,
  DocsPage,
  DpaPage,
  ChangelogPage,
} from "./pages/public/MarketingPages";

// App workspace pages are lazy-loaded to keep the public
// experience (landing/auth) fast on first paint.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ContractList = lazy(() => import("./pages/ContractList"));
const ContractDetail = lazy(() => import("./pages/ContractDetail"));
const CreateContract = lazy(() => import("./pages/CreateContract"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const Profile = lazy(() => import("./pages/Profile"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Onboarding = lazy(() => import("./pages/Onboarding"));

function PageFallback() {
  return (
    <div className="flex h-64 items-center justify-center" aria-label="Loading page">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-b-transparent" />
        <p className="text-xs text-muted-foreground">Opening the ledger…</p>
      </div>
    </div>
  );
}

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-b-transparent" />
          <p className="text-xs text-muted-foreground">Authenticating…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Landing />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/onboarding" replace /> : <Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/invite/:token" element={<AcceptInvite />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/security" element={<SecurityPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/help" element={<HelpPage />} />
      <Route path="/status" element={<StatusPage />} />
      <Route path="/docs" element={<DocsPage />} />
      <Route path="/dpa" element={<DpaPage />} />
      <Route path="/changelog" element={<ChangelogPage />} />

      {/* App (protected, sidebar layout) */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/dashboard"
          element={
            <Suspense fallback={<PageFallback />}>
              <Dashboard />
            </Suspense>
          }
        />
        <Route
          path="/contracts"
          element={
            <Suspense fallback={<PageFallback />}>
              <ContractList />
            </Suspense>
          }
        />
        <Route
          path="/contracts/new"
          element={
            <Suspense fallback={<PageFallback />}>
              <CreateContract />
            </Suspense>
          }
        />
        <Route
          path="/contracts/:id"
          element={
            <Suspense fallback={<PageFallback />}>
              <ContractDetail />
            </Suspense>
          }
        />
        <Route
          path="/reports"
          element={
            <Suspense fallback={<PageFallback />}>
              <Reports />
            </Suspense>
          }
        />
        <Route
          path="/settings"
          element={
            <Suspense fallback={<PageFallback />}>
              <Settings />
            </Suspense>
          }
        />
        <Route
          path="/profile"
          element={
            <Suspense fallback={<PageFallback />}>
              <Profile />
            </Suspense>
          }
        />
        <Route
          path="/notifications"
          element={
            <Suspense fallback={<PageFallback />}>
              <Notifications />
            </Suspense>
          }
        />
        <Route
          path="/onboarding"
          element={
            <Suspense fallback={<PageFallback />}>
              <Onboarding />
            </Suspense>
          }
        />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <AuthProvider>
        <DemoBanner />
        <CommandPalette />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
