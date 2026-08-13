import type { AICapability, ModelDescriptor } from '@aura/types';

export type CatalogSource = () => Promise<ModelDescriptor[]>;

/**
 * Registry of model descriptors for the AI gateway.
 * Environment-seeded models are static; a catalog source (e.g. the OpenRouter
 * catalog) can be attached and is cached in-process with a TTL. A refresh can
 * be forced, and an explicit modelId miss triggers one forced refresh so a
 * just-published model is picked up before failing.
 */
export class ModelRegistry {
  private readonly staticModels = new Map<string, ModelDescriptor>();
  private readonly staticAliases = new Map<string, string>();
  private dynamicModels = new Map<string, ModelDescriptor>();
  private dynamicAliases = new Map<string, string>();
  private source: CatalogSource | null = null;
  private ttlMs = 0;
  private refreshedAt: number | null = null;
  private lastError: string | null = null;
  private refreshPromise: Promise<ModelDescriptor[]> | null = null;

  register(descriptor: ModelDescriptor): void {
    this.staticModels.set(descriptor.id, descriptor);
    for (const alias of descriptor.aliases ?? []) {
      this.staticAliases.set(alias, descriptor.id);
    }
  }

  registerMany(descriptors: ModelDescriptor[]): void {
    for (const descriptor of descriptors) this.register(descriptor);
  }

  setSource(source: CatalogSource, ttlMs: number): void {
    this.source = source;
    this.ttlMs = ttlMs;
  }

  hasSource(): boolean {
    return this.source !== null;
  }

  /** Forces a catalog refresh (coalesced when already in flight). */
  async refresh(): Promise<ModelDescriptor[]> {
    if (!this.source) {
      return this.list();
    }
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    const promise = this.doRefresh();
    this.refreshPromise = promise;
    try {
      return await promise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async doRefresh(): Promise<ModelDescriptor[]> {
    try {
      const descriptors = await this.source!();
      const byId = new Map<string, ModelDescriptor>();
      const byAlias = new Map<string, string>();
      for (const descriptor of descriptors) {
        byId.set(descriptor.id, descriptor);
        for (const alias of descriptor.aliases ?? []) byAlias.set(alias, descriptor.id);
      }
      this.dynamicModels = byId;
      this.dynamicAliases = byAlias;
      this.refreshedAt = Date.now();
      this.lastError = null;
      return descriptors;
    } catch (err) {
      this.lastError = (err as Error).message ?? 'catalog refresh failed';
      throw err;
    }
  }

  /** Refreshes only when the cache is missing, stale, or never loaded. */
  async refreshIfStale(): Promise<void> {
    if (!this.source || this.isFresh()) return;
    await this.refresh();
  }

  isFresh(): boolean {
    if (this.refreshedAt === null) return false;
    if (this.ttlMs <= 0) return true;
    return Date.now() - this.refreshedAt < this.ttlMs;
  }

  resolve(modelOrAlias: string): ModelDescriptor | null {
    const staticId = this.staticAliases.get(modelOrAlias) ?? modelOrAlias;
    const staticModel = this.staticModels.get(staticId);
    if (staticModel) return staticModel;
    const dynamicId = this.dynamicAliases.get(modelOrAlias) ?? modelOrAlias;
    return this.dynamicModels.get(dynamicId) ?? null;
  }

  /** Resolves with one forced refresh on miss (e.g. for explicit modelId requests). */
  async resolveWithRefresh(modelOrAlias: string): Promise<ModelDescriptor | null> {
    const hit = this.resolve(modelOrAlias);
    if (hit) return hit;
    if (this.source) await this.refresh();
    return this.resolve(modelOrAlias);
  }

  list(): ModelDescriptor[] {
    return [...this.staticModels.values(), ...this.dynamicModels.values()];
  }

  supports(modelOrAlias: string, capability: AICapability): boolean {
    const descriptor = this.resolve(modelOrAlias);
    return descriptor ? descriptor.capabilities.includes(capability) : false;
  }

  status(): {
    staticCount: number;
    catalogCount: number;
    loaded: boolean;
    fresh: boolean;
    refreshedAt: number | null;
    ttlMs: number;
    lastError: string | null;
  } {
    return {
      staticCount: this.staticModels.size,
      catalogCount: this.dynamicModels.size,
      loaded: this.refreshedAt !== null,
      fresh: this.isFresh(),
      refreshedAt: this.refreshedAt,
      ttlMs: this.ttlMs,
      lastError: this.lastError,
    };
  }
}
