import { useTranslation } from 'react-i18next';
import { useAgentWorkspace } from '../agent/useAgentWorkspace';
import { AuraNav } from '../components/AuraNav';
import { WorkspaceNav } from '../components/WorkspaceNav';
import { AgentChatPanel } from '../components/AgentChatPanel';

export function AIStudioPage() {
  const { t } = useTranslation();
  const workspace = useAgentWorkspace();

  return (
    <div className="min-h-screen">
      <div className="lg:hidden">
        <AuraNav />
      </div>
      <div className="flex">
        <div className="sticky top-0 hidden h-screen lg:block">
          <WorkspaceNav />
        </div>
        <main className="mx-auto w-full max-w-3xl min-w-0 flex-1 px-4 pb-16 pt-8 sm:px-6">
          <header className="mb-6">
            <h1 className="text-2xl font-black tracking-tight text-white">
              <span className="aura-gradient-text">Aura AI</span>
            </h1>
            <p className="mt-1 text-sm text-violet-200/80">{t('workspace.whatToCreate')}</p>
          </header>
          <AgentChatPanel workspace={workspace} />
        </main>
      </div>
    </div>
  );
}