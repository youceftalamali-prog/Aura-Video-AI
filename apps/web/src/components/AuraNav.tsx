import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from './LanguageSelector';
import { setAccessToken, api } from '../lib/api';

const NAV = [
  { to: '/dashboard', key: 'nav.dashboard', icon: '◉' },
  { to: '/templates', key: 'nav.templates', icon: '▦' },
  { to: '/library', key: 'nav.library', icon: '▤' },
  { to: '/products', key: 'nav.products', icon: '◫' },
  { to: '/video', key: 'nav.video', icon: '◇' },
  { to: '/billing', key: 'nav.billing', icon: '◆' },
] as const;

export function AuraNav() {
  const { t } = useTranslation();
  const loc = useLocation();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    api
      .getDashboard()
      .then((d) => setBalance(d.credits.balance))
      .catch(() => setBalance(null));
  }, []);

  function isActive(to: string): boolean {
    if (to === '/dashboard') return loc.pathname === '/dashboard';
    return loc.pathname.startsWith(to);
  }

  function signOut() {
    setAccessToken(null);
    window.location.href = '/login';
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b0714]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link to="/dashboard" className="group flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-lg shadow-fuchsia-900/50 transition group-hover:shadow-fuchsia-700/60">
              <span className="text-lg font-black leading-none text-white">A</span>
            </span>
            <span className="leading-tight">
              <span className="block text-base font-extrabold tracking-wide">
                <span className="aura-gradient-text">AURA</span>
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300/70">
                Video AI
              </span>
            </span>
          </Link>

          <nav className="hidden flex-wrap items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={
                  isActive(item.to)
                    ? 'rounded-lg bg-fuchsia-500/15 px-3 py-1.5 text-sm font-semibold text-fuchsia-200'
                    : 'rounded-lg px-3 py-1.5 text-sm font-medium text-violet-200/70 transition hover:bg-white/[0.06] hover:text-white'
                }
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/dashboard?new=1"
            className="hidden items-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-900/40 transition hover:from-fuchsia-500 hover:to-violet-500 sm:inline-flex"
          >
            <span className="text-xs">✦</span>
            {t('home.newAd', { defaultValue: 'Create ad' })}
          </Link>
          {balance !== null && (
            <Link
              to="/billing"
              className="aura-badge border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1 text-fuchsia-200"
              title={t('billing.creditsTitle')}
            >
              <span className="text-[10px]">✦</span>
              {balance.toLocaleString()} <span className="text-fuchsia-300/70">{t('billing.creditsShort')}</span>
            </Link>
          )}
          <LanguageSelector />
          <button
            onClick={signOut}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-medium text-violet-100 transition hover:border-white/25 hover:bg-white/[0.08]"
          >
            {t('common.signOut')}
          </button>
        </div>
      </div>

      <nav className="flex flex-wrap items-center gap-1 px-4 pb-2 md:hidden">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={
              isActive(item.to)
                ? 'rounded-lg bg-fuchsia-500/15 px-3 py-1.5 text-sm font-semibold text-fuchsia-200'
                : 'rounded-lg px-3 py-1.5 text-sm font-medium text-violet-200/70'
            }
          >
            {t(item.key)}
          </Link>
        ))}
      </nav>
    </header>
  );
}