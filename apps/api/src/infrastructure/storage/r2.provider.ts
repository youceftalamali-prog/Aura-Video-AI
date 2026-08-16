import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getEnv } from '@aura/config';
import { AppError } from '@aura/shared';
import type { IStorageProvider, StorageObject, StorageUploadOptions } from './types.js';

/** Cloudflare R2 via the official AWS SDK v3 (private bucket by default). */
export class R2StorageProvider implements IStorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const env = getEnv();
    if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET_NAME) {
      throw new AppError('R2 storage is not configured', 503, 'STORAGE_NOT_CONFIGURED');
    }
    const endpoint =
      env.R2_ENDPOINT ||
      (env.R2_ACCOUNT_ID ? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : '');
    if (!endpoint) {
      throw new AppError('R2 storage is not configured', 503, 'STORAGE_NOT_CONFIGURED');
    }

    this.bucket = env.R2_BUCKET_NAME;
    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });
  }

  async upload(options: StorageUploadOptions): Promise<StorageObject> {
    this.validateKey(options.key);
    const body =
      typeof options.body === 'string'
        ? Buffer.from(options.body)
        : Buffer.isBuffer(options.body)
          ? options.body
          : Buffer.from(options.body);

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: options.key,
          Body: body,
          ContentType: options.contentType,
          Metadata: options.metadata,
        }),
      );
    } catch {
      throw new AppError('Storage upload failed', 502, 'STORAGE_UPLOAD_FAILED');
    }

    return {
      key: options.key,
      url: await this.getSignedUrl(options.key),
      size: body.length,
      contentType: options.contentType,
    };
  }

  async delete(key: string): Promise<void> {
    this.validateKey(key);
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch {
      throw new AppError('Storage delete failed', 502, 'STORAGE_DELETE_FAILED');
    }
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    this.validateKey(key);
    try {
      const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
      return await getSignedUrl(this.client, command, {
        expiresIn: Math.max(1, Math.min(Math.floor(expiresInSeconds), 24 * 60 * 60)),
      });
    } catch {
      throw new AppError('Storage signed URL failed', 502, 'STORAGE_SIGNED_URL_FAILED');
    }
  }

  async exists(key: string): Promise<boolean> {
    this.validateKey(key);
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  private validateKey(key: string): void {
    if (!key || key.startsWith('/') || key.includes('\\')) {
      throw new AppError('Invalid storage key', 400, 'STORAGE_INVALID_KEY');
    }
    if (key.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')) {
      throw new AppError('Invalid storage key', 400, 'STORAGE_INVALID_KEY');
    }
  }
}
