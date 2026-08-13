import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { AIStudioPage } from './pages/AIStudioPage';
import { CreativeStudioPage } from './pages/CreativeStudioPage';
import { VideoStudioPage } from './pages/VideoStudioPage';
import { ProductImportPage } from './pages/ProductImportPage';
import { ProductsPage } from './pages/ProductsPage';
import { PublishingPage } from './pages/PublishingPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { TemplateCategoryPage } from './pages/TemplateCategoryPage';
import { TemplateDetailPage } from './pages/TemplateDetailPage';
import { LibraryPage } from './pages/LibraryPage';
import { BillingPage } from './pages/BillingPage';
import { SettingsPage } from './pages/SettingsPage';
import { BillingSuccessPage } from './pages/BillingSuccessPage';
import { BillingCancelPage } from './pages/BillingCancelPage';
import { getAccessToken } from './lib/api';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!getAccessToken()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  if (getAccessToken()) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai"
        element={
          <ProtectedRoute>
            <AIStudioPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/creative"
        element={
          <ProtectedRoute>
            <CreativeStudioPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/video"
        element={
          <ProtectedRoute>
            <VideoStudioPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/products"
        element={
          <ProtectedRoute>
            <ProductsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/products/import"
        element={
          <ProtectedRoute>
            <ProductImportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/publishing"
        element={
          <ProtectedRoute>
            <PublishingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/library"
        element={
          <ProtectedRoute>
            <LibraryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing"
        element={
          <ProtectedRoute>
            <BillingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing/success"
        element={
          <ProtectedRoute>
            <BillingSuccessPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing/cancel"
        element={
          <ProtectedRoute>
            <BillingCancelPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/templates"
        element={
          <ProtectedRoute>
            <TemplatesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/templates/view/:id"
        element={
          <ProtectedRoute>
            <TemplateDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/templates/:category"
        element={
          <ProtectedRoute>
            <TemplateCategoryPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
