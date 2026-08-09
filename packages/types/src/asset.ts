import type { UUID, Timestamps } from './common';

export type AssetType = 'image' | 'video' | 'audio' | 'document' | 'other';

export type AssetStatus = 'uploading' | 'ready' | 'failed' | 'deleted';

export interface Asset extends Timestamps {
  id: UUID;
  workspaceId: UUID;
  userId: UUID;
  name: string;
  type: AssetType;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  url: string;
  thumbnailUrl: string | null;
  status: AssetStatus;
  metadata: Record<string, unknown> | null;
}

export interface CreateAssetInput {
  workspaceId: UUID;
  name: string;
  type: AssetType;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  url: string;
  thumbnailUrl?: string;
  metadata?: Record<string, unknown>;
}
