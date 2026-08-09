import { getEnv } from '@aura/config';
import type { ITextToSpeechProvider } from '../interfaces/tts-provider.interface.js';
import { OpenAITTSProvider } from './openai-tts.provider.js';

let tts: ITextToSpeechProvider | null = null;

export function getTTSProvider(): ITextToSpeechProvider {
  if (!tts) {
    const env = getEnv();
    if (env.TTS_PROVIDER === 'openai' || env.TTS_PROVIDER === 'none') {
      tts = new OpenAITTSProvider();
    } else {
      tts = new OpenAITTSProvider();
    }
  }
  return tts;
}

export function resetTTSProvider(): void {
  tts = null;
}
