import { AppError } from '@aura/shared';
import type { AICapability, ModelDescriptor, ProductAnalysis } from '@aura/types';
import type {
  AnalyzeImageParams,
  AnalyzeProductParams,
  AnalyzeTextParams,
  GenerateStructuredParams,
  IAIProvider,
} from '../src/modules/ai/interfaces/ai-provider.interface.js';
import { AIGateway } from '../src/modules/ai/gateway/ai-gateway.js';
import { ModelRegistry } from '../src/modules/ai/gateway/model-registry.js';
import { ProviderRegistry } from '../src/modules/ai/gateway/provider-registry.js';
import { RoutingResolver } from '../src/modules/ai/gateway/routing-resolver.js';
import type { ModelAllowlistRepository, ModelAllowlistRow } from '../src/modules/ai/repositories/model-allowlist.repository.js';

class FakeProvider implements IAIProvider {
  readonly calls: Array<{ capability: string; modelId?: string }> = [];
  failNext = false;

  constructor(readonly name: string) {}

  async analyzeText(params: AnalyzeTextParams): Promise<string> {
    this.calls.push({ capability: 'analyze-text', modelId: params.modelId });
    if (this.failNext) {
      this.failNext = false;
      throw new AppError(`${this.name} failed`, 502, 'AI_PROVIDER_ERROR');
    }
    return `${this.name}:${params.modelId ?? 'default'}`;
  }

  async analyzeProduct(_params: AnalyzeProductParams): Promise<ProductAnalysis> {
    throw new AppError('not used', 500, 'TEST_NOT_USED');
  }

  async generateStructuredOutput<T>(_params: GenerateStructuredParams<T>): Promise<T> {
    throw new AppError('not used', 500, 'TEST_NOT_USED');
  }

  async analyzeImage(_params: AnalyzeImageParams): Promise<string> {
    throw new AppError('not used', 500, 'TEST_NOT_USED');
  }
}

class InMemoryAllowlistRepository implements ModelAllowlistRepository {
  private rows: ModelAllowlistRow[] = [];

  async list(): Promise<ModelAllowlistRow[]> {
    return this.rows.map((row) => ({ ...row }));
  }

  async replace(providerId: string, modelIds: string[]): Promise<void> {
    this.rows = [
      ...this.rows.filter((row) => row.providerId !== providerId),
      ...modelIds.map((modelId) => ({ providerId, modelId })),
    ];
  }
}

const openAiFast: ModelDescriptor = {
  id: 'openai/fast',
  provider: 'openai',
  capabilities: ['analyze-text', 'generate-structured'],
  contextWindow: 4096,
  promptPrice: 0.5,
  completionPrice: 0.5,
  source: 'env',
};

const openAiSmart: ModelDescriptor = {
  id: 'openai/smart',
  provider: 'openai',
  capabilities: ['analyze-text', 'generate-structured'],
  contextWindow: 32768,
  promptPrice: 3,
  completionPrice: 3,
  supportsStructuredOutputs: true,
  source: 'env',
};

const routerCheap: ModelDescriptor = {
  id: 'or/cheap',
  provider: 'openrouter',
  capabilities: ['analyze-text', 'generate-structured'],
  contextWindow: 4096,
  promptPrice: 0.1,
  completionPrice: 0.1,
  source: 'catalog',
};

const routerBalanced: ModelDescriptor = {
  id: 'or/balanced',
  provider: 'openrouter',
  capabilities: ['analyze-text', 'generate-structured'],
  contextWindow: 8192,
  promptPrice: 1,
  completionPrice: 1,
  isDefault: true,
  source: 'catalog',
};

