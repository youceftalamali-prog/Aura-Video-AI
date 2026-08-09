import type { UUID, ISODateString, Timestamps } from './common';

export type PlanInterval = 'month' | 'year';

export type SubscriptionStatus =
  | 'active'
  | 'canceled'
  | 'past_due'
  | 'trialing'
  | 'incomplete'
  | 'expired';

export interface Plan {
  id: UUID;
  name: string;
  slug: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  creditsPerMonth: number;
  maxProjects: number | null;
  maxStorageGb: number | null;
  features: string[];
  isActive: boolean;
  sortOrder: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Subscription extends Timestamps {
  id: UUID;
  userId: UUID;
  workspaceId: UUID;
  planId: UUID;
  status: SubscriptionStatus;
  interval: PlanInterval;
  currentPeriodStart: ISODateString;
  currentPeriodEnd: ISODateString;
  cancelAtPeriodEnd: boolean;
  canceledAt: ISODateString | null;
  trialEndsAt: ISODateString | null;
  externalId: string | null;
}

export interface CreateSubscriptionInput {
  userId: UUID;
  workspaceId: UUID;
  planId: UUID;
  interval: PlanInterval;
  status?: SubscriptionStatus;
  currentPeriodStart: ISODateString;
  currentPeriodEnd: ISODateString;
  trialEndsAt?: ISODateString;
  externalId?: string;
}
