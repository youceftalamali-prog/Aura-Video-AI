import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAgentWorkspace } from '../agent/useAgentWorkspace';
import { AuraNav } from '../components/AuraNav';
import { WorkspaceNav } from '../components/WorkspaceNav';
import { AgentChatPanel } from '../components/AgentChatPanel';
import { SmartTemplatesSection } from '../components/SmartTemplatesSection';
import { RecentVideosSection } from '../components/RecentVideosSection';
import { RecentItemsSection } from '../components/RecentItemsSection';

function greetingKey(hour: number): string {
  if (hour >= 5 && hour < 12) return 'workspace.greetingMorning';
  if (hour >= 12 && hour < 18) return 'workspace.greetingAfternoon';
  return 'workspace.greetingEvening';
}

export function DashboardPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const workspace = useAgentWorkspace();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const paramHandled = useRef(false);
  const [paramError, setParamError] = useState<string | null>(null);

  useEffect(() => {
    api
      .me()
      .then((u) => setDisplayName(u.fullName || u.email.split('@')[0] || null))
      .catch(() => setDisplayName(null));
  }, []);

  // Deep links: ?template=<slug> and ?product=<id> hand the selection to the agent.
  useEffect(() => {
    if (paramHandled.current || workspace.restoring) return;
    const templateParam = searchParams.get('template');
    const productParam = searchParams.get('product');
    if (!templateParam && !productParam) return;

    paramHandled.current = true;
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('template');
    newParams.delete('product');
    setSearchParams(newParams, { replace: true });

    (async () => {
      if (templateParam) {
        try {
          const tpl = await api.getTemplate(templateParam);
          void workspace.useTemplate(tpl);
        } catch {
          setParamError(templateParam);
        }
      } else if (productParam) {
        const found = workspace.products.find((p) => p.id === productParam);
        if (found) {
          void workspace.selectProduct(found);
        } else {
          try {
            const product = await api.getProduct(productParam);
            void workspace.selectProduct(product);
          } catch {
            setParamError(productParam);
          }
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.restoring, workspace.products]);

  const greeting = useMemo(() => {
    const name = displayName ?? workspace.settings?.profile.fullName ?? workspace.settings?.profile.email.split('@')[0] ?? '';
    return t(greetingKey(new Date().getHours()), { name });
  }, [displayName, workspace.settings, t]);

  return (
    <div className="min-h-screen">
      <div className="lg:hidden">
        <AuraNav />
      </div>
      <div className="flex">
        <div className="sticky top-0 hidden h-screen lg:block">
          <WorkspaceNav />
        </div>

        <main className="mx-auto w-full max-w-5xl min-w-0 flex-1 px-4 pb-16 pt-8 sm:px-6">
          <header className="mb-6">
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{greeting}</h1>
            <p className="mt-1 text-sm text-violet-200/80">
              <span className="font-semibold text-fuchsia-200">Aura AI:</span> {t('workspace.whatToCreate')}
            </p>
            <p className="mt-0.5 text-xs text-violet-300/50">{t('workspace.composerHint')}</p>
            {paramError && (
              <p className="mt-2 text-xs text-rose-300/80">
                {paramError}
              </p>
            )}
          </header>

          <AgentChatPanel workspace={workspace} />

          <SmartTemplatesSection onUseTemplate={(tpl) => void workspace.useTemplate(tpl)} />
          <RecentVideosSection />
          <RecentItemsSection onPickProduct={(p) => void workspace.selectProduct(p)} />

          <footer className="border-t border-white/10 pt-6 text-center text-xs text-violet-300/50">
            AURA VIDEO AI · AI Marketing Agent
          </footer>
        </main>
      </div>
    </div>
  );
}