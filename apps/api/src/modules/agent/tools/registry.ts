import { AppError } from '@aura/shared';
import type { AgentContext } from '../types.js';
import type { AgentToolDefinition } from './agent-tool.js';

export class AgentToolRegistry {
  private readonly tools = new Map<string, AgentToolDefinition>();

  register(tool: AgentToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new AppError(`Duplicate agent tool: ${tool.name}`, 500, 'AGENT_TOOL_DUPLICATE_DEFINITION');
    }
    this.tools.set(tool.name, tool);
  }

  /** Tools visible to a role. Admin tools are never visible to customers. */
  list(role: string): AgentToolDefinition[] {
    return [...this.tools.values()].filter(
      (tool) => tool.permission === 'customer' || role === 'admin' || role === 'superadmin',
    );
  }

  get(name: string): AgentToolDefinition | null {
    return this.tools.get(name) ?? null;
  }

  /** Resolves a tool for a role; unknown or forbidden tools are indistinguishable to the caller. */
  resolveForRole(name: string, role: string): AgentToolDefinition | null {
    const tool = this.tools.get(name);
    if (!tool) return null;
    if (tool.permission !== 'customer' && role !== 'admin' && role !== 'superadmin') return null;
    return tool;
  }

  /** Validates args against the tool's Zod schema. Throws AppError on invalid input. */
  validateArgs(tool: AgentToolDefinition, args: unknown): Record<string, unknown> {
    const parsed = tool.paramsSchema.safeParse(args ?? {});
    if (!parsed.success) {
      throw new AppError(`Invalid arguments for tool "${tool.name}"`, 400, 'AGENT_TOOL_VALIDATION');
    }
    return parsed.data as Record<string, unknown>;
  }

  /** Executes a tool with the given context. Permission is enforced server-side here. */
  async execute(
    ctx: AgentContext,
    name: string,
    args: Record<string, unknown>,
    prepared?: unknown,
  ): Promise<unknown> {
    const tool = this.resolveForRole(name, ctx.role);
    if (!tool) {
      throw new AppError(`Tool "${name}" is not available`, 403, 'AGENT_TOOL_FORBIDDEN');
    }
    if (tool.confirmation && tool.prepare && prepared === undefined) {
      throw new AppError(
        `Tool "${name}" requires explicit confirmation before execution`,
        400,
        'AGENT_TOOL_CONFIRMATION_REQUIRED',
      );
    }
    return tool.execute(ctx, args, prepared);
  }
}