const routerSmart: ModelDescriptor = {
  id: 'or/smart',
  provider: 'openrouter',
  capabilities: ['analyze-text', 'generate-structured'],
  contextWindow: 65536,
  promptPrice: 2,
  completionPrice: 2,
  supportsStructuredOutputs: true,
  source: 'catalog',
};

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${label}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main(): Promise<void> {
  const models = new ModelRegistry();
  models.registerMany([openAiFast, openAiSmart]);
  models.setSource(async () => [routerCheap, routerBalanced, routerSmart], 60_000);
  await models.refresh();

  const openai = new FakeProvider('openai');
  const openrouter = new FakeProvider('openrouter');
  const providers = new ProviderRegistry();
  providers.register(openai, true, 'enabled');
  providers.register(openrouter, false, 'enabled');
  const resolver = new RoutingResolver(providers, models, routerBalanced.id);
  const allowlist = new InMemoryAllowlistRepository();
  const gateway = new AIGateway(providers, resolver, models, null, allowlist);

  console.log('Scenario 1: routing strategies are deterministic');
  check('fast selects cheapest model', resolver.rank('fast', 'analyze-text')[0]?.modelId === routerCheap.id);
  check('balanced selects configured default', resolver.rank('balanced', 'analyze-text')[0]?.modelId === routerBalanced.id);
  check('smart selects largest context', resolver.rank('smart', 'analyze-text')[0]?.modelId === routerSmart.id);
  check('smart prefers structured output for structured capability', resolver.rank('smart', 'generate-structured')[0]?.modelId === routerSmart.id);

  console.log('Scenario 2: unavailable providers never route');
  providers.setAvailability('openrouter', 'missing-key');
  const unavailableRank = resolver.rank('balanced', 'analyze-text');
  check('missing-key provider excluded', unavailableRank.every((candidate) => candidate.provider.name !== 'openrouter'));
  providers.setAvailability('openrouter', 'disabled');
  check('disabled provider excluded', resolver.rank('smart', 'analyze-text').every((candidate) => candidate.provider.name !== 'openrouter'));
  providers.setAvailability('openrouter', 'enabled');

  console.log('Scenario 3: admin allowlist is enforced for listing and explicit selection');
  await gateway.setAllowedModels('openrouter', [routerBalanced.id]);
  const visible = await gateway.listModels();
  check('selected OpenRouter model visible', visible.some((model) => model.id === routerBalanced.id));
  check('unselected OpenRouter models hidden', visible.every((model) => model.provider !== 'openrouter' || model.id === routerBalanced.id));
  check('OpenAI models remain visible', visible.some((model) => model.provider === 'openai'));

  let blocked = false;
  try {
    await gateway.analyzeText({ systemPrompt: 'x', userPrompt: 'y', modelId: routerCheap.id });
  } catch (err) {
    blocked = err instanceof AppError && err.code === 'AI_MODEL_UNAVAILABLE';
  }
  check('unselected explicit model rejected', blocked);

  console.log('Scenario 4: selected model id reaches provider and fallback is safe');
  const first = await gateway.analyzeText({ systemPrompt: 'x', userPrompt: 'y' });
  check('automatic route uses selected default model', first === `openrouter:${routerBalanced.id}`, first);
  check('selected model id passed to provider', openrouter.calls.some((call) => call.modelId === routerBalanced.id));

  openrouter.failNext = true;
  const fallback = await gateway.analyzeText({ systemPrompt: 'x', userPrompt: 'y' });
  check('automatic failure falls back to OpenAI', fallback === `openai:${openAiFast.id}` || fallback === `openai:${openAiSmart.id}`, fallback);
  check('fallback provider received an explicit model id', openai.calls.some((call) => call.modelId === openAiFast.id || call.modelId === openAiSmart.id));

  console.log('Scenario 5: allowlist rejects unknown selections');
  let unknown = false;
  try {
    await gateway.setAllowedModels('openrouter', ['or/does-not-exist']);
  } catch (err) {
    unknown = err instanceof AppError && err.code === 'AI_MODEL_UNAVAILABLE';
  }
  check('unknown admin selection rejected', unknown);

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Test harness failed:', err);
  process.exit(1);
});
