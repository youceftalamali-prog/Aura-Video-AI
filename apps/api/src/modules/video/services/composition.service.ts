import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { AppError } from '@aura/shared';
import type { AspectRatio } from '@aura/types';

export interface CompositionSceneInput {
  order: number;
  duration: number;
  videoPath?: string;
  imagePath?: string;
  onScreenText?: string;
}

export interface CompositionRequest {
  scenes: CompositionSceneInput[];
  aspectRatio: AspectRatio;
  outputFileName: string;
  backgroundColor?: string;
}

export interface CompositionResult {
  localPath: string;
  mimeType: string;
}

/**
 * Server-side composition using FFmpeg.
 * Combines scene clips/images into a single video — does not return source URLs as "final".
 */
export class VideoCompositionService {
  private dimensions(aspect: AspectRatio): { w: number; h: number } {
    switch (aspect) {
      case '9:16':
        return { w: 720, h: 1280 };
      case '1:1':
        return { w: 1080, h: 1080 };
      case '4:5':
        return { w: 1080, h: 1350 };
      default:
        return { w: 1280, h: 720 };
    }
  }

  async compose(request: CompositionRequest): Promise<CompositionResult> {
    if (!request.scenes.length) {
      throw new AppError('No scenes to compose', 400, 'INVALID_VIDEO_INPUT');
    }

    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'aura-compose-'));
    const { w, h } = this.dimensions(request.aspectRatio);
    const clipPaths: string[] = [];

    try {
      for (const scene of [...request.scenes].sort((a, b) => a.order - b.order)) {
        const outClip = path.join(tmp, `clip_${scene.order}.mp4`);
        if (scene.videoPath) {
          await this.normalizeClip(scene.videoPath, outClip, w, h, scene.duration);
        } else if (scene.imagePath) {
          await this.imageToClip(scene.imagePath, outClip, w, h, scene.duration, scene.onScreenText);
        } else {
          await this.colorClip(outClip, w, h, scene.duration, scene.onScreenText);
        }
        clipPaths.push(outClip);
      }

      const listFile = path.join(tmp, 'list.txt');
      await fs.writeFile(
        listFile,
        clipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'),
      );

      const outputPath = path.join(tmp, request.outputFileName);
      await this.runFfmpeg([
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        listFile,
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        outputPath,
      ]);

      // Move to a stable temp path owned by caller cleanup
      const finalPath = path.join(os.tmpdir(), `aura-final-${Date.now()}.mp4`);
      await fs.copyFile(outputPath, finalPath);
      return { localPath: finalPath, mimeType: 'video/mp4' };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        `Video composition failed: ${(err as unknown as Error).message}`,
        500,
        'VIDEO_GENERATION_FAILED',
      );
    } finally {
      await fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async normalizeClip(
    input: string,
    output: string,
    w: number,
    h: number,
    duration: number,
  ): Promise<void> {
    await this.runFfmpeg([
      '-y',
      '-i',
      input,
      '-t',
      String(duration),
      '-vf',
      `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-an',
      output,
    ]);
  }

  private async imageToClip(
    imagePath: string,
    output: string,
    w: number,
    h: number,
    duration: number,
    text?: string,
  ): Promise<void> {
    const filters = [
      `scale=${w}:${h}:force_original_aspect_ratio=decrease`,
      `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`,
    ];
    if (text) {
      const escaped = text.replace(/:/g, '\\:').replace(/'/g, "\\'");
      filters.push(
        `drawtext=text='${escaped}':fontsize=36:fontcolor=white:x=(w-text_w)/2:y=h-80:box=1:boxcolor=black@0.5`,
      );
    }
    await this.runFfmpeg([
      '-y',
      '-loop',
      '1',
      '-i',
      imagePath,
      '-t',
      String(Math.max(1, duration)),
      '-vf',
      filters.join(','),
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-an',
      output,
    ]);
  }

  private async colorClip(
    output: string,
    w: number,
    h: number,
    duration: number,
    text?: string,
  ): Promise<void> {
    const filters: string[] = [];
    if (text) {
      const escaped = text.replace(/:/g, '\\:').replace(/'/g, "\\'");
      filters.push(
        `drawtext=text='${escaped}':fontsize=42:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2`,
      );
    }
    const args = [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `color=c=0x111827:s=${w}x${h}:d=${Math.max(1, duration)}`,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-an',
    ];
    if (filters.length) {
      args.push('-vf', filters.join(','));
    }
    args.push(output);
    await this.runFfmpeg(args);
  }

  private runFfmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      proc.stderr.on('data', (d) => {
        stderr += d.toString();
      });
      proc.on('error', (err) => {
        reject(new AppError(`FFmpeg not available: ${err.message}`, 500, 'VIDEO_GENERATION_FAILED'));
      });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else
          reject(
            new AppError(
              `FFmpeg exited with code ${code}`,
              500,
              'VIDEO_GENERATION_FAILED',
              { stderr: stderr.slice(-800) },
            ),
          );
      });
    });
  }
}
