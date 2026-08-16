import { AppError } from '@aura/shared';
import type { AICapability, ModelDescriptor } from '@aura/types';

/** Minimal shape of one entry of the OpenRouter /models catalog. */
export interface OpenRouterCatalogEntry {
  id: string;
  name: string;
  contextLength: number | null;
  maxOutputTokens: number | null;
  inputModalities: string[];
  outputModalities: string[];
  promptPrice: number;
  completionPrice: number;
  supportsStructuredOutputs: boolean;
}

interface RawCatalogEntry {
  id?: unknown;
  name?: unknown;
  context_length?: unknown;
  architecture?: {
    input_modalities?: unknown;
    output_modalities?: unknown;
  };
  pricing?: {
    prompt?: unknown;
    completion?: unknown;
  };
  top_provider?: {
    context_length?: unknown;
    max_completion_tokens?: unknown;
  };
  supported_parameters?: unknown;
}

interface RawCatalogResponse {
  data?: unknown;
}

/**
 * Fetches the public OpenRouter model catalog.
 * The catalog is public (no key required), but the key is sent when configured.
 */
export async function fetchOpenRouterCatalog(
  baseUrl: string,
  apiKey?: string,
  timeoutMs = 30000,
): Promise<OpenRouterCatalogEntry[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new AppError(
        `OpenRouter catalog fetch failed: ${response.status}`,
        502,
        'AI_CATALOG_FETCH_FAILED',
        { status: response.status, body: errText.slice(0, 300) },
      );
    }

    const payload = (await response.json()) as RawCatalogResponse;
    if (!Array.isArray(payload.data)) {
      throw new AppError('OpenRouter catalog response has no data array', 502, 'AI_CATALOG_INVALID');
    }
    return payload.data.map(parseCatalogEntry).filter((entry): entry is OpenRouterCatalogEntry => entry !== null);
  } catch (err) {
    if (err instanceof AppError) throw err;
    if ((err as unknown as Error).name === 'AbortError') {
      throw new AppError('OpenRouter catalog fetch timed out', 504, 'AI_CATALOG_TIMEOUT');
    }
    throw new AppError(
      `OpenRouter catalog fetch failed: ${(err as unknown as Error).message}`,
      502,
      'AI_CATALOG_FETCH_FAILED',
    );
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Tolerant parser: every field is optional; entries that cannot serve text
 * output are skipped. Pricing strings are converted to USD per 1M tokens.
 */
export function parseCatalogEntry(raw: unknown): OpenRouterCatalogEntry | null {
  const entry = (raw ?? {}) as RawCatalogEntry;
  const id = typeof entry.id === 'string' ? entry.id : '';
  if (!id) return null;

  const inputModalities = toModalityList(entry.architecture?.input_modalities);
  const outputModalities = toModalityList(entry.architecture?.output_modalities);
  if (!outputModalities.includes('text')) return null;

  const contextLength =
    toPositiveInt(entry.context_length) ?? toPositiveInt(entry.top_provider?.context_length) ?? null;
  const maxOutputTokens = toPositiveInt(entry.top_provider?.max_completion_tokens) ?? null;

  const parameters = toParameterList(entry.supported_parameters);
  const supportsStructuredOutputs =
    parameters.includes('structured_outputs') || parameters.includes('response_format');

  return {
    id,
    name: typeof entry.name === 'string' ? entry.name : id,
    contextLength,
    maxOutputTokens,
    inputModalities,
    outputModalities,
    promptPrice: toPricePerMillion(entry.pricing?.prompt),
    completionPrice: toPricePerMillion(entry.pricing?.completion),
    supportsStructuredOutputs,
  };
}

/** Maps a catalog entry to a gateway ModelDescriptor for the openrouter provider. */
export function toModelDescriptor(entry: OpenRouterCatalogEntry, isDefault = false): ModelDescriptor {
  const capabilities: AICapability[] = ['analyze-text', 'analyze-product', 'generate-structured'];
  const supportsVision = entry.inputModalities.includes('image');
  if (supportsVision) capabilities.push('analyze-image');

  return {
    id: entry.id,
    provider: 'openrouter',
    displayName: entry.name,
    capabilities,
    contextWindow: entry.contextLength ?? undefined,
    maxOutputTokens: entry.maxOutputTokens ?? undefined,
    supportsVision,
    inputModalities: entry.inputModalities,
    outputModalities: entry.outputModalities,
    promptPrice: entry.promptPrice,
    completionPrice: entry.completionPrice,
    supportsStructuredOutputs: entry.supportsStructuredOutputs,
    source: 'catalog',
    isDefault,
  };
}

function toModalityList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function toParameterList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function toPositiveInt(value: unknown): number | null {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.floor(num);
}

function toPricePerMillion(value: unknown): number {
  const num = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN;
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num * 1_000_000 * 1000) / 1000;
}
