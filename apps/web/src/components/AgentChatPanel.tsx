import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { VideoGenerationJobPublic } from '@aura/types';
import { AgentModelPicker } from './AgentModelPicker';
import { AgentStrategyPicker } from './AgentStrategyPicker';
import { ContextChips } from './ContextChips';
import { ProductPickerModal } from './ProductPickerModal';
import type { AgentWorkspaceState, WorkspaceMessage } from '../agent/useAgentWorkspace';

const STATUS_KEY: Record<string, string> = {
  queued: 'status.queued',
  processing: 'status.processing',
  composing: 'status.composing',
  rendering: 'status.rendering',
  completed: 'status.completed',
  failed: 'status.failed',
  canceled: 'status.canceled',
};

function JOB_STATUS_KEY(status: string): string {
  return STATUS_KEY[status] ?? 'status.processing';
}

function AgentAvatar({ large = false }: { large?: boolean }) {
  return (
    <span
      className={
        large
          ? 'flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-lime-200 shadow-inner shadow-white/80'
          : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-100'
      }
    >
      <span
        className={
          large
            ? 'flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-950 text-2xl font-black text-white shadow-xl'
            : 'text-sm font-black'
        }
      >
        A
      </span>
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
              ? 'inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-100'
              : 'inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-rose-100'
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
    <div className="mt-2 max-w-md space-y-2 rounded-2xl border border-emerald-200 bg-white p-3 shadow-sm">
      <p className="text-sm font-bold text-emerald-700">✓ {t('agent.videoReady')}</p>
      {url ? (
        <div className="flex gap-3">
          <video src={url} controls playsInline className="h-40 w-24 rounded-xl bg-black object-contain" />
          <div className="min-w-0 flex-1 space-y-1.5 text-xs text-zinc-600">
            <p>{new Date(job.completedAt ?? job.updatedAt).toLocaleString()}</p>
            <p>{job.progress ?? 100}%</p>
            <a href={url} download target="_blank" rel="noreferrer" className="inline-flex rounded-xl bg-zinc-950 px-3 py-2 text-xs font-bold text-white">
              {t('common.download')}
            </a>
          </div>
        </div>
      ) : (
        <p className="text-xs text-zinc-500">{t(JOB_STATUS_KEY(job.status))}</p>
      )}
    </div>
  );
}

