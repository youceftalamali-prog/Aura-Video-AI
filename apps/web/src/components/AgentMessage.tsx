import type { ProductRecord, ProductIntelligence, LibraryTemplate, VideoGenerationJobPublic } from '@aura/types';
import { useTranslation } from 'react-i18next';

export type StepKey = 'product' | 'strategy' | 'script' | 'storyboard' | 'template' | 'video' | 'render';

export interface StepState {
  key: StepKey;
  label: string;
  status: 'done' | 'active' | 'pending' | 'error';
  detail?: string;
}

export interface AgentAction {
  id: string;
  label: string;
  kind: 'create' | 'browse-templates' | 'library' | 'products';
}

export type AgentMessage =
  | { id: string; role: 'user'; contentType: 'text'; text: string }
  | (AgentMessageData & { id: string; role: 'agent' });

export type AgentMessageData =
  | { contentType: 'text'; text: string; actions?: AgentAction[] }
  | { contentType: 'product'; product: ProductRecord; intelligence: ProductIntelligence | null; template?: LibraryTemplate | null }
  | { contentType: 'progress'; steps: StepState[]; title?: string }
  | { contentType: 'video'; job: VideoGenerationJobPublic; assetUrl?: string }
  | { contentType: 'error'; text: string };

function AgentAvatar() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-lg shadow-fuchsia-900/40">
      <span className="text-sm font-black text-white">A</span>
    </span>
  );
}

function ProductCard({ product, intelligence, template }: { product: ProductRecord; intelligence: ProductIntelligence | null; template?: LibraryTemplate | null }) {
  const { t } = useTranslation();
  const benefit = intelligence?.marketingProfile?.primaryBenefit ?? product.description ?? '';
  const price = product.price ? `${product.price}${product.currency ? ` ${product.currency}` : ''}` : null;
  const category = intelligence?.analysis.category ?? '';
  return (
    <div className="mt-2 w-full max-w-md overflow-hidden rounded-xl border border-fuchsia-400/20 bg-white/[0.04]">
      <div className="flex gap-3 p-3">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="h-20 w-20 rounded-lg object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-white/[0.06] text-2xl">🛍</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">{product.name}</p>
          {category && <p className="text-xs capitalize text-violet-300/70">{category}</p>}
          {price && <p className="mt-0.5 text-sm font-semibold text-emerald-300">{price}</p>}
          {benefit && <p className="mt-1 line-clamp-2 text-xs text-violet-100/80">{benefit}</p>}
        </div>
      </div>
      {template && (
        <div className="border-t border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-violet-200/90">
          {t('agent.templateContext')}: <span className="font-semibold text-fuchsia-200">{template.name}</span>{' '}
          <span className="text-violet-300/60">· {template.aspectRatio} · {template.durationSeconds ?? 0}s</span>
        </div>
      )}
    </div>
  );
}

const STEP_ICON: Record<StepState['status'], string> = {
  done: '✓',
  active: '◌',
  pending: '○',
  error: '✕',
};

function ProgressPanel({ steps, title }: { steps: StepState[]; title?: string }) {
  return (
    <div className="mt-2 max-w-md space-y-1.5 rounded-xl border border-fuchsia-400/20 bg-white/[0.04] p-3">
      {title && <p className="text-xs font-semibold text-violet-200/90">{title}</p>}
      {steps.map((s) => (
        <div key={s.key} className="flex items-center gap-2 text-xs">
          <span
            className={
              s.status === 'done'
                ? 'flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/80 text-[10px] font-bold text-black'
                : s.status === 'active'
                  ? 'flex h-4 w-4 items-center justify-center rounded-full bg-fuchsia-500/80 text-[10px] font-bold text-white'
                  : s.status === 'error'
                    ? 'flex h-4 w-4 items-center justify-center rounded-full bg-rose-500/80 text-[10px] font-bold text-white'
                    : 'flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[10px] text-violet-300/50'
            }
          >
            {s.status === 'active' ? '…' : STEP_ICON[s.status]}
          </span>
          <span className={s.status === 'done' ? 'text-white' : s.status === 'pending' ? 'text-violet-300/50' : 'text-violet-100'}>
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

const JOB_LABEL_KEY: Record<string, string> = {
  queued: 'status.queued',
  processing: 'status.processing',
  composing: 'status.composing',
  rendering: 'status.rendering',
  completed: 'status.completed',
  failed: 'status.failed',
  canceled: 'status.canceled',
};

function VideoCard({ job, assetUrl }: { job: VideoGenerationJobPublic; assetUrl?: string }) {
  const { t } = useTranslation();
  const displayUrl = assetUrl || job.outputUrl || undefined;
  return (
    <div className="mt-2 max-w-md space-y-2 rounded-xl border border-emerald-400/25 bg-white/[0.04] p-3">
      <p className="text-sm font-semibold text-emerald-300">✓ {t('agent.videoReady')}</p>
      {displayUrl && (
        <div className="flex gap-3">
          <video src={displayUrl} controls playsInline className="h-40 w-24 rounded-lg bg-black object-contain" />
          <div className="min-w-0 flex-1 space-y-1 text-xs">
            <p className="truncate text-violet-100/80">{t('common.duration')}: {job.progress ?? 100}%</p>
            <p className="text-violet-300/60">{new Date(job.completedAt ?? job.updatedAt).toLocaleString()}</p>
            <a
              href="/library"
              className="inline-flex w-fit items-center gap-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              {t('common.download')}
            </a>
          </div>
        </div>
      )}
      {!displayUrl && (
        <div className="space-y-1 text-xs">
          <p className="text-violet-100/80">
            {t(JOB_LABEL_KEY[job.status] ?? 'status.processing')}
          </p>
          <p className="text-violet-300/50">{t('agent.renderingNote')}</p>
        </div>
      )}
    </div>
  );
}

export function AgentChatShell({ message, onAction }: { message: AgentMessageData; onAction: (action: AgentAction) => void }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1">
        <AgentAvatar />
      </div>
      <div className="min-w-0 flex-1">
        {message.contentType === 'text' && (
          <div className="space-y-2">
            <div className="text-sm leading-relaxed text-violet-50">{message.text}</div>
            {message.actions && message.actions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {message.actions.map((action) => (
                  <button key={action.id} type="button" onClick={() => onAction(action)} className="aura-btn-primary">
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {message.contentType === 'product' && (
          <ProductCard product={message.product} intelligence={message.intelligence} template={message.template} />
        )}
        {message.contentType === 'progress' && <ProgressPanel steps={message.steps} title={message.title} />}
        {message.contentType === 'video' && <VideoCard job={message.job} assetUrl={message.assetUrl} />}
        {message.contentType === 'error' && (
          <div className="mt-1 rounded-xl border border-rose-400/25 bg-rose-500/10 p-3 text-sm text-rose-100">{message.text}</div>
        )}
      </div>
    </div>
  );
}