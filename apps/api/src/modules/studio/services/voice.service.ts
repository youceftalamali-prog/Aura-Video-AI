import type { VoiceGenerationRequest, VoiceGenerationResult } from '@aura/types';
import type { ITextToSpeechProvider } from '../interfaces/tts-provider.interface.js';
import { getStorageProvider } from '../../../infrastructure/storage/index.js';
import { AppError } from '@aura/shared';
import { generateRandomString } from '@aura/shared';

export class VoiceService {
  constructor(private readonly tts: ITextToSpeechProvider) {}

  async generate(request: VoiceGenerationRequest): Promise<VoiceGenerationResult> {
    if (!this.tts.isConfigured()) {
      throw new AppError('TTS provider is not configured. Set TTS_API_KEY.', 503, 'TTS_NOT_CONFIGURED');
    }
    const result = await this.tts.synthesize(request);
    const storage = getStorageProvider();
    const key = `voice/${request.workspaceId || 'system'}/${Date.now()}-${generateRandomString(8)}.mp3`;
    const uploaded = await storage.upload({
      key,
      body: result.audio,
      contentType: result.mimeType,
      metadata: { provider: this.tts.name },
    });
    return {
      storageKey: key,
      url: uploaded.url,
      durationSeconds: result.durationSeconds,
      provider: this.tts.name,
      mimeType: result.mimeType,
    };
  }
}
