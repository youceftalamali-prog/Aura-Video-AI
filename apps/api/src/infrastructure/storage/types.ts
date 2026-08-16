export interface StorageUploadOptions {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface StorageObject {
  key: string;
  url: string;
  size?: number;
  contentType?: string;
}

export interface IStorageProvider {
  upload(options: StorageUploadOptions): Promise<StorageObject>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  exists(key: string): Promise<boolean>;
}
