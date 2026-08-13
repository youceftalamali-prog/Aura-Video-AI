import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from './LanguageSelector';
import { setAccessToken, api } from '../lib/api';

const NAV = [
  { to: '/dashboard', key: 'nav.dashboard', icon: '⌂', match: (p: string) => p === '/dashboard' },
  { to: '/ai', key: 'nav.aiStudio', icon: '✦', match: (p: string) => p.startsWith('/ai') },
  { to: '/products', key: 'nav.products', icon: '◫', match: (p: string) => p.startsWith('/products') },
  { to: '/templates', key: 'nav.templates', icon: '▦', match: (p: string) => p.startsWith('/templates') },
  { to: '/library', key: 'nav.library', icon: '▤', match: (p: string) => p.startsWith('/library') },
  { to: '/billing', key: 'nav.billing', icon: '◆', match: (p: string) => p.startsWith('/billing') },
  { to: '/settings', key: 'nav.settings', icon: '⚙', match: (p: string) => p.startsWith('/settings') },
] as const;

export function WorkspaceNav({ compact }: { compact?: boolean }) {
  const { t } = useTranslation();
  const loc = useLocation();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    api
      .getDashboard()
      .then((d) => setBalance(d.credits.balance))
      .catch(() => setBalance(null));
  }, []);

  function signOut() {
    setAccessToken(null);
    window.location.href = '/login';
  }

  return (
    <aside
      className={
        compact
          ? 'flex h-full w-16 flex-col items-center border-e border-white/10 bg-[#0b0714]/90 py-4'
          : 'flex h-full w-56 flex-col border-e border-white/10 bg-[#0b0714]/90 px-3 py-4'
      }
    >
      <Link to="/dashboard" className={`flex items-center gap-2.5 ${compact ? 'justify-center' : 'px-2'}`} title="Aura Video AI">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-lg shadow-fuchsia-900/50">
          <span className="text-lg font-black leading-none text-white">A</span>
        </span>
        {!compact && (
          <span className="leading-tight">
            <span className="block text-base font-extrabold tracking-wide">
              <span className="aura-gradient-text">AURA</span>
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300/70">Video AI</span>
          </span>
        )}
      </Link>

      <nav className="mt-6 flex w-full flex-1 flex-col gap-1">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            title={compact ? t(item.key) : undefined}
            className={
              item.match(loc.pathname)
                ? compact
                  ? 'flex items-center justify-center rounded-lg bg-fuchsia-500/15 px-2 py-2 text-base text-fuchsia-200'
                  : 'flex items-center gap-3 rounded-lg bg-fuchsia-500/15 px-3 py-2 text-sm font-semibold text-fuchsia-200'
                : compact
                  ? 'flex items-center justify-center rounded-lg px-2 py-2 text-base text-violet-200/70 transition hover:bg-white/[0.06] hover:text-white'
                  : 'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-violet-200/70 transition hover:bg-white/[0.06] hover:text-white'
            }
          >
            <span className="w-5 text-center">{item.icon}</span>
            {!compact && <span>{t(item.key)}</span>}
          </Link>
        ))}
      </nav>

      <div className={`flex flex-col gap-2 ${compact ? 'items-center' : ''}`}>
        {balance !== null && (
          <Link
            to="/billing"
            className="aura-badge border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1 text-fuchsia-200"
            title={t('billing.balance')}
          >
            <span className="text-[10px]">✦</span>
            {balance.toLocaleString()} {!compact && <span className="text-fuchsia-300/70">{t('billing.creditsWord')}</span>}
          </Link>
        )}
        <div className="flex items-center gap-2">
          <LanguageSelector />
          {!compact && (
            <button
              onClick={signOut}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-medium text-violet-100 transition hover:border-rose-400/40 hover:text-rose-200"
            >
              {t('common.signOut')}
            </button>
          )}
          {compact && (
            <button
              onClick={signOut}
              title={t('common.signOut')}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-violet-100 transition hover:border-rose-400/40 hover:text-rose-200"
            >
              ⏻
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
