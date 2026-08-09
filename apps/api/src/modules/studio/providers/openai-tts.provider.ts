import { getEnv } from '@aura/config';
import { AppError } from '@aura/shared';
import type { VoiceGenerationRequest } from '@aura/types';
import type { ITextToSpeechProvider } from '../interfaces/tts-provider.interface.js';

export class OpenAITTSProvider implements ITextToSpeechProvider {
  readonly name = 'openai';

  isConfigured(): boolean {
    const env = getEnv();
    return Boolean(env.TTS_API_KEY || env.AI_API_KEY || env.MEDIA_API_KEY);
  }

  private get apiKey(): string {
    const env = getEnv();
    const key = env.TTS_API_KEY || env.AI_API_KEY || env.MEDIA_API_KEY;
    if (!key) {
      throw new AppError('TTS provider is not configured. Set TTS_API_KEY.', 503, 'TTS_NOT_CONFIGURED');
    }
    return key;
  }

  private get baseUrl(): string {
    const env = getEnv();
    return (env.TTS_BASE_URL || env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  }

  async synthesize(request: VoiceGenerationRequest): Promise<{ audio: Buffer; mimeType: string; durationSeconds: number }> {
    if (!this.isConfigured()) {
      throw new AppError('TTS provider is not configured', 503, 'TTS_NOT_CONFIGURED');
    }
    if (!request.text?.trim()) {
      throw new AppError('Voice text is required', 400, 'INVALID_VOICE_INPUT');
    }
    if (request.text.length > 4000) {
      throw new AppError('Voice text too long', 400, 'INVALID_VOICE_INPUT');
    }

    const env = getEnv();
    const response = await fetch(`${this.baseUrl}/audio/speech`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.TTS_MODEL || 'tts-1',
        input: request.text,
        voice: request.voice || env.TTS_DEFAULT_VOICE || 'alloy',
        speed: request.speed ?? 1.0,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new AppError(`TTS provider error: ${response.status}`, 502, 'TTS_PROVIDER_ERROR', {
        body: body.slice(0, 300),
      });
    }

    const ab = await response.arrayBuffer();
    const audio = Buffer.from(ab);
    if (audio.length < 100) {
      throw new AppError('TTS output invalid', 502, 'TTS_PROVIDER_ERROR');
    }
    // Rough duration estimate: ~12KB/s for mp3 speech
    const durationSeconds = Math.max(1, Math.round(audio.length / 12000));
    return { audio, mimeType: 'audio/mpeg', durationSeconds };
  }
}
