import type { VoiceGenerationRequest } from '@aura/types';

export interface ITextToSpeechProvider {
  readonly name: string;
  isConfigured(): boolean;
  synthesize(request: VoiceGenerationRequest): Promise<{ audio: Buffer; mimeType: string; durationSeconds: number }>;
}
