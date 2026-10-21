import { getEnv } from '@aura/config';
import { AppError } from '@aura/shared';
import type { VoiceGenerationRequest } from '@aura/types';
import type { ITextToSpeechProvider } from '../interfaces/tts-provider.interface.js';
import { OpenAITTSProvider } from './openai-tts.provider.js';

let tts: ITextToSpeechProvider | null = null;

class DisabledTTSProvider implements ITextToSpeechProvider {
  readonly name = 'none';

  isConfigured(): boolean {
    return false;
  }

  async synthesize(_request: VoiceGenerationRequest): Promise<{ audio: Buffer; mimeType: string; durationSeconds: number }> {
    throw new AppError('Text-to-speech is disabled. Set TTS_PROVIDER=openai and configure TTS_API_KEY.', 503, 'TTS_DISABLED');
  }
}

export function getTTSProvider(): ITextToSpeechProvider {
  if (!tts) {
    const env = getEnv();
    if (env.TTS_PROVIDER === 'none') {
      tts = new DisabledTTSProvider();
    } else {
      tts = new OpenAITTSProvider();
    }
  }
  return tts;
}

export function resetTTSProvider(): void {
  tts = null;
}
