import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  AgentConfirmation,
  AgentMessageRow,
  AgentToolCallResult,
  AgentTurnResult,
  AiModelOption,
  AiStrategy,
  LibraryTemplate,
  ProductRecord,
  UserSettingsPayload,
  VideoGenerationJobPublic,
} from '@aura/types';
import { api } from '../lib/api';

const CONVERSATION_KEY = 'aura:agent:conversation:v1';

export interface WorkspaceMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  errorCode?: string;
  toolCalls?: AgentToolCallResult[];
  job?: VideoGenerationJobPublic | null;
  createdAt: string;
}

let msgCounter = 0;
function nextMessageId(): string {
  msgCounter += 1;
  return `ws-msg-${Date.now()}-${msgCounter}`;
}

const TERMINAL_JOB_STATUSES = new Set(['completed', 'failed', 'canceled']);

function placeholderTemplate(id: string): LibraryTemplate {
  return {
    id,
    slug: id,
    name: id,
    description: null,
    category: '',
    subCategory: null,
    thumbnailUrl: null,
    previewVideoUrl: null,
    hasRealPreview: false,
    durationSeconds: null,
    aspectRatio: '9:16',
    creditsCost: 0,
    status: 'published',
    isPremium: false,
    isFeatured: false,
    sortOrder: 0,
    tags: [],
    scenes: [],
    supportedProductTypes: [],
    metadata: null,
  };
}

function jobKey(job: VideoGenerationJobPublic): string {
  return `${job.id}:${job.status}:${job.progress ?? ''}:${job.currentStage ?? ''}`;
}

export interface AgentWorkspaceState {
  conversationId: string | null;
  restoring: boolean;
  busy: boolean;
  messages: WorkspaceMessage[];
  confirmation: AgentConfirmation | null;
  product: ProductRecord | null;
  template: LibraryTemplate | null;
  products: ProductRecord[];
  productsLoading: boolean;
  models: AiModelOption[];
  modelsLoading: boolean;
  settings: UserSettingsPayload | null;
  strategy: AiStrategy;
  modelId: string | null;
  setStrategy: (strategy: AiStrategy) => void;
  setModelId: (modelId: string | null) => void;
  send: (text: string) => Promise<void>;
  confirmAction: () => Promise<void>;
  declineAction: () => Promise<void>;
  selectProduct: (product: ProductRecord) => Promise<void>;
  useTemplate: (template: LibraryTemplate) => Promise<void>;
  openProductPicker: () => void;
  closeProductPicker: () => void;
  productPickerOpen: boolean;
  lastError: string | null;
}

