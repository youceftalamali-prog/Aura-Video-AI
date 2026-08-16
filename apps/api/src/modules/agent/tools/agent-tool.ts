import type { z } from 'zod';
import type { AgentContext } from '../types.js';

export type ToolPermission = 'customer' | 'admin';

/**
 * A tool is a thin wrapper around an existing service.
 * No business logic is duplicated here — services do the real work.
 */
export interface AgentToolDefinition<P = unknown> {
  name: string;
  description: string;
  /** Short JSON-schema-like hint describing the accepted arguments (for the model prompt). */
  paramsHint: string;
  paramsSchema: z.ZodType<Record<string, unknown>>;
  /** Server-side visibility scope. Admin tools are never exposed to customer agents. */
  permission: ToolPermission;
  /**
   * When set, the tool is NOT executed until the user explicitly confirms.
   * `prepare` runs first (no side effects) so the estimate can be shown.
   */
  confirmation?: { reason: string };
  /** Optional side-effect-free preparation used to build a credit estimate. */
  prepare?(ctx: AgentContext, args: Record<string, unknown>): Promise<P>;
  /** Optional credit estimate (requires the prepared payload). */
  estimate?(ctx: AgentContext, args: Record<string, unknown>, prepared?: P): Promise<{ credits: number; breakdown?: Array<{ item: string; credits: number }> }>;
  /** Executes the underlying service. Called only after confirmation for confirmation tools. */
  execute(ctx: AgentContext, args: Record<string, unknown>, prepared?: P): Promise<unknown>;
}
