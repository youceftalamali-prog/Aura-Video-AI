import type {
  ApiResponse,
  AuthResponse,
  DashboardStats,
  LoginInput,
  PublicUser,
  RegisterInput,
  ProductAnalysis,
  ProductUrlMetadata,
  AIAssistantResponse,
  AnalyzeProductTextInput,
  AnalyzeProductUrlInput,
  AnalyzeProductImageInput,
  AIAssistantInput,
  CreativeStrategy,
  AdScript,
  Storyboard,
  TemplateRecommendation,
  Template,
  GenerateStrategyInput,
  GenerateScriptInput,
  GenerateStoryboardInput,
  RecommendTemplateInput,
  VideoGenerationRequest,
  CreateVideoJobResult,
  VideoGenerationJobPublic,
  VideoCostEstimate,
  BrandKit,
  UpdateBrandKitInput,
  TemplateDefinition,
  VoiceGenerationRequest,
  VoiceGenerationResult,
  CaptionTrack,
  MusicTrack,
  MusicMixConfig,
  StudioProjectState,
  ProductImportResult,
  ProductRecord,
  ProductIntelligence,
  GeneratedHook,
  CreateVideoFromProductInput,
  CreateVideoFromProductResult,
  ImportTextInput,
  ImportImageInput,
  PublishingProviderInfo,
  PublishingCapabilities,
  SocialConnectionPublic,
  PublishingJobPublic,
  PublishingValidationResult,
  PublishRequest,
  PublishingPlatform,
  LibraryTemplateCategory,
  LibraryTemplate,
  InstantiateTemplateResult,
  GenerateFromTemplateResult,
  TemplateCustomization,
  TemplatePreviewConfig,
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  Asset,
  UserSettingsPayload,
  UpdateUserPreferencesInput,
  WorkspaceSettingsPayload,
  UpdateWorkspaceSettingsInput,
  AiModelOption,
} from '@aura/types';

export interface AuraClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null;
  onUnauthorized?: () => void;
}

export class AuraClient {
  private baseUrl: string;
  private getAccessToken?: () => string | null;
  private onUnauthorized?: () => void;

  constructor(options: AuraClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.getAccessToken = options.getAccessToken;
    this.onUnauthorized = options.onUnauthorized;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: { skipAuth?: boolean } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (!options.skipAuth && this.getAccessToken) {
      const token = this.getAccessToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });

    if (response.status === 401 && this.onUnauthorized) {
      this.onUnauthorized();
    }

    const data = (await response.json()) as ApiResponse<T>;

    if (!response.ok || !data.success) {
      const error = data.error ?? { code: 'UNKNOWN', message: 'Request failed' };
      throw new Error(error.message);
    }

