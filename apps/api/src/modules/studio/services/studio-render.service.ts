import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { AppError } from '@aura/shared';
import type { AspectRatio, CaptionTrack, MusicMixConfig } from '@aura/types';
import { VideoCompositionService, type CompositionSceneInput } from '../../video/services/composition.service.js';

export interface StudioRenderInput {
  scenes: CompositionSceneInput[];
  aspectRatio: AspectRatio;
  voicePath?: string | null;
  musicPath?: string | null;
  music?: MusicMixConfig | null;
  captions?: CaptionTrack | null;
  primaryColor?: string;
}

/**
 * Final commercial render: scene compose + optional voice + music ducking + caption burn-in.
 */
export class StudioRenderService {
  private readonly base = new VideoCompositionService();

  async render(input: StudioRenderInput): Promise<{ localPath: string; mimeType: string }> {
    const composed = await this.base.compose({
      scenes: input.scenes,
      aspectRatio: input.aspectRatio,
      outputFileName: `studio-${Date.now()}.mp4`,
    });

    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'aura-studio-'));
    try {
      let current = composed.localPath;

      if (input.captions?.segments?.length) {
        const captioned = path.join(tmp, 'captioned.mp4');
        await this.burnCaptions(current, captioned, input.captions);
        if (current !== composed.localPath) await fs.unlink(current).catch(() => undefined);
        current = captioned;
      }

      if (input.voicePath || input.musicPath) {
        const withAudio = path.join(tmp, 'final-audio.mp4');
        await this.mixAudio(current, withAudio, input.voicePath, input.musicPath, input.music);
        if (current !== composed.localPath) await fs.unlink(current).catch(() => undefined);
        current = withAudio;
      }

      const finalPath = path.join(os.tmpdir(), `aura-studio-final-${Date.now()}.mp4`);
      await fs.copyFile(current, finalPath);
      await fs.unlink(composed.localPath).catch(() => undefined);
      return { localPath: finalPath, mimeType: 'video/mp4' };
    } finally {
      await fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async burnCaptions(input: string, output: string, captions: CaptionTrack): Promise<void> {
    // Build drawtext chain for each segment
    const style = captions.style || {};
    const fontSize = style.fontSize ?? 36;
    const fontColor = (style.fontColor || 'white').replace(/:/g, '\\:');
    const yExpr =
      style.position === 'top' ? '60' : style.position === 'center' ? '(h-text_h)/2' : 'h-100';

    const filters: string[] = [];
    for (const seg of captions.segments.slice(0, 40)) {
      const text = seg.text.replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/\\/g, '\\\\\\\\');
      filters.push(
        `drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${fontColor}:x=(w-text_w)/2:y=${yExpr}:enable='between(t\\,${seg.start.toFixed(2)}\\,${seg.end.toFixed(2)})':box=1:boxcolor=black@0.45:boxborderw=8`,
      );
    }
    if (!filters.length) {
      await fs.copyFile(input, output);
      return;
    }
    await this.ffmpeg(['-y', '-i', input, '-vf', filters.join(','), '-c:a', 'copy', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', output]);
  }

  private async mixAudio(
    videoPath: string,
    output: string,
    voicePath?: string | null,
    musicPath?: string | null,
    music?: MusicMixConfig | null,
  ): Promise<void> {
    const vol = music?.volume ?? 0.22;
    const args = ['-y', '-i', videoPath];
    if (voicePath) args.push('-i', voicePath);
    if (musicPath) args.push('-i', musicPath);

    if (voicePath && musicPath) {
      // duck music under voice roughly
      const filter = `[1:a]volume=1[a1];[2:a]volume=${vol}[a2];[a1][a2]amix=inputs=2:duration=first:dropout_transition=2[aout]`;
      args.push('-filter_complex', filter, '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-shortest', output);
    } else if (voicePath) {
      args.push('-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-shortest', output);
    } else if (musicPath) {
      args.push('-filter_complex', `[1:a]volume=${vol}[a]`, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-shortest', output);
    } else {
      await fs.copyFile(videoPath, output);
      return;
    }
    await this.ffmpeg(args);
  }

  private ffmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
      proc.on('error', (err) => reject(new AppError(`FFmpeg error: ${err.message}`, 500, 'VIDEO_GENERATION_FAILED')));
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new AppError(`FFmpeg exited ${code}`, 500, 'VIDEO_GENERATION_FAILED', { stderr: stderr.slice(-600) }));
      });
    });
  }
}
