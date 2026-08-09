import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { UsersPage } from './pages/UsersPage';
import { PlansPage } from './pages/PlansPage';
import { SettingsPage } from './pages/SettingsPage';
import { getAccessToken, clearAccessToken } from './lib/api';
import { Button } from '@aura/ui';

function Protected({ children }: { children: React.ReactNode }) {
  if (!getAccessToken()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  function logout() {
    clearAccessToken();
    navigate('/login');
  }
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="font-bold text-slate-900">Aura Admin</span>
            <nav className="flex gap-4 text-sm">
              <Link to="/users" className="text-slate-600 hover:text-slate-900">
                Users
              </Link>
              <Link to="/plans" className="text-slate-600 hover:text-slate-900">
                Plans
              </Link>
              <Link to="/settings" className="text-slate-600 hover:text-slate-900">
                Settings
              </Link>
            </nav>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/users"
        element={
          <Protected>
            <Layout>
              <UsersPage />
            </Layout>
          </Protected>
        }
      />
      <Route
        path="/plans"
        element={
          <Protected>
            <Layout>
              <PlansPage />
            </Layout>
          </Protected>
        }
      />
      <Route
        path="/settings"
        element={
          <Protected>
            <Layout>
              <SettingsPage />
            </Layout>
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/users" replace />} />
    </Routes>
  );
}
