/**
 * App root: providers + the boot-guarded router.
 *
 * Boot order (masterdoc §8.3): check setup status → if the instance still needs
 * setup, everything routes to the wizard; otherwise the app is auth-gated
 * (login → protected shell). The gate keeps unconfigured instances from ever
 * showing a login form for an account that doesn't exist yet.
 */
import { useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth.tsx';
import { ToastProvider } from './components/ui/Toast.tsx';
import { api } from './lib/api.ts';
import { Brand } from './components/Brand.tsx';
import { Spinner } from './components/ui/primitives.tsx';
import { AppShell } from './components/AppShell.tsx';
import { Login } from './pages/Login.tsx';
import { SetupWizard } from './pages/SetupWizard.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { Logs } from './pages/Logs.tsx';
import { ConfigPage } from './pages/Config.tsx';

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ToastProvider>
  );
}

function FullScreenLoader() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-base text-accent">
      <Brand size={34} />
      <Spinner size={22} />
    </div>
  );
}

function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function AppRoutes() {
  const { loading } = useAuth();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    api
      .setupStatus()
      .then((s) => active && setNeedsSetup(s.needsSetup))
      .catch(() => active && setNeedsSetup(false));
    return () => {
      active = false;
    };
  }, []);

  if (needsSetup === null || loading) return <FullScreenLoader />;

  if (needsSetup) {
    return (
      <Routes>
        <Route path="/setup" element={<SetupWizard />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/setup" element={<Navigate to="/" replace />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/config" element={<ConfigPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