    return data.data as T;
  }

  async register(input: RegisterInput): Promise<AuthResponse> {
    return this.request<AuthResponse>('POST', '/api/v1/auth/register', input, { skipAuth: true });
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    return this.request<AuthResponse>('POST', '/api/v1/auth/login', input, { skipAuth: true });
  }

  async logout(): Promise<void> {
    await this.request<void>('POST', '/api/v1/auth/logout');
  }

  async refresh(): Promise<AuthResponse> {
    return this.request<AuthResponse>('POST', '/api/v1/auth/refresh', undefined, { skipAuth: true });
  }

  async updatePreferredLanguage(language: string): Promise<{ user: PublicUser }> {
    return this.request('PATCH', '/api/v1/auth/me/language', { language });
  }

  async listAiModels(): Promise<AiModelOption[]> {
    return this.request<AiModelOption[]>('GET', '/api/v1/ai/models');
  }

  async me(): Promise<PublicUser> {
    return this.request<PublicUser>('GET', '/api/v1/auth/me');
  }

  async getDashboard(): Promise<DashboardStats> {
    return this.request<DashboardStats>('GET', '/api/v1/dashboard');
  }

  async health(): Promise<{ status: string }> {
    return this.request<{ status: string }>('GET', '/api/v1/health', undefined, { skipAuth: true });
  }

  async analyzeProductText(input: AnalyzeProductTextInput): Promise<ProductAnalysis> {
    return this.request<ProductAnalysis>('POST', '/api/v1/ai/analyze-product-text', input);
  }

  async analyzeProductUrl(
    input: AnalyzeProductUrlInput,
  ): Promise<{ analysis: ProductAnalysis; metadata: ProductUrlMetadata }> {
    return this.request<{ analysis: ProductAnalysis; metadata: ProductUrlMetadata }>(
      'POST',
      '/api/v1/ai/analyze-product-url',
      input,
    );
  }

  async analyzeProductImage(input: AnalyzeProductImageInput): Promise<ProductAnalysis> {
    return this.request<ProductAnalysis>('POST', '/api/v1/ai/analyze-product-image', input);
  }

  async aiAssistant(input: AIAssistantInput): Promise<AIAssistantResponse> {
    return this.request<AIAssistantResponse>('POST', '/api/v1/ai/assistant', input);
  }

  async generateStrategy(input: GenerateStrategyInput): Promise<CreativeStrategy> {
    return this.request<CreativeStrategy>('POST', '/api/v1/creative/strategy', input);
  }

  async generateScript(input: GenerateScriptInput): Promise<AdScript> {
    return this.request<AdScript>('POST', '/api/v1/creative/script', input);
  }

  async generateStoryboard(input: GenerateStoryboardInput): Promise<Storyboard> {
    return this.request<Storyboard>('POST', '/api/v1/creative/storyboard', input);
  }

  async recommendTemplate(input: RecommendTemplateInput): Promise<TemplateRecommendation[]> {
    return this.request<TemplateRecommendation[]>('POST', '/api/v1/creative/recommend-template', input);
  }

  async listCreativeTemplates(): Promise<Template[]> {
    return this.request<Template[]>('GET', '/api/v1/creative/templates');
  }

  async generateVideo(input: VideoGenerationRequest): Promise<CreateVideoJobResult> {
    return this.request<CreateVideoJobResult>('POST', '/api/v1/video/generate', input);
  }

  async getVideoJob(jobId: string): Promise<VideoGenerationJobPublic> {
    return this.request<VideoGenerationJobPublic>('GET', `/api/v1/video/jobs/${jobId}`);
  }

  async cancelVideoJob(jobId: string): Promise<VideoGenerationJobPublic> {
    return this.request<VideoGenerationJobPublic>('POST', `/api/v1/video/jobs/${jobId}/cancel`);
  }

  async estimateVideoCost(input: Pick<VideoGenerationRequest, 'duration' | 'scenes' | 'mode' | 'sourceImageUrl'>): Promise<VideoCostEstimate> {
    return this.request<VideoCostEstimate>('POST', '/api/v1/video/estimate', input);
  }

  async getBrandKit(): Promise<BrandKit> {
    return this.request<BrandKit>('GET', '/api/v1/studio/brand-kit');
  }

  async updateBrandKit(input: UpdateBrandKitInput): Promise<BrandKit> {
    return this.request<BrandKit>('PUT', '/api/v1/studio/brand-kit', input);
  }

  async listStudioTemplates(): Promise<TemplateDefinition[]> {
    return this.request<TemplateDefinition[]>('GET', '/api/v1/studio/templates');
  }

  async getStudioTemplate(id: string): Promise<TemplateDefinition> {
    return this.request<TemplateDefinition>('GET', `/api/v1/studio/templates/${id}`);
  }

  async generateVoice(input: VoiceGenerationRequest): Promise<VoiceGenerationResult> {
    return this.request<VoiceGenerationResult>('POST', '/api/v1/studio/voice', input);
  }

  async captionsFromText(input: { text: string; totalDuration: number }): Promise<CaptionTrack> {
    return this.request<CaptionTrack>('POST', '/api/v1/studio/captions/from-text', input);
  }

  async captionsFromAudio(audioUrl: string): Promise<CaptionTrack> {
    return this.request<CaptionTrack>('POST', '/api/v1/studio/captions/from-audio', { audioUrl });
  }

  async listMusic(): Promise<MusicTrack[]> {
    return this.request<MusicTrack[]>('GET', '/api/v1/studio/music');
  }

  async validateMusic(input: MusicMixConfig): Promise<MusicMixConfig | null> {
    return this.request<MusicMixConfig | null>('POST', '/api/v1/studio/music/validate', input);
  }

  async getStudioProjectState(projectId: string): Promise<StudioProjectState> {
    return this.request<StudioProjectState>('GET', `/api/v1/studio/projects/${projectId}/state`);
  }

  async saveStudioProjectState(projectId: string, patch: Partial<StudioProjectState>): Promise<StudioProjectState> {
    return this.request<StudioProjectState>('PUT', `/api/v1/studio/projects/${projectId}/state`, patch);
  }

  async listProducts(): Promise<ProductRecord[]> {
    return this.request<ProductRecord[]>('GET', '/api/v1/products');
  }

  async getProduct(id: string): Promise<ProductRecord> {
    return this.request<ProductRecord>('GET', `/api/v1/products/${id}`);
  }

  async deleteProduct(id: string): Promise<{ deleted: boolean }> {
    return this.request<{ deleted: boolean }>('DELETE', `/api/v1/products/${id}`);
  }

  async importProductUrl(url: string): Promise<ProductImportResult> {
    return this.request<ProductImportResult>('POST', '/api/v1/products/import/url', { url });
  }

  async importProductText(input: ImportTextInput): Promise<ProductImportResult> {
    return this.request<ProductImportResult>('POST', '/api/v1/products/import/text', input);
  }

  async importProductImage(input: ImportImageInput): Promise<ProductImportResult> {
    return this.request<ProductImportResult>('POST', '/api/v1/products/import/image', input);
  }

  async getProductIntelligence(id: string): Promise<ProductIntelligence> {
    return this.request<ProductIntelligence>('GET', `/api/v1/products/${id}/intelligence`);
  }

  async generateProductHooks(id: string): Promise<GeneratedHook[]> {
    return this.request<GeneratedHook[]>('POST', `/api/v1/products/${id}/hooks`);
  }

  async createVideoFromProduct(id: string, input?: Omit<CreateVideoFromProductInput, 'productId'>): Promise<CreateVideoFromProductResult> {
    return this.request<CreateVideoFromProductResult>('POST', `/api/v1/products/${id}/create-video`, {
      productId: id,
      ...input,
    });
  }

  async listPublishingProviders(): Promise<PublishingProviderInfo[]> {
    return this.request<PublishingProviderInfo[]>('GET', '/api/v1/publishing/providers');
  }

  async getPublishingCapabilities(platform: PublishingPlatform): Promise<PublishingCapabilities> {
    return this.request<PublishingCapabilities>('GET', `/api/v1/publishing/providers/${platform}/capabilities`);
  }

  async listSocialConnections(): Promise<SocialConnectionPublic[]> {
    return this.request<SocialConnectionPublic[]>('GET', '/api/v1/publishing/connections');
  }

  async connectSocialAccount(platform: PublishingPlatform): Promise<{ authorizationUrl: string; state: string }> {
    return this.request<{ authorizationUrl: string; state: string }>('POST', `/api/v1/publishing/connections/${platform}/connect`);
  }

  async completeSocialConnect(platform: PublishingPlatform, code: string, state?: string): Promise<SocialConnectionPublic> {
    return this.request<SocialConnectionPublic>('POST', `/api/v1/publishing/connections/${platform}/callback`, { code, state });
  }

  async validateSocialConnection(id: string): Promise<SocialConnectionPublic> {
    return this.request<SocialConnectionPublic>('POST', `/api/v1/publishing/connections/${id}/validate`);
  }

  async disconnectSocialAccount(id: string): Promise<{ disconnected: boolean }> {
    return this.request<{ disconnected: boolean }>('DELETE', `/api/v1/publishing/connections/${id}`);
  }

  async validatePublishing(data: { assetId: string; connectionId: string }): Promise<PublishingValidationResult> {
    return this.request<PublishingValidationResult>('POST', '/api/v1/publishing/validate', data);
  }

  async publishVideo(data: PublishRequest): Promise<PublishingJobPublic> {
    return this.request<PublishingJobPublic>('POST', '/api/v1/publishing/publish', data);
  }

  async scheduleVideo(data: PublishRequest): Promise<PublishingJobPublic> {
    return this.request<PublishingJobPublic>('POST', '/api/v1/publishing/schedule', data);
  }

  async listPublishingJobs(): Promise<PublishingJobPublic[]> {
    return this.request<PublishingJobPublic[]>('GET', '/api/v1/publishing/jobs');
  }

  async getPublishingJob(id: string): Promise<PublishingJobPublic> {
    return this.request<PublishingJobPublic>('GET', `/api/v1/publishing/jobs/${id}`);
  }

  async retryPublishingJob(id: string): Promise<PublishingJobPublic> {
    return this.request<PublishingJobPublic>('POST', `/api/v1/publishing/jobs/${id}/retry`);
  }

  async cancelPublishingJob(id: string): Promise<PublishingJobPublic> {
    return this.request<PublishingJobPublic>('POST', `/api/v1/publishing/jobs/${id}/cancel`);
  }

  async listTemplateCategories(): Promise<LibraryTemplateCategory[]> {
    return this.request<LibraryTemplateCategory[]>('GET', '/api/v1/templates/categories');
  }

  async listTemplates(params?: { category?: string; search?: string; featured?: boolean }): Promise<LibraryTemplate[]> {
    const q = new URLSearchParams();
    if (params?.category) q.set('category', params.category);
    if (params?.search) q.set('search', params.search);
    if (params?.featured) q.set('featured', 'true');
    const qs = q.toString();
    return this.request<LibraryTemplate[]>('GET', `/api/v1/templates${qs ? `?${qs}` : ''}`);
  }

  async listTemplatesByCategory(category: string): Promise<LibraryTemplate[]> {
    return this.request<LibraryTemplate[]>('GET', `/api/v1/templates/categories/${category}`);
  }

  async getTemplate(idOrSlug: string): Promise<LibraryTemplate> {
    return this.request<LibraryTemplate>('GET', `/api/v1/templates/${idOrSlug}`);
  }

  async instantiateTemplate(idOrSlug: string, productId: string): Promise<InstantiateTemplateResult> {
    return this.request<InstantiateTemplateResult>('POST', `/api/v1/templates/${idOrSlug}/instantiate`, { productId });
  }

  async generateFromTemplate(idOrSlug: string, productId: string, opts?: { aspectRatio?: string; duration?: number }): Promise<GenerateFromTemplateResult> {
    return this.request<GenerateFromTemplateResult>('POST', `/api/v1/templates/${idOrSlug}/generate`, { productId, ...opts });
  }

  async previewTemplate(idOrSlug: string, customization: TemplateCustomization): Promise<TemplatePreviewConfig> {
    return this.request<TemplatePreviewConfig>('POST', `/api/v1/templates/${idOrSlug}/preview`, customization);
  }

  async customizeTemplate(idOrSlug: string, customization: TemplateCustomization): Promise<InstantiateTemplateResult & { preview: TemplatePreviewConfig }> {
    return this.request('POST', `/api/v1/templates/${idOrSlug}/customize`, customization);
  }

  async generateFromTemplateCustom(idOrSlug: string, customization: TemplateCustomization): Promise<GenerateFromTemplateResult & { preview: TemplatePreviewConfig }> {
    return this.request('POST', `/api/v1/templates/${idOrSlug}/generate-custom`, customization);
  }

  async listProjects(): Promise<Project[]> {
    return this.request<Project[]>('GET', '/api/v1/library/projects');
  }

  async getProject(id: string): Promise<Project> {
    return this.request<Project>('GET', `/api/v1/library/projects/${id}`);
  }

  async createProject(input: Omit<CreateProjectInput, 'workspaceId'>): Promise<Project> {
    return this.request<Project>('POST', '/api/v1/library/projects', input);
  }

  async updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
    return this.request<Project>('PATCH', `/api/v1/library/projects/${id}`, input);
  }

  async deleteProject(id: string): Promise<{ deleted: boolean }> {
    return this.request<{ deleted: boolean }>('DELETE', `/api/v1/library/projects/${id}`);
  }

  async listAssets(type?: string): Promise<Asset[]> {
    const qs = type ? `?type=${encodeURIComponent(type)}` : '';
    return this.request<Asset[]>('GET', `/api/v1/library/assets${qs}`);
  }

  async getAsset(id: string): Promise<Asset> {
    return this.request<Asset>('GET', `/api/v1/library/assets/${id}`);
  }

  async exportAsset(id: string): Promise<{ assetId: string; url: string; mimeType: string; name: string; filename: string; sizeBytes: number }> {
    return this.request('GET', `/api/v1/library/assets/${id}/export`);
  }

  async getBillingOverview(): Promise<{
    wallet: { workspaceId: string; balance: number; lifetimeGranted: number; lifetimeUsed: number; updatedAt: string };
    subscription: {
      id: string; planId: string; status: string; interval: string;
      currentPeriodStart: string; currentPeriodEnd: string; cancelAtPeriodEnd: boolean;
    } | null;
    recentUsage: Array<{
      jobId: string; status: string; creditsCharged: number; mode: string | null;
      createdAt: string; completedAt: string | null;
    }>;
    estimateSample: { credits: number; duration: number; sceneCount: number; mode: string; breakdown: Array<{ item: string; credits: number }> };
  }> {
    return this.request('GET', '/api/v1/billing/overview');
  }

  async getCreditBalance(): Promise<{ balance: number; workspaceId: string }> {
    return this.request('GET', '/api/v1/billing/balance');
  }

  async estimateCredits(input: { duration: number; sceneCount: number; mode: 'text_to_video' | 'image_to_video' | 'storyboard' }) {
    return this.request('POST', '/api/v1/billing/estimate', input);
  }

  async requestCreditTopUp(amount: number): Promise<never> {
    return this.request('POST', '/api/v1/billing/top-up', { amount });
  }

  async getWorkspaceSettings(): Promise<{ id: string; name: string; slug: string; ownerId: string; createdAt: string; updatedAt: string }> {
    return this.request('GET', '/api/v1/billing/workspace');
  }

  async updateWorkspaceSettings(input: { name: string }) {
    return this.request('PATCH', '/api/v1/billing/workspace', input);
  }

  async createSubscriptionCheckout(plan: 'starter' | 'pro' | 'business'): Promise<{ checkoutUrl: string; sessionId: string }> {
    return this.request('POST', '/api/v1/billing/checkout/subscription', { plan });
  }

  async createCreditCheckout(pkg: 'small' | 'medium' | 'large'): Promise<{ checkoutUrl: string; sessionId: string }> {
    return this.request('POST', '/api/v1/billing/checkout/credits', { package: pkg });
  }

  async createBillingPortalSession(): Promise<{ url: string }> {
    return this.request('POST', '/api/v1/billing/portal');
  }

  async getSubscription(): Promise<unknown> {
    return this.request('GET', '/api/v1/billing/subscription');
  }

  async cancelSubscription(): Promise<{ status: string; cancelAtPeriodEnd: boolean }> {
    return this.request('POST', '/api/v1/billing/subscription/cancel');
  }

  async getUserSettings(): Promise<UserSettingsPayload> {
    return this.request<UserSettingsPayload>('GET', '/api/v1/settings/user');
  }

  async updateUserSettings(input: UpdateUserPreferencesInput): Promise<UserSettingsPayload> {
    return this.request<UserSettingsPayload>('PATCH', '/api/v1/settings/user', input);
  }

  async getSettingsWorkspace(workspaceId?: string): Promise<WorkspaceSettingsPayload> {
    const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
    return this.request<WorkspaceSettingsPayload>('GET', `/api/v1/settings/workspace${qs}`);
  }

  async updateSettingsWorkspace(input: UpdateWorkspaceSettingsInput & { workspaceId?: string }): Promise<WorkspaceSettingsPayload> {
    return this.request<WorkspaceSettingsPayload>('PATCH', '/api/v1/settings/workspace', input);
  }
}
