import { eq, sql } from 'drizzle-orm';
import type { Database } from '../../../db/client.js';
import { creditWallets } from '../../../db/schema.js';
import { AppError } from '@aura/shared';
import type { VideoCostEstimate, VideoGenerationMode } from '@aura/types';

export class CreditLedgerService {
  constructor(private readonly db: Database) {}

  estimateCost(input: {
    duration: number;
    sceneCount: number;
    mode: VideoGenerationMode;
  }): VideoCostEstimate {
    const base = 10;
    const perSecond = 1;
    const perScene = 2;
    const modeBonus = input.mode === 'image_to_video' ? 5 : input.mode === 'storyboard' ? 8 : 0;
    const durationCost = Math.ceil(input.duration) * perSecond;
    const sceneCost = input.sceneCount * perScene;
    const total = base + durationCost + sceneCost + modeBonus;

    return {
      credits: total,
      duration: input.duration,
      sceneCount: input.sceneCount,
      mode: input.mode,
      breakdown: [
        { item: 'base', credits: base },
        { item: 'duration', credits: durationCost },
        { item: 'scenes', credits: sceneCost },
        { item: 'mode', credits: modeBonus },
      ],
    };
  }

  async getBalance(workspaceId: string): Promise<number> {
    const rows = await this.db
      .select()
      .from(creditWallets)
      .where(eq(creditWallets.workspaceId, workspaceId))
      .limit(1);
    return rows[0]?.balance ?? 0;
  }

  /**
   * Atomic deduction. Throws INSUFFICIENT_CREDITS if balance too low.
   * Safe against concurrent deductions via SQL condition.
   */
  async deduct(workspaceId: string, amount: number): Promise<number> {
    if (amount <= 0) return this.getBalance(workspaceId);

    const updated = await this.db.execute(sql`
      UPDATE credit_wallets
      SET balance = balance - ${amount},
          lifetime_used = lifetime_used + ${amount},
          updated_at = NOW()
      WHERE workspace_id = ${workspaceId}
        AND balance >= ${amount}
      RETURNING balance
    `);

    const rows = (updated as unknown as { rows?: Array<{ balance: number }> }).rows
      ?? (Array.isArray(updated) ? (updated as unknown as Array<{ balance: number }>) : []);

    if (!rows.length) {
      throw new AppError('Insufficient credits', 402, 'INSUFFICIENT_CREDITS');
    }
    return Number(rows[0]!.balance);
  }

  async refund(workspaceId: string, amount: number): Promise<void> {
    if (amount <= 0) return;
    await this.db.execute(sql`
      UPDATE credit_wallets
      SET balance = balance + ${amount},
          lifetime_used = GREATEST(0, lifetime_used - ${amount}),
          updated_at = NOW()
      WHERE workspace_id = ${workspaceId}
    `);
  }

  /**
   * Grant credits after verified payment. Increases balance and lifetimeGranted.
   */
  async grant(workspaceId: string, amount: number): Promise<number> {
    if (amount <= 0) return this.getBalance(workspaceId);
    const updated = await this.db.execute(sql`
      INSERT INTO credit_wallets (id, workspace_id, balance, lifetime_granted, lifetime_used, created_at, updated_at)
      VALUES (gen_random_uuid(), ${workspaceId}, ${amount}, ${amount}, 0, NOW(), NOW())
      ON CONFLICT (workspace_id) DO UPDATE SET
        balance = credit_wallets.balance + ${amount},
        lifetime_granted = credit_wallets.lifetime_granted + ${amount},
        updated_at = NOW()
      RETURNING balance
    `);
    const rows = (updated as unknown as { rows?: Array<{ balance: number }> }).rows
      ?? (Array.isArray(updated) ? (updated as unknown as Array<{ balance: number }>) : []);
    return Number(rows[0]?.balance ?? 0);
  }
}
