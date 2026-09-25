import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthPage } from '@/components/AuthPage';
import { useAuth } from '@/hooks/AuthContext';
import { ControlPage } from '@/routes/Control';
import { DisplayPage } from '@/routes/Display';
import { JoinPage } from '@/routes/Join';

function AuthGuard({
  children,
  requireAuth,
}: {
  children: React.ReactNode;
  requireAuth: boolean;
}) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f9f8] font-sans">
        <div className="text-sm text-[#10241f]/50">Loading…</div>
      </div>
    );
  }

  if (requireAuth && !isAuthenticated) return <Navigate to="/auth" replace />;
  if (!requireAuth && isAuthenticated) return <Navigate to="/control" replace />;

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Anonymous — attendee phones, via the QR code */}
        <Route path="/join" element={<JoinPage />} />
        {/* Anonymous — the projected big screen */}
        <Route path="/display" element={<DisplayPage />} />

        {/* Presenter only, second device, never projected */}
        <Route
          path="/auth"
          element={
            <AuthGuard requireAuth={false}>
              <AuthPage />
            </AuthGuard>
          }
        />
        <Route
          path="/control"
          element={
            <AuthGuard requireAuth={true}>
              <ControlPage />
            </AuthGuard>
          }
        />

        <Route path="*" element={<Navigate to="/display" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
