import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAgentWorkspace } from '../agent/useAgentWorkspace';
import { AuraNav } from '../components/AuraNav';
import { WorkspaceNav } from '../components/WorkspaceNav';
import { AgentChatPanel } from '../components/AgentChatPanel';
import { SmartTemplatesSection } from '../components/SmartTemplatesSection';

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
    <div className="min-h-screen bg-gradient-to-b from-[#effdf6] via-[#eef8fb] to-[#f8f8f8] text-zinc-950">
      <div className="lg:hidden">
        <AuraNav />
      </div>
      <div className="flex">
        <div className="sticky top-0 hidden h-screen lg:block">
          <WorkspaceNav />
        </div>

        <main className="relative mx-auto w-full min-w-0 flex-1 px-4 pb-0 pt-6 sm:px-6 lg:max-w-none lg:px-8">
          <header className="mx-auto mb-4 max-w-3xl text-center">
            <h1 className="text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">{greeting}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              <span className="font-bold text-violet-700">Aura AI:</span> {t('workspace.whatToCreate')}
            </p>
            {paramError && <p className="mt-2 text-xs text-rose-600">{t('workspace.deepLinkError', { value: paramError })}</p>}
          </header>

          <AgentChatPanel workspace={workspace} />

          <div className="mx-auto max-w-6xl pb-72">
            <SmartTemplatesSection onUseTemplate={(tpl) => void workspace.useTemplate(tpl)} />
          </div>
        </main>
      </div>
    </div>
  );
}
