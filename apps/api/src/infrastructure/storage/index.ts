import { getEnv } from '@aura/config';
import type { IStorageProvider } from './types.js';
import { LocalStorageProvider } from './local.provider.js';
import { R2StorageProvider } from './r2.provider.js';

let storage: IStorageProvider | null = null;

export function getStorageProvider(): IStorageProvider {
  if (!storage) {
    const env = getEnv();
    if (env.STORAGE_PROVIDER === 'r2' || env.STORAGE_PROVIDER === 's3') {
      storage = new R2StorageProvider();
    } else {
      storage = new LocalStorageProvider();
    }
  }
  return storage;
}

export type { IStorageProvider, StorageObject, StorageUploadOptions } from './types.js';
export { LocalStorageProvider } from './local.provider.js';
export { R2StorageProvider } from './r2.provider.js';
