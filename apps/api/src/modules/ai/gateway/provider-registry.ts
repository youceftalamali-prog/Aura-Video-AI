import { AppError } from '@aura/shared';
import type { IAIProvider } from '../interfaces/ai-provider.interface.js';

export type ProviderAvailability =
  | 'enabled'
  | 'disabled'
  | 'missing-key'
  | 'invalid'
  | 'not-configured';

/**
 * Registry of AI providers available to the gateway, keyed by provider name.
 * The first registered provider (or an explicitly marked default) is used
 * when no provider name is requested. Availability distinguishes configured,
 * enabled, disabled, missing-key and invalid states; routing only considers
 * providers in the enabled state.
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, IAIProvider>();
  private readonly availability = new Map<string, ProviderAvailability>();
  private defaultName: string | null = null;

  register(provider: IAIProvider, isDefault = false, availability: ProviderAvailability = 'enabled'): void {
    this.providers.set(provider.name, provider);
    this.availability.set(provider.name, availability);
    if (isDefault || this.defaultName === null) {
      this.defaultName = provider.name;
    }
  }

  setAvailability(name: string, availability: ProviderAvailability): void {
    if (!this.providers.has(name)) return;
    this.availability.set(name, availability);
  }

  get(name?: string): IAIProvider {
    const key = name ?? this.defaultName;
    const provider = key ? this.providers.get(key) : undefined;
    if (!provider) {
      throw new AppError('No AI provider is configured', 503, 'AI_PROVIDER_UNAVAILABLE');
    }
    return provider;
  }

  has(name: string): boolean {
    return this.providers.has(name);
  }

  availabilityOf(name: string): ProviderAvailability {
    return this.availability.get(name) ?? 'not-configured';
  }

  /** Providers that routing may select: only explicitly enabled providers. */
  isRoutable(name: string): boolean {
    return this.availabilityOf(name) === 'enabled';
  }

  all(): IAIProvider[] {
    return [...this.providers.values()];
  }

  clear(): void {
    this.providers.clear();
    this.availability.clear();
    this.defaultName = null;
  }
}
