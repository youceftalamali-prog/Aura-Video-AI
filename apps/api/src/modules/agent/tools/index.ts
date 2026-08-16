import type { BillingToolDeps, SettingsToolDeps } from './billing.tools.js';
import { createBillingTools, createSettingsTools } from './billing.tools.js';
import type { CreativeToolDeps } from './creative.tools.js';
import { createCreativeTools } from './creative.tools.js';
import type { ProductToolDeps } from './products.tools.js';
import { createProductTools } from './products.tools.js';
import { AgentToolRegistry } from './registry.js';
import type { TemplateToolDeps } from './templates.tools.js';
import { createTemplateTools } from './templates.tools.js';
import type { VideoToolDeps } from './video.tools.js';
import { createVideoTools } from './video.tools.js';

export interface AgentToolRegistryDeps {
  products: ProductToolDeps['products'] & VideoToolDeps['products'];
  analysis: ProductToolDeps['analysis'];
  strategy: CreativeToolDeps['strategy'];
  script: CreativeToolDeps['script'];
  storyboard: CreativeToolDeps['storyboard'];
  templates: CreativeToolDeps['templates'] & TemplateToolDeps['templates'];
  video: VideoToolDeps['video'];
  library: VideoToolDeps['library'];
  billing: BillingToolDeps['billing'];
  settingsRepo: SettingsToolDeps['settingsRepo'];
}

/**
 * Registry of all tools visible to customer agents.
 * No admin/provider-key/credit-mutation/storage-deletion tools exist here.
 */
export function createCustomerToolRegistry(deps: AgentToolRegistryDeps): AgentToolRegistry {
  const registry = new AgentToolRegistry();
  const tools = [
    ...createProductTools({ products: deps.products, analysis: deps.analysis }),
    ...createCreativeTools({
      strategy: deps.strategy,
      script: deps.script,
      storyboard: deps.storyboard,
      templates: deps.templates,
    }),
    ...createTemplateTools({ templates: deps.templates }),
    ...createVideoTools({
      video: deps.video,
      products: { createVideoWorkflow: deps.products.createVideoWorkflow },
      library: deps.library,
    }),
    ...createBillingTools({ billing: deps.billing }),
    ...createSettingsTools({ settingsRepo: deps.settingsRepo }),
  ];
  for (const tool of tools) registry.register(tool);
  return registry;
}

export { AgentToolRegistry } from './registry.js';
export type { AgentToolDefinition, ToolPermission } from './agent-tool.js';
export { CUSTOMER_SAFE_SETTINGS } from './billing.tools.js';
