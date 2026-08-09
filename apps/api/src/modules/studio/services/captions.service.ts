import type { CaptionSegment, CaptionTrack, CaptionStyle } from '@aura/types';
import type { ITextToSpeechProvider } from '../interfaces/tts-provider.interface.js';
import { getEnv } from '@aura/config';
import { AppError } from '@aura/shared';

/**
 * Caption generation from script text with timing estimates.
 * When OpenAI transcription is configured, can refine from audio.
 */
export class CaptionsService {
  constructor(_tts: ITextToSpeechProvider) {}

  fromScriptText(text: string, totalDuration: number, style?: CaptionStyle): CaptionTrack {
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!sentences.length) {
      return { segments: [], style: style ?? { position: 'bottom', fontSize: 36 } };
    }
    const totalChars = sentences.reduce((a, s) => a + s.length, 0) || 1;
    let cursor = 0;
    const segments: CaptionSegment[] = sentences.map((s) => {
      const share = s.length / totalChars;
      const dur = Math.max(0.8, totalDuration * share);
      const start = cursor;
      const end = Math.min(totalDuration, cursor + dur);
      cursor = end;
      return { start, end, text: s };
    });
    return {
      segments,
      style: { position: 'bottom', fontSize: 36, fontColor: 'white', ...style },
    };
  }

  async fromAudioUrl(audioUrl: string, style?: CaptionStyle): Promise<CaptionTrack> {
    const env = getEnv();
    const key = env.TTS_API_KEY || env.AI_API_KEY || env.MEDIA_API_KEY;
    if (!key) {
      throw new AppError('Transcription requires API key', 503, 'TTS_NOT_CONFIGURED');
    }
    const base = (env.TTS_BASE_URL || env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      throw new AppError('Failed to fetch audio for transcription', 400, 'CAPTION_AUDIO_INVALID');
    }
    const blob = await audioRes.blob();
    const form = new FormData();
    form.append('file', blob, 'audio.mp3');
    form.append('model', 'whisper-1');
    form.append('response_format', 'verbose_json');

    const response = await fetch(`${base}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new AppError(`Transcription failed: ${response.status}`, 502, 'CAPTION_TRANSCRIPTION_FAILED', {
        body: body.slice(0, 300),
      });
    }
    const data = (await response.json()) as {
      text?: string;
      segments?: Array<{ start: number; end: number; text: string }>;
    };
    const segments: CaptionSegment[] =
      data.segments?.map((s) => ({ start: s.start, end: s.end, text: s.text.trim() })) ??
      this.fromScriptText(data.text || '', 10, style).segments;
    return {
      segments,
      style: { position: 'bottom', fontSize: 36, fontColor: 'white', ...style },
    };
  }
}
