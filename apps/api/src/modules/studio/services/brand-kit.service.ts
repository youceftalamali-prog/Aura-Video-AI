import type { Database } from '../../../db/client.js';
import { SettingsRepository } from '../../../domain/repositories/settings.repository.js';
import type { BrandKit, UpdateBrandKitInput } from '@aura/types';

const keyFor = (workspaceId: string) => `brand_kit:${workspaceId}`;

const DEFAULTS: Omit<BrandKit, 'workspaceId'> = {
  brandName: 'My Brand',
  logoUrl: null,
  primaryColor: '#4F46E5',
  secondaryColor: '#0F172A',
  fontFamily: 'Inter',
  ctaStyle: 'rounded',
  defaultVoice: 'alloy',
  defaultMusicStyle: 'upbeat',
  defaultAspectRatio: '9:16',
};

export class BrandKitService {
  private readonly settings: SettingsRepository;

  constructor(db: Database) {
    this.settings = new SettingsRepository(db);
  }

  async get(workspaceId: string): Promise<BrandKit> {
    const raw = (await this.settings.get(keyFor(workspaceId))) as unknown as Partial<BrandKit> | null;
    return {
      ...DEFAULTS,
      ...raw,
      workspaceId,
    };
  }

  async update(workspaceId: string, input: UpdateBrandKitInput): Promise<BrandKit> {
    const current = await this.get(workspaceId);
    const next: BrandKit = {
      ...current,
      ...input,
      workspaceId,
      updatedAt: new Date().toISOString(),
    };
    await this.settings.set(keyFor(workspaceId), next, 'Workspace brand kit');
    return next;
  }
}
