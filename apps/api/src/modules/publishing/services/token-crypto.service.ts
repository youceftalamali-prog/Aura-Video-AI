import crypto from 'node:crypto';
import { getEnv } from '@aura/config';
import { AppError } from '@aura/shared';

/**
 * AES-256-GCM encryption for OAuth tokens at rest.
 * Requires TOKEN_ENCRYPTION_KEY (32-byte hex or utf8 passphrase derived via scrypt).
 */
export class TokenCryptoService {
  private key: Buffer | null = null;

  private getKey(): Buffer {
    if (this.key) return this.key;
    const env = getEnv();
    const raw = env.TOKEN_ENCRYPTION_KEY;
    if (!raw) {
      throw new AppError(
        'TOKEN_ENCRYPTION_KEY is not configured',
        503,
        'ENCRYPTION_NOT_CONFIGURED',
      );
    }
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      this.key = Buffer.from(raw, 'hex');
    } else {
      this.key = crypto.scryptSync(raw, 'aura-publishing-salt', 32);
    }
    return this.key;
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.getKey(), iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
  }

  decrypt(payload: string): string {
    const parts = payload.split(':');
    if (parts.length !== 4 || parts[0] !== 'v1') {
      throw new AppError('Invalid encrypted token format', 500, 'ENCRYPTION_ERROR');
    }
    const iv = Buffer.from(parts[1]!, 'base64');
    const tag = Buffer.from(parts[2]!, 'base64');
    const data = Buffer.from(parts[3]!, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
}
