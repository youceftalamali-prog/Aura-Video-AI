import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from './LanguageSelector';
import { Button } from '@aura/ui';
import { clearTokens } from '../lib/api';

const NAV = [
  { to: '/dashboard', key: 'nav.dashboard' },
  { to: '/ai', key: 'nav.aiStudio' },
  { to: '/creative', key: 'nav.creative' },
  { to: '/video', key: 'nav.video' },
  { to: '/products', key: 'nav.products' },
  { to: '/templates', key: 'nav.templates' },
  { to: '/library', key: 'nav.library' },
  { to: '/billing', key: 'nav.billing' },
] as const;

export function AppShell({ children, title }: { children: React.ReactNode; title?: string }) {
  const { t } = useTranslation();
  const loc = useLocation();
  function signOut() {
    clearTokens();
    window.location.href = '/login';
  }
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/dashboard" className="font-semibold text-indigo-700">{t('common.appName')}</Link>
            <nav className="flex flex-wrap gap-2 text-sm">
              {NAV.map((item) => (
                <Link key={item.to} to={item.to}
                  className={loc.pathname.startsWith(item.to) ? 'rounded-md bg-indigo-50 px-2 py-1 font-medium text-indigo-700' : 'rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100'}>
                  {t(item.key)}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSelector />
            <Button variant="outline" size="sm" onClick={signOut}>{t('common.signOut')}</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {title ? <h1 className="mb-4 text-2xl font-semibold">{title}</h1> : null}
        {children}
      </main>
    </div>
  );
}
