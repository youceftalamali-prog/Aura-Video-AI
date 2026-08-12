import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import type { ProductRecord, ProductIntelligence, LibraryTemplate, VideoGenerationJobPublic } from '@aura/types';
import { api } from '../lib/api';
import { useLanguage } from '../language/LanguageProvider';
import { AuraNav } from '../components/AuraNav';
import { AgentComposer } from '../components/AgentComposer';
import { AgentChatShell, type AgentAction, type AgentMessage, type AgentMessageData, type StepKey, type StepState } from '../components/AgentMessage';
import { HomeTemplatesSection } from '../components/HomeTemplatesSection';

const STEPS_ORDER: StepKey[] = ['product', 'strategy', 'script', 'storyboard', 'template', 'video', 'render'];

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `m-${Date.now()}-${idCounter}`;
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { aiOutputLanguage, contentLanguage } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const templateParam = searchParams.get('template');

  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [templateContext, setTemplateContext] = useState<LibraryTemplate | null>(null);
  const [product, setProduct] = useState<ProductRecord | null>(null);
  const [intelligence, setIntelligence] = useState<ProductIntelligence | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesInitialized = useRef(false);

  useEffect(() => {
    api.listProducts().then(setProducts).catch(() => setProducts([])).finally(() => setProductsLoading(false));
  }, []);

  // Hydrate template context from query param, then reveal the chat
  useEffect(() => {
    let cancelled = false;
    async function init() {
      let templateName: string | null = null;
      if (templateParam) {
        try {
          const tpl = await api.getTemplate(templateParam);
          if (cancelled) return;
          setTemplateContext(tpl);
          templateName = tpl.name;
        } catch {
          templateName = null;
        }
      }
      if (cancelled) return;
      if (!messagesInitialized.current) {
        messagesInitialized.current = true;
        setMessages(buildGreeting(t, templateName));
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateParam]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const pushUser = useCallback((text: string) => {
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', contentType: 'text', text }]);
  }, []);

  const pushAgent = useCallback((msg: AgentMessageData) => {
    setMessages((prev) => [...prev, { ...msg, id: nextId(), role: 'agent' }]);
  }, []);

  const showError = useCallback(
    (message: string) => {
      pushAgent({ contentType: 'error', text: message });
    },
    [pushAgent],
  );

  async function importProduct(
    kind: 'url' | 'text' | 'image',
    input: { url?: string; name?: string; description?: string; base64?: string; mimeType?: string },
  ) {
    if (busy) return;
    setBusy(true);
    try {
      const result =
        kind === 'url'
          ? await api.importProductUrl(input.url!)
          : kind === 'text'
            ? await api.importProductText({ name: input.name!, description: input.description! })
            : await api.importProductImage({ imageBase64: input.base64, mimeType: input.mimeType });
      const p = result.product;
      const intel = result.intelligence;
      setProduct(p);
      setIntelligence(intel);
      setProducts((prev) => (prev.some((x) => x.id === p.id) ? prev : [p, ...prev]));
      pushAgent({ contentType: 'product', product: p, intelligence: intel, template: templateContext });
      pushAgent(analyzedMessage(t, p, templateContext));
    } catch (err) {
      showError(err instanceof Error ? err.message : t('agent.importFailed', { defaultValue: 'Product import failed.' }));
    } finally {
      setBusy(false);
    }
  }

  async function handleSendText(text: string) {
    if (busy) return;
    pushUser(text);

    const urlMatch = text.match(/https?:\/\/\S+/i);
    if (urlMatch) {
      await importProduct('url', { url: urlMatch[0] });
      return;
    }

    setBusy(true);
    try {
      const result = await api.aiAssistant({
        message: text,
        language: aiOutputLanguage,
        contentLanguage,
        productId: product?.id ?? undefined,
        productAnalysis: intelligence?.analysis ?? undefined,
      });
      let agentText = result.message;
      let actions: AgentAction[] = [];
      if (result.intent.intent === 'CREATE_PRODUCT_AD' || result.intent.intent === 'CREATE_VIDEO') {
        if (!product) {
          agentText = t('agent.needProduct', {
            defaultValue: 'To create a video I need your product first. Paste a product link, upload an image, or choose an imported product.',
          });
          actions = [{ id: nextId(), label: t('agent.browseTemplates', { defaultValue: 'Browse templates' }), kind: 'browse-templates' }];
        } else {
          agentText = t('agent.readyToCreate', {
            defaultValue: 'I can create a video from {{name}}. Shall I start?',
            name: product.name,
          });
          actions = [{ id: nextId(), label: t('agent.createVideo', { defaultValue: 'Create my ad' }), kind: 'create' }];
        }
      }
      pushAgent({ contentType: 'text', text: agentText, actions });
    } catch (err) {
      showError(err instanceof Error ? err.message : t('agent.assistantFailed', { defaultValue: 'Assistant failed.' }));
    } finally {
      setBusy(false);
    }
  }

  function handleImportUrl(url: string) {
    pushUser(`🔗 ${url}`);
    void importProduct('url', { url });
  }

  function handleImportDescription(name: string, description: string) {
    const clipped = description.length > 120 ? `${description.slice(0, 120)}…` : description;
    pushUser(`📝 ${name} — ${clipped}`);
    void importProduct('text', { name, description });
  }

  function handleImportImage(file: File) {
    pushUser(`🖼 ${file.name} (${Math.round(file.size / 1024)} KB)`);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1]! : result;
      void importProduct('image', { base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  }

  async function handleUseProduct(productId: string) {
    const p = products.find((x) => x.id === productId);
    pushUser(`🗂 ${p?.name ?? productId}`);
    if (!p) return;
    setBusy(true);
    try {
      const intel = await api.getProductIntelligence(productId);
      setProduct(p);
      setIntelligence(intel);
      pushAgent({ contentType: 'product', product: p, intelligence: intel, template: templateContext });
      pushAgent(analyzedMessage(t, p, templateContext));
    } catch (err) {
      showError(err instanceof Error ? err.message : t('agent.importFailed', { defaultValue: 'Product import failed.' }));
    } finally {
      setBusy(false);
    }
  }

  function handleAgentAction(action: AgentAction) {
    if (action.kind === 'create') {
      void runCreate();
    } else if (action.kind === 'browse-templates') {
      setTemplateContext(null);
      navigate('/templates');
    } else if (action.kind === 'library') {
      navigate('/library');
    } else if (action.kind === 'products') {
      navigate('/products');
    }
  }

  async function runCreate() {
    if (busy || !product) {
      if (!product) {
        pushAgent({
          contentType: 'text',
          text: t('agent.needProductFirst', { defaultValue: 'First, send me a product link, image, or choose an imported product.' }),
        });
      }
      return;
    }
    setBusy(true);
    const stepsInit = STEPS_ORDER.map((key) => ({ key, label: t(`agent.step.${key}`), status: 'pending' as const }));
    const pid = nextId();
    setMessages((prev) => [
      ...prev,
      { id: pid, role: 'agent', contentType: 'progress', steps: stepsInit, title: t('agent.creating', { defaultValue: 'Aura is creating your ad…' }) },
    ]);

    const mark = (key: StepKey, status: StepState['status'], detail?: string) => {
      setMessages((msgs) =>
        msgs.map((m) => (m.id === pid && m.contentType === 'progress' ? { ...m, steps: m.steps.map((s) => (s.key === key ? { ...s, status, detail } : s)) } : m)),
      );
    };

    try {
      mark('product', 'done');

      let storyboard: { duration: number; aspectRatio: string; scenes: Array<{ order: number; duration: number; visualPrompt: string; textOverlay?: string; cameraDirection?: string }> };
      let recommendedTemplate: string | undefined;
      let templateId: string | undefined;

      if (templateContext) {
        mark('template', 'active');
        const gen = await api.generateFromTemplate(templateContext.slug, product.id, { aspectRatio: '9:16', duration: 15 });
        storyboard = gen.storyboard;
        templateId = gen.templateId;
        recommendedTemplate = templateContext.name;
        mark('strategy', 'done');
        mark('script', 'done');
        mark('storyboard', 'done');
        mark('template', 'done');
      } else {
        mark('strategy', 'active');
        const flowResult = await api.createVideoFromProduct(product.id, { duration: 15, aspectRatio: '9:16' });
        storyboard = flowResult.storyboard;
        recommendedTemplate = flowResult.templateRecommendations?.[0]?.name;
        mark('strategy', 'done');
        mark('script', 'done');
        mark('storyboard', 'done');
        mark('template', 'done', recommendedTemplate ?? undefined);
      }

      const project = await api.createProject({
        name: `${product.name} — ${recommendedTemplate ? 'Template ad' : 'Aura ad'}`,
        templateId: templateId as never,
        productId: product.id,
      });
      mark('video', 'done');

      const scenes = storyboard.scenes.map((s) => ({
        order: s.order,
        duration: s.duration,
        visualPrompt: s.visualPrompt,
        onScreenText: s.textOverlay,
        cameraDirection: s.cameraDirection,
      }));

      mark('render', 'active');
      const jobResult = await api.generateVideo({
        projectId: project.id,
        templateId: templateId as never,
        aspectRatio: '9:16',
        duration: storyboard.duration,
        scenes,
        idempotencyKey: `aura-agent-${product.id}-${Date.now()}`,
      });

      pollRef.current = setInterval(async () => {
        try {
          const job = await api.getVideoJob(jobResult.jobId);
          if (job.status === 'completed') {
            if (pollRef.current) clearInterval(pollRef.current);
            mark('render', 'done', 'completed');
            pushAgent({ contentType: 'video', job: job as VideoGenerationJobPublic });
            pushAgent({
              contentType: 'text',
              text: t('agent.afterReady', {
                defaultValue: 'Your video is ready and saved to your library. Download or publish it from there.',
              }),
              actions: [
                { id: nextId(), label: t('nav.library'), kind: 'library' },
                { id: nextId(), label: t('agent.createAnother', { defaultValue: 'Create another' }), kind: 'products' },
              ],
            });
            setBusy(false);
          } else if (job.status === 'failed' || job.status === 'canceled') {
            if (pollRef.current) clearInterval(pollRef.current);
            mark('render', 'error', job.error ?? job.status);
            showError(job.error ?? t('agent.renderFailed', { defaultValue: 'Rendering failed.' }));
            setBusy(false);
          } else {
            mark('render', 'active', job.currentStage ?? job.status);
          }
        } catch (err) {
          if (pollRef.current) clearInterval(pollRef.current);
          mark('render', 'error', 'error');
          showError(err instanceof Error ? err.message : t('agent.pollFailed', { defaultValue: 'Could not reach the render service.' }));
          setBusy(false);
        }
      }, 3000);
    } catch (err) {
      mark('render', 'error');
      showError(err instanceof Error ? err.message : t('agent.createFailed', { defaultValue: 'Could not create your video. Your creative pipeline is ready, however.' }));
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <AuraNav />
      <main className="mx-auto flex w-full max-w-5xl flex-col px-4 pb-8 pt-6">
        <div className="mb-8 text-center">
          <span className="aura-badge border border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-200">
            <span className="text-[10px]">✦</span>
            {t('home.heroBadge', { defaultValue: 'AI Marketing Agent' })}
          </span>
          <h1 className="mt-4 text-4xl font-black tracking-tight">
            AURA <span className="aura-gradient-text">VIDEO AI</span>
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-violet-200/80">
            {t('home.heroSub', {
              defaultValue: 'Paste a product link, upload an image, or describe your product. Aura builds a TikTok-style vertical ad you can preview and download.',
            })}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-violet-300/60">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">{t('home.stepProduct', { defaultValue: 'Import product' })}</span>
            <span className="text-fuchsia-300/50">→</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">{t('home.stepAnalyze', { defaultValue: 'AI analysis' })}</span>
            <span className="text-fuchsia-300/50">→</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">{t('home.stepTemplate', { defaultValue: 'Template' })}</span>
            <span className="text-fuchsia-300/50">→</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">{t('home.stepRender', { defaultValue: 'Vertical video' })}</span>
          </div>
        </div>

        <section className="mx-auto w-full max-w-3xl space-y-5">
          {messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-2.5 text-sm text-white shadow-lg shadow-fuchsia-900/30">
                  {m.text}
                </div>
              </div>
            ) : (
              <AgentChatShell key={m.id} message={m} onAction={handleAgentAction} />
            ),
          )}
          {busy && (
            <div className="flex items-center gap-2 pl-11 text-sm text-violet-300/70">
              <span className="h-2 w-2 animate-pulse rounded-full bg-fuchsia-400" />
              {t('agent.thinking', { defaultValue: 'Aura is thinking…' })}
            </div>
          )}
          <div ref={bottomRef} />
        </section>

        <section className="mx-auto mt-6 space-y-3">
          {templateContext && (
            <div className="flex items-center gap-3 rounded-2xl border border-fuchsia-400/35 bg-fuchsia-500/10 px-4 py-3 shadow-[0_0_40px_rgba(217,70,239,0.15)]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 text-lg shadow-lg shadow-fuchsia-900/50">
                ▦
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-fuchsia-200/80">
                  {t('home.templateSelected', { defaultValue: 'Template selected' })}
                </p>
                <p className="truncate text-sm font-semibold text-white" title={templateContext.name}>
                  {templateContext.name}
                </p>
                <p className="text-[11px] text-violet-300/70">
                  {templateContext.aspectRatio} · {templateContext.durationSeconds ?? 0}s — {t('home.templateHint', { defaultValue: 'I will use it for your ad once a product is ready.' })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTemplateContext(null)}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-violet-200 transition hover:border-rose-400/40 hover:text-rose-200"
                aria-label={t('common.close')}
              >
                ✕
              </button>
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-[#151023]/80 p-4 shadow-[0_0_60px_rgba(147,87,246,0.14)] backdrop-blur-sm sm:p-5">
            <AgentComposer
              products={products}
              productsLoading={productsLoading}
              busy={busy}
              onSendText={handleSendText}
              onImportUrl={handleImportUrl}
              onImportImage={handleImportImage}
              onImportDescription={handleImportDescription}
              onUseProduct={handleUseProduct}
            />
          </div>
        </section>
      </main>

      <HomeTemplatesSection />

      <footer className="border-t border-white/10 py-6 text-center text-xs text-violet-300/50">
        AURA VIDEO AI · AI Marketing Agent
      </footer>
    </div>
  );
}

function buildGreeting(
  t: (key: string, opts?: Record<string, unknown>) => string,
  templateName: string | null,
): AgentMessage[] {
  if (templateName) {
    return [
      {
        id: nextId(),
        role: 'agent',
        contentType: 'text',
        text: t('agent.greetingTemplate', {
          defaultValue: 'Great choice. I will use {{name}}.\nSend me your product link or choose a product.',
          name: templateName,
        }) as string,
      },
    ];
  }
  return [
    {
      id: nextId(),
      role: 'agent',
      contentType: 'text',
      text: t('agent.greeting'),
    },
  ];
}

function analyzedMessage(
  t: (key: string, opts?: Record<string, unknown>) => string,
  p: ProductRecord,
  template?: LibraryTemplate | null,
): AgentMessageData {
  return {
    contentType: 'text',
    text: template
      ? (t('agent.analyzedWithTemplate', {
          defaultValue: 'I analyzed {{name}}. I will use {{template}} to create your vertical ad — ready?',
          name: p.name,
          template: template.name,
        }) as string)
      : (t('agent.analyzed', {
          defaultValue: 'I analyzed {{name}}. I recommend a short vertical video — want me to create it?',
          name: p.name,
        }) as string),
    actions: [
      { id: nextId(), label: (t('agent.createVideo', { defaultValue: 'Create my ad' }) as string), kind: 'create' as const },
      { id: nextId(), label: (t('agent.browseTemplates', { defaultValue: 'Browse templates' }) as string), kind: 'browse-templates' as const },
    ],
  };
}