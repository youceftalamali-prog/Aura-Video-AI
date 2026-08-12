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

/**
 * Cloudflare R2 via official AWS SDK v3 (S3-compatible).
 * Real Signature V4 — no placeholder signing.
 */
export class R2StorageProvider implements IStorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor() {
    const env = getEnv();
    if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET_NAME) {
      throw new AppError(
        'R2 storage is not configured. Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME.',
        503,
        'STORAGE_NOT_CONFIGURED',
      );
    }
    const endpoint =
      env.R2_ENDPOINT ||
      (env.R2_ACCOUNT_ID ? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : '');
    if (!endpoint) {
      throw new AppError('R2_ENDPOINT or R2_ACCOUNT_ID is required', 503, 'STORAGE_NOT_CONFIGURED');
    }

    this.bucket = env.R2_BUCKET_NAME;
    this.publicUrl = (env.R2_PUBLIC_URL || endpoint).replace(/\/$/, '');
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
    if (!options.key || options.key.startsWith('/') || options.key.includes('\\')) {
      throw new AppError('Invalid storage key', 400, 'STORAGE_INVALID_KEY');
    }
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
    } catch (err) {
      throw new AppError(
        `R2 upload failed: ${(err as unknown as Error).message}`,
        502,
        'STORAGE_UPLOAD_FAILED',
      );
    }

    return {
      key: options.key,
      url: `${this.publicUrl}/${options.key}`,
      size: body.length,
      contentType: options.contentType,
    };
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (err) {
      throw new AppError(
        `R2 delete failed: ${(err as unknown as Error).message}`,
        502,
        'STORAGE_DELETE_FAILED',
      );
    }
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      return await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    } catch (err) {
      throw new AppError(
        `R2 signed URL failed: ${(err as unknown as Error).message}`,
        502,
        'STORAGE_SIGNED_URL_FAILED',
      );
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }
}
