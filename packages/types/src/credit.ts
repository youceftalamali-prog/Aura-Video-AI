import type { UUID, ISODateString, Timestamps } from './common';

export type CreditTransactionType =
  | 'grant'
  | 'purchase'
  | 'usage'
  | 'refund'
  | 'adjustment'
  | 'expiry';

export interface CreditWallet extends Timestamps {
  id: UUID;
  workspaceId: UUID;
  balance: number;
  lifetimeGranted: number;
  lifetimeUsed: number;
}

export interface CreditTransaction {
  id: UUID;
  walletId: UUID;
  workspaceId: UUID;
  userId: UUID | null;
  type: CreditTransactionType;
  amount: number;
  balanceAfter: number;
  description: string | null;
  referenceType: string | null;
  referenceId: UUID | null;
  createdAt: ISODateString;
}

export interface CreateCreditWalletInput {
  workspaceId: UUID;
  balance?: number;
}

export interface CreditUsageInput {
  workspaceId: UUID;
  userId: UUID;
  amount: number;
  description?: string;
  referenceType?: string;
  referenceId?: UUID;
}
