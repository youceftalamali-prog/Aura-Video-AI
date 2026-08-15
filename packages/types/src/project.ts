import type { UUID, ISODateString, Timestamps } from './common';

export type ProjectStatus = 'draft' | 'processing' | 'completed' | 'failed' | 'archived';

export interface Project extends Timestamps {
  id: UUID;
  workspaceId: UUID;
  userId: UUID;
  name: string;
  description: string | null;
  status: ProjectStatus;
  templateId: UUID | null;
  productId: UUID | null;
  thumbnailUrl: string | null;
  /** Canonical link to the generated video asset; videoUrl is response-only and signed. */
  videoAssetId: UUID | null;
  videoUrl: string | null;
  durationSeconds: number | null;
  resolution: string | null;
  creditsUsed: number;
  completedAt: ISODateString | null;
}

export interface CreateProjectInput {
  workspaceId: UUID;
  name: string;
  description?: string;
  templateId?: UUID;
  productId?: UUID;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  status?: ProjectStatus;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  durationSeconds?: number | null;
  resolution?: string | null;
  creditsUsed?: number;
}