export function AgentChatPanel({ workspace }: { workspace: AgentWorkspaceState }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [composerText, setComposerText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [workspace.messages, workspace.busy, workspace.confirmation]);

  const canSend = composerText.trim().length > 0 && !workspace.busy;

  function submitComposer() {
    if (!canSend) return;
    const text = composerText.trim();
    setComposerText('');
    void workspace.send(text);
  }

  const quickActions = [
    {
      label: t('agent.quickProductLink', { defaultValue: 'رابط منتج' }),
      text: t('agent.quickProductLinkPrompt', { defaultValue: 'أريد إنشاء إعلان من رابط منتج. اطلب مني الرابط ثم حلله.' }),
    },
    {
      label: t('agent.quickAdImage', { defaultValue: 'صورة إعلانية' }),
      text: t('agent.quickAdImagePrompt', { defaultValue: 'أريد إنشاء صورة إعلانية احترافية لمنتج.' }),
    },
    {
      label: t('agent.quick4kVideo', { defaultValue: 'فيديو 4K' }),
      text: t('agent.quick4kVideoPrompt', { defaultValue: 'أريد إنشاء فيديو إعلاني 4K قصير لمنتج.' }),
    },
    {
      label: t('agent.quickTemplates', { defaultValue: 'قوالب جاهزة' }),
      text: t('agent.quickTemplatesPrompt', { defaultValue: 'اعرض لي القوالب الجاهزة المناسبة ثم ساعدني في اختيار قالب لإعلاني.' }),
    },
  ];

  return (
    <section className="relative min-h-[calc(100vh-7rem)] pb-64">
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

      {workspace.messages.length === 0 && !workspace.busy ? (
        <div className="flex min-h-[calc(100vh-23rem)] flex-col items-center justify-center px-4 text-center">
          <AgentAvatar large />
          <h2 className="mt-7 text-4xl font-black tracking-tight text-zinc-950 sm:text-5xl">Assistant Aura</h2>
          <p className="mt-4 max-w-md text-xl leading-8 text-zinc-500">{t('workspace.whatToCreate')}</p>
          <button type="button" className="mt-7 rounded-full bg-white px-6 py-4 text-lg font-bold text-zinc-900 shadow-sm ring-1 ring-zinc-200">
            ✦ {t('agent.changeAgent', { defaultValue: 'تغيير الوكيل' })}
          </button>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-5 px-1 py-4">
          {workspace.messages.map((m) => (
            <MessageRow key={m.id} message={m} />
          ))}

          {workspace.busy && (
            <div className="flex items-start gap-3">
              <AgentAvatar />
              <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-zinc-500 shadow-sm ring-1 ring-zinc-200">
                <span className="h-2 w-2 animate-pulse rounded-full bg-violet-600" />
                {t('agent.working')}
              </div>
            </div>
          )}

          {workspace.confirmation && (
            <div className="ms-11 max-w-lg space-y-3 rounded-3xl border border-violet-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-bold text-zinc-950">{t('agent.confirmTitle')}</p>
              <p className="text-sm text-zinc-600">
                {workspace.confirmation.credits > 0 ? t('agent.confirmCredits', { credits: workspace.confirmation.credits }) : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void workspace.confirmAction()} disabled={workspace.busy} className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                  {t('agent.confirmContinue')}
                </button>
                <button type="button" onClick={() => void workspace.declineAction()} disabled={workspace.busy} className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 disabled:opacity-50">
                  {t('agent.confirmCancel')}
                </button>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-[#f8f8f8] via-[#f8f8f8]/95 to-transparent px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8 sm:px-6 lg:left-72">
        <div className="mx-auto max-w-3xl">
          <div className="mb-3 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {quickActions.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => void workspace.send(item.text)}
                disabled={workspace.busy}
                className="shrink-0 rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-600 shadow-sm ring-1 ring-zinc-200 transition hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-60"
              >
                {item.label}
              </button>
            ))}
          </div>

          {workspace.lastError && <div className="mb-2 rounded-2xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700 ring-1 ring-red-100">{workspace.lastError}</div>}

          <div className="overflow-hidden rounded-[32px] bg-white shadow-2xl shadow-zinc-900/10 ring-1 ring-zinc-200">
            <div className="px-4 py-4">
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
                className="min-h-16 w-full resize-none bg-transparent px-1 text-[17px] leading-7 text-zinc-900 outline-none placeholder:text-zinc-400"
                aria-label={t('workspace.composerPlaceholder')}
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={workspace.openProductPicker} className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 text-zinc-900">
                    +
                  </button>
                  <button type="button" onClick={workspace.openProductPicker} className="rounded-full border border-zinc-200 px-4 py-3 text-sm font-bold text-zinc-800">
                    {t('agent.addProduct')}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="hidden sm:block">
                    <AgentStrategyPicker value={workspace.strategy} onChange={workspace.setStrategy} />
                  </div>
                  <div className="hidden sm:block">
                    <AgentModelPicker models={workspace.models} loading={workspace.modelsLoading} value={workspace.modelId} onChange={workspace.setModelId} />
                  </div>
                  <button type="button" className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 text-zinc-800">🎙</button>
                  <button
                    type="button"
                    onClick={submitComposer}
                    disabled={!canSend}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-950 text-white transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={t('agent.send')}
                  >
                    ➤
                  </button>
                </div>
              </div>
            </div>
            <div className="border-t border-zinc-100 bg-zinc-100 px-5 py-3">
              <ContextChips product={workspace.product} template={workspace.template} onPickProduct={workspace.openProductPicker} />
            </div>
          </div>

          <p className="mt-4 text-center text-sm leading-6 text-zinc-500">
            {t('agent.disclaimer', { defaultValue: 'قد يحتوي المحتوى المولد بالذكاء الاصطناعي على أخطاء. يرجى التحقق.' })}
          </p>
        </div>
      </div>
    </section>
  );
}

function MessageRow({ message }: { message: WorkspaceMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[24px] bg-emerald-100 px-4 py-3 text-[15px] leading-7 text-zinc-900 shadow-sm">
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
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-rose-500">{message.errorCode}</p>
            <p className="whitespace-pre-wrap">{message.text}</p>
          </div>
        ) : (
          <div className="whitespace-pre-wrap rounded-[24px] bg-white px-4 py-3 text-[15px] leading-7 text-zinc-900 shadow-sm ring-1 ring-zinc-200/70">{message.text}</div>
        )}
        <ToolCallsRow calls={message.toolCalls} />
        {message.job && <VideoResultCard job={message.job} />}
      </div>
    </div>
  );
}