export function useAgentWorkspace(): AgentWorkspaceState {
  const { t, i18n } = useTranslation();
  const [conversationId, setConversationId] = useState<string | null>(() => localStorage.getItem(CONVERSATION_KEY));
  const [restoring, setRestoring] = useState(true);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
  const [confirmation, setConfirmation] = useState<AgentConfirmation | null>(null);
  const [product, setProduct] = useState<ProductRecord | null>(null);
  const [template, setTemplate] = useState<LibraryTemplate | null>(null);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [models, setModels] = useState<AiModelOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [settings, setSettings] = useState<UserSettingsPayload | null>(null);
  const [strategy, setStrategyState] = useState<AiStrategy>('balanced');
  const [modelId, setModelIdState] = useState<string | null>(null);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const conversationRef = useRef<string | null>(conversationId);
  const busyRef = useRef(false);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => clearPoll, [clearPoll]);

  const pushUser = useCallback((text: string) => {
    setMessages((prev) => [...prev, { id: nextMessageId(), role: 'user', text, createdAt: new Date().toISOString() }]);
  }, []);

  const pushAssistant = useCallback((turn: AgentTurnResult, extra?: Partial<WorkspaceMessage>) => {
    setMessages((prev) => [
      ...prev,
      {
        id: nextMessageId(),
        role: 'assistant',
        text: turn.message,
        errorCode: turn.errorCode,
        toolCalls: turn.toolCalls.length > 0 ? turn.toolCalls : undefined,
        createdAt: new Date().toISOString(),
        ...extra,
      },
    ]);
  }, []);

  const hydrateFromRows = useCallback((rows: AgentMessageRow[]) => {
    const restored: WorkspaceMessage[] = [];
    for (const row of rows) {
      if (row.role === 'user' && row.content) {
        restored.push({ id: row.id, role: 'user', text: row.content, createdAt: row.createdAt });
      } else if (row.role === 'assistant' && row.content) {
        restored.push({ id: row.id, role: 'assistant', text: row.content, createdAt: row.createdAt });
      }
    }
    setMessages(restored);
  }, []);

  const pollJob = useCallback(
    (jobId: string) => {
      clearPoll();
      pollRef.current = setInterval(async () => {
        try {
          const job = await api.getVideoJob(jobId);
          setMessages((prev) => {
            let changed = false;
            const next = prev.map((m) => {
              if (!m.job || m.job.id !== jobId) return m;
              if (jobKey(m.job) === jobKey(job)) return m;
              changed = true;
              return { ...m, job };
            });
            return changed ? next : prev;
          });
          if (TERMINAL_JOB_STATUSES.has(job.status)) {
            clearPoll();
          }
        } catch {
          clearPoll();
        }
      }, 3000);
    },
    [clearPoll],
  );

  const applyTurn = useCallback(
    (turn: AgentTurnResult) => {
      setConfirmation(turn.confirmation ?? null);
      const sel = turn.selections;
      if (sel) {
        if (sel.selectedProductId) {
          setProducts((prev) => {
            const match = prev.find((p) => p.id === sel.selectedProductId);
            if (match) setProduct(match);
            return prev;
          });
        }
        if (sel.selectedTemplateId) {
          setTemplate(placeholderTemplate(sel.selectedTemplateId));
        }
        if (sel.activeVideoJobId && turn.toolCalls.some((tc) => tc.name === 'video.create' && tc.ok)) {
          pollJob(sel.activeVideoJobId);
        }
      }
    },
    [pollJob],
  );

  const ensureConversation = useCallback(async (): Promise<string> => {
    if (conversationRef.current) return conversationRef.current;
    const created = await api.createAgentConversation({
      title: 'Aura workspace',
      language: i18n.resolvedLanguage ?? 'en',
    });
    conversationRef.current = created.id;
    setConversationId(created.id);
    localStorage.setItem(CONVERSATION_KEY, created.id);
    return created.id;
  }, [i18n]);

  const runTurn = useCallback(
    async (content: string, opts: { confirm?: boolean; optimisticProduct?: ProductRecord | null; optimisticTemplate?: LibraryTemplate | null } = {}) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setLastError(null);
      if (opts.optimisticProduct) setProduct(opts.optimisticProduct);
      if (opts.optimisticTemplate) setTemplate(opts.optimisticTemplate);
      try {
        const id = await ensureConversation();
        const turn = await api.sendAgentMessage(id, {
          content,
          strategy,
          modelId: modelId ?? undefined,
        });
        if (opts.confirm) setConfirmation(null);
        applyTurn(turn);
        if (turn.status === 'error') {
          pushAssistant(turn, { errorCode: turn.errorCode });
        } else {
          pushAssistant(turn);
        }
      } catch (err) {
        setLastError(err instanceof Error ? err.message : String(err));
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [applyTurn, ensureConversation, modelId, pushAssistant, strategy],
  );

  const restore = useCallback(async () => {
    setRestoring(true);
    try {
      const [productList, modelList, userSettings] = await Promise.all([
        api.listProducts().catch(() => [] as ProductRecord[]),
        api.listAiModels().catch(() => [] as AiModelOption[]),
        api.getUserSettings().catch(() => null as UserSettingsPayload | null),
      ]);
      setProducts(productList);
      setModels(modelList);
      setSettings(userSettings);
      setStrategyState((prev) => userSettings?.resolved.ai.strategy ?? prev);
      setModelIdState((prev) => prev ?? userSettings?.resolved.ai.model ?? null);

      const existingId = localStorage.getItem(CONVERSATION_KEY);
      if (existingId) {
        try {
          const detail = await api.getAgentConversation(existingId);
          if (detail.conversation.status === 'active') {
            conversationRef.current = existingId;
            setConversationId(existingId);
            hydrateFromRows(detail.messages);
            if (detail.conversation.pendingConfirmation) {
              setConfirmation({
                tool: detail.conversation.pendingConfirmation.tool,
                args: detail.conversation.pendingConfirmation.args,
                credits: detail.conversation.pendingConfirmation.credits,
              });
            }
            const pid = detail.conversation.selectedProductId;
            if (pid) {
              const match = productList.find((p) => p.id === pid);
              if (match) setProduct(match);
            }
            const tid = detail.conversation.selectedTemplateId;
            if (tid) {
              const tplList = await api.listTemplates().catch(() => [] as LibraryTemplate[]);
              const match = tplList.find((tp) => tp.id === tid || tp.slug === tid);
              setTemplate(match ?? placeholderTemplate(tid));
            }
            return;
          }
        } catch {
          /* stale conversation — start a new one */
        }
        localStorage.removeItem(CONVERSATION_KEY);
        conversationRef.current = null;
        setConversationId(null);
      }
    } finally {
      setProductsLoading(false);
      setModelsLoading(false);
      setRestoring(false);
    }
  }, [hydrateFromRows]);

  useEffect(() => {
    void restore();
  }, [restore]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busyRef.current) return;
      pushUser(trimmed);
      await runTurn(trimmed);
    },
    [pushUser, runTurn],
  );

  const confirmAction = useCallback(async () => {
    if (!confirmation || busyRef.current) return;
    pushUser(t('agent.confirmContinue', { defaultValue: 'Continue' }));
    await runTurn(t('agent.confirmContinue', { defaultValue: 'Continue' }), { confirm: true });
  }, [confirmation, pushUser, runTurn, t]);

  const declineAction = useCallback(async () => {
    if (!confirmation || busyRef.current) return;
    const reply = t('agent.cancelReply', { defaultValue: 'cancel' });
    pushUser(t('agent.confirmCancel', { defaultValue: 'Cancel' }));
    await runTurn(reply);
  }, [confirmation, pushUser, runTurn, t]);

  const selectProduct = useCallback(
    async (p: ProductRecord) => {
      if (busyRef.current) return;
      setProduct(p);
      setProductPickerOpen(false);
      pushUser(p.name);
      await runTurn(t('agent.useProduct', { defaultValue: 'Use the product {{name}} for creating my ad.', name: p.name }), {
        optimisticProduct: p,
      });
    },
    [pushUser, runTurn, t],
  );

  const useTemplate = useCallback(
    async (tp: LibraryTemplate) => {
      if (busyRef.current) return;
      setTemplate(tp);
      pushUser(t('agent.useTemplateFor', { defaultValue: 'Use the template {{name}}.', name: tp.name }));
      await runTurn(t('agent.createWithTemplate', { defaultValue: 'Create my ad using the template {{name}}.', name: tp.name }), {
        optimisticTemplate: tp,
      });
    },
    [pushUser, runTurn, t],
  );

  const value = useMemo<AgentWorkspaceState>(
    () => ({
      conversationId,
      restoring,
      busy,
      messages,
      confirmation,
      product,
      template,
      products,
      productsLoading,
      models,
      modelsLoading,
      settings,
      strategy,
      modelId,
      setStrategy: setStrategyState,
      setModelId: setModelIdState,
      send,
      confirmAction,
      declineAction,
      selectProduct,
      useTemplate,
      openProductPicker: () => setProductPickerOpen(true),
      closeProductPicker: () => setProductPickerOpen(false),
      productPickerOpen,
      lastError,
    }),
    [
      conversationId,
      restoring,
      busy,
      messages,
      confirmation,
      product,
      template,
      products,
      productsLoading,
      models,
      modelsLoading,
      settings,
      strategy,
      modelId,
      send,
      confirmAction,
      declineAction,
      selectProduct,
      useTemplate,
      productPickerOpen,
      lastError,
    ],
  );

  return value;
}