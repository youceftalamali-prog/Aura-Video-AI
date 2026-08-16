import { eq } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { creditWallets } from '../../db/schema.js';
import type { CreditWallet } from '@aura/types';

export class CreditRepository {
  constructor(private readonly db: Database) {}

  async findByWorkspaceId(workspaceId: string): Promise<CreditWallet | null> {
    const rows = await this.db
      .select()
      .from(creditWallets)
      .where(eq(creditWallets.workspaceId, workspaceId))
      .limit(1);
    return (rows[0] as unknown as CreditWallet | undefined) ?? null;
  }

  async create(workspaceId: string, initialBalance = 0): Promise<CreditWallet> {
    const rows = await this.db
      .insert(creditWallets)
      .values({
        workspaceId,
        balance: initialBalance,
        lifetimeGranted: initialBalance,
        lifetimeUsed: 0,
      })
      .onConflictDoNothing({ target: creditWallets.workspaceId })
      .returning();

    if (rows[0]) return rows[0] as unknown as CreditWallet;

    const existing = await this.findByWorkspaceId(workspaceId);
    if (!existing) throw new Error('Credit wallet could not be created');
    return existing;
  }
}
