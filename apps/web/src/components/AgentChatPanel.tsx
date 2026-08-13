import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { VideoGenerationJobPublic } from '@aura/types';
import { AgentModelPicker } from './AgentModelPicker';
import { AgentStrategyPicker } from './AgentStrategyPicker';
import { ContextChips } from './ContextChips';
import { ProductPickerModal } from './ProductPickerModal';
import type { AgentWorkspaceState, WorkspaceMessage } from '../agent/useAgentWorkspace';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'canceled']);

const STATUS_KEY: Record<string, string> = {
  queued: 'status.queued',
  processing: 'status.processing',
  composing: 'status.composing',
  rendering: 'status.rendering',
  completed: 'status.completed',
  failed: 'status.failed',
  canceled: 'status.canceled',
};

function AgentAvatar() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-lg shadow-fuchsia-900/40">
      <span className="text-sm font-black text-white">A</span>
    </span>
  );
}

function ToolCallsRow({ calls }: { calls: WorkspaceMessage['toolCalls'] }) {
  const { t } = useTranslation();
  if (!calls) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {calls.map((c, i) => (
        <span
          key={`${c.name}-${i}`}
          className={
            c.ok
              ? 'inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200'
              : 'inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-200'
          }
        >
          {c.ok ? '✓' : '✕'} {t(`agent.tool.${c.name}`, { defaultValue: c.name })}
        </span>
      ))}
    </div>
  );
}

function VideoResultCard({ job }: { job: VideoGenerationJobPublic }) {
  const { t } = useTranslation();
  const url = job.outputUrl ?? undefined;
  return (
    <div className="mt-2 max-w-md space-y-2 rounded-xl border border-emerald-400/25 bg-white/[0.04] p-3">
      <p className="text-sm font-semibold text-emerald-300">✓ {t('agent.videoReady')}</p>
      {url ? (
        <div className="flex gap-3">
          <video src={url} controls playsInline className="h-40 w-24 rounded-lg bg-black object-contain" />
          <div className="min-w-0 flex-1 space-y-1.5 text-xs">
            <p className="text-violet-300/60">{new Date(job.completedAt ?? job.updatedAt).toLocaleString()}</p>
            <p className="text-violet-100/80">{job.progress ?? 100}% · {t('common.download')}</p>
            <a href={url} download target="_blank" rel="noreferrer" className="aura-btn-primary !px-3 !py-1.5 text-xs">
              {t('common.download')}
            </a>
          </div>
        </div>
      ) : (
        <p className="text-xs text-violet-300/60">{t(JOB_STATUS_KEY(job.status))}</p>
      )}
    </div>
  );
}
function JOB_STATUS_KEY(status: string): string {
  return STATUS_KEY[status] ?? 'status.processing';
}

export function AgentChatPanel({ workspace }: { workspace: AgentWorkspaceState }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [composerText, setComposerText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const videoMessageId = useMemo(() => {
    const newest = [...workspace.messages].reverse().find((m) => m.job);
    return newest?.id ?? null;
  }, [workspace.messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [workspace.messages, workspace.busy]);

  const canSend = composerText.trim().length > 0 && !workspace.busy;

  function submitComposer() {
    if (!canSend) return;
    const text = composerText.trim();
    setComposerText('');
    void workspace.send(text);
  }

  const watchingJob = workspace.messages.find((m) => m.id === videoMessageId && m.job && !TERMINAL_STATUSES.has(m.job.status))?.job ?? null;

  return (
    <div className="space-y-4">
      <div className="aura-panel-strong p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <textarea
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitComposer();
                }
              }}
              rows={2}
              placeholder={t('workspace.composerPlaceholder')}
              className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-violet-300/40 focus:border-fuchsia-400/60"
              aria-label={t('workspace.composerPlaceholder')}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <AgentStrategyPicker value={workspace.strategy} onChange={workspace.setStrategy} />
          <AgentModelPicker
            models={workspace.models}
            loading={workspace.modelsLoading}
            value={workspace.modelId}
            onChange={workspace.setModelId}
          />
          <div className="ms-auto flex items-center gap-2">
            <button
              type="button"
              onClick={workspace.openProductPicker}
              className="rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/15 px-3.5 py-2 text-xs font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/25"
            >
              <span className="me-1">+</span>
              {t('agent.addProduct')}
            </button>
            <button
              type="button"
              onClick={submitComposer}
              disabled={!canSend}
              className="aura-btn-primary !px-4 !py-2 text-sm"
              aria-label={t('agent.send')}
            >
              ➤
            </button>
          </div>
        </div>

        <div className="mt-3 border-t border-white/[0.07] pt-3">
          <ContextChips
            product={workspace.product}
            template={workspace.template}
            onPickProduct={workspace.openProductPicker}
          />
        </div>
      </div>

      <ProductPickerModal
        open={workspace.productPickerOpen}
        products={workspace.products}
        loading={workspace.productsLoading}
        onClose={workspace.closeProductPicker}
        onSelect={(p) => void workspace.selectProduct(p)}
        onImport={() => {
          workspace.closeProductPicker();
          navigate('/products/import');
        }}
      />

      <div className="space-y-4">
        {workspace.messages.map((m) => (
          <MessageRow key={m.id} message={m} />
        ))}

        {workspace.busy && (
          <div className="flex items-start gap-3">
            <AgentAvatar />
            <div className="flex items-center gap-2 pt-2 text-sm text-violet-300/70">
              <span className="h-2 w-2 animate-pulse rounded-full bg-fuchsia-400" />
              {t('agent.working')}
            </div>
          </div>
        )}

        {watchingJob && <div className="flex items-center gap-2 pl-11 text-xs text-violet-300/60">{'⟳'} {t(JOB_STATUS_KEY(watchingJob.status))}</div>}

        {workspace.confirmation && (
          <div className="aura-panel-strong ms-11 max-w-lg space-y-3 border-fuchsia-400/30 p-4">
            <p className="text-sm font-semibold text-white">{t('agent.confirmTitle')}</p>
            <p className="text-sm text-violet-100">{workspace.confirmation.credits > 0 ? t('agent.confirmCredits', { credits: workspace.confirmation.credits }) : ''}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void workspace.confirmAction()} disabled={workspace.busy} className="aura-btn-primary">
                {t('agent.confirmContinue')}
              </button>
              <button type="button" onClick={() => void workspace.declineAction()} disabled={workspace.busy} className="aura-btn-ghost">
                {t('agent.confirmCancel')}
              </button>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function MessageRow({ message }: { message: WorkspaceMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-2.5 text-sm text-white shadow-lg shadow-fuchsia-900/30">
          {message.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1">
        <AgentAvatar />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {message.errorCode ? (
          <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 p-3 text-sm text-rose-100">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-rose-300/80">{message.errorCode}</p>
            <p className="whitespace-pre-wrap">{message.text}</p>
          </div>
        ) : (
          <div className="text-sm leading-relaxed text-violet-50">{message.text}</div>
        )}
        <ToolCallsRow calls={message.toolCalls} />
        {message.job && <VideoResultCard job={message.job} />}
      </div>
    </div>
  );
}