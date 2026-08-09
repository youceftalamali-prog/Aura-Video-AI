import type { UUID, Timestamps } from './common';

export interface Product extends Timestamps {
  id: UUID;
  workspaceId: UUID;
  userId: UUID;
  name: string;
  description: string | null;
  imageUrl: string | null;
  imageAssetId: UUID | null;
  price: string | null;
  currency: string | null;
  externalId: string | null;
  externalSource: string | null;
  metadata: Record<string, unknown> | null;
}

export interface CreateProductInput {
  workspaceId: UUID;
  name: string;
  description?: string;
  imageUrl?: string;
  imageAssetId?: UUID;
  price?: string;
  currency?: string;
  externalId?: string;
  externalSource?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateProductInput {
  name?: string;
  description?: string | null;
  imageUrl?: string | null;
  imageAssetId?: UUID | null;
  price?: string | null;
  currency?: string | null;
  metadata?: Record<string, unknown> | null;
}
