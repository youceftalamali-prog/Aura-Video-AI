import type { UUID, Timestamps } from './common';

export type TemplateCategory =
  | 'product'
  | 'lifestyle'
  | 'testimonial'
  | 'unboxing'
  | 'comparison'
  | 'promo'
  | 'other';

export type TemplateStatus = 'active' | 'draft' | 'archived';

export interface Template extends Timestamps {
  id: UUID;
  name: string;
  description: string | null;
  category: TemplateCategory;
  thumbnailUrl: string | null;
  previewVideoUrl: string | null;
  durationSeconds: number | null;
  resolution: string;
  aspectRatio: string;
  creditsCost: number;
  status: TemplateStatus;
  isPremium: boolean;
  sortOrder: number;
  metadata: Record<string, unknown> | null;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  category: TemplateCategory;
  thumbnailUrl?: string;
  previewVideoUrl?: string;
  durationSeconds?: number;
  resolution?: string;
  aspectRatio?: string;
  creditsCost?: number;
  status?: TemplateStatus;
  isPremium?: boolean;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
}
