import fs from 'node:fs/promises';
import path from 'node:path';
import type { IStorageProvider, StorageObject, StorageUploadOptions } from './types.js';
import { getEnv } from '@aura/config';
import { buildLocalStorageUrl, verifyStorageToken } from './local-signing.js';

export class LocalStorageProvider implements IStorageProvider {
  private readonly basePath: string;

  constructor() {
    const env = getEnv();
    this.basePath = path.resolve(env.LOCAL_STORAGE_PATH);
  }

  private resolvePath(key: string): string {
    if (!key || key.startsWith('/') || key.includes('\\')) {
      throw new Error('Invalid storage key');
    }
    const segments = key.split('/');
    if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
      throw new Error('Invalid storage key');
    }
    const full = path.join(this.basePath, ...segments);
    const base = this.basePath.endsWith(path.sep) ? this.basePath : `${this.basePath}${path.sep}`;
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
      url: await this.getSignedUrl(options.key),
      size: Buffer.byteLength(options.body),
      contentType: options.contentType,
    };
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.resolvePath(key);
    try {
      await fs.unlink(fullPath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    this.resolvePath(key);
    return buildLocalStorageUrl(key, expiresInSeconds);
  }

  getFilePath(key: string): string {
    return this.resolvePath(key);
  }

  verifySignedUrl(key: string, token: string): boolean {
    try {
      this.resolvePath(key);
      return verifyStorageToken(key, token);
    } catch {
      return false;
    }
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
