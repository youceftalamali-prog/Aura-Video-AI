import fs from 'node:fs/promises';
import path from 'node:path';
import { getEnv } from '@aura/config';
import type { IStorageProvider, StorageObject, StorageUploadOptions } from './types.js';

export class LocalStorageProvider implements IStorageProvider {
  private basePath: string;
  private publicBaseUrl: string;

  constructor() {
    const env = getEnv();
    this.basePath = path.resolve(env.LOCAL_STORAGE_PATH);
    this.publicBaseUrl = `${env.API_URL}/storage`;
  }

  private resolvePath(key: string): string {
    if (!key || key.startsWith('/') || key.includes('\\')) {
      throw new Error('Invalid storage key');
    }
    const segments = key.split('/');
    if (segments.some((s) => s === '' || s === '.' || s === '..')) {
      throw new Error('Invalid storage key');
    }
    const full = path.join(this.basePath, ...segments);
    const base = this.basePath.endsWith(path.sep) ? this.basePath : this.basePath + path.sep;
    if (full !== this.basePath && !full.startsWith(base)) {
      throw new Error('Invalid storage key');
    }
    return full;
  }

  async upload(options: StorageUploadOptions): Promise<StorageObject> {
    const fullPath = this.resolvePath(options.key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, options.body);
    return {
      key: options.key,
      url: `${this.publicBaseUrl}/${options.key}`,
      contentType: options.contentType,
    };
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.resolvePath(key);
    try {
      await fs.unlink(fullPath);
    } catch (err: unknown) {
      if ((err as unknown as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  async getSignedUrl(key: string, _expiresInSeconds = 3600): Promise<string> {
    return `${this.publicBaseUrl}/${key}`;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolvePath(key));
      return true;
    } catch {
      return false;
    }
  }
}
