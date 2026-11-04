import crypto from 'crypto';
import { config } from '../config/index.js';

export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
}

/**
 * Encrypts a sensitive string (such as a Vercel Personal Access Token) using AES-256-GCM.
 * Uses a unique 12-byte IV for every encryption and generates an authentication tag.
 */
export function encryptToken(plainText: string, masterKeyHex?: string): EncryptedData {
  const keyHex = masterKeyHex || config.ENCRYPTION_KEY;
  const key = Buffer.from(keyHex, 'hex');

  if (key.length !== 32) {
    throw new Error('Encryption key must be exactly 32 bytes (64 hex characters)');
  }

  // 12-byte initialization vector recommended for AES-GCM
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

/**
 * Decrypts an AES-256-GCM encrypted token.
 * Validates the authentication tag to guarantee data integrity.
 */
export function decryptToken(
  encryptedHex: string,
  ivHex: string,
  tagHex: string,
  masterKeyHex?: string
): string {
  const keyHex = masterKeyHex || config.ENCRYPTION_KEY;
  const key = Buffer.from(keyHex, 'hex');

  if (key.length !== 32) {
    throw new Error('Encryption key must be exactly 32 bytes (64 hex characters)');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Verifies a Vercel Webhook HMAC-SHA1 signature (from header `x-vercel-signature`).
 * Uses timing-safe equality check to protect against timing attacks.
 */
export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature || !secret) {
    return false;
  }

  try {
    const computedSignature = crypto
      .createHmac('sha1', secret)
      .update(rawBody)
      .digest('hex');

    const signatureBuffer = Buffer.from(signature, 'hex');
    const computedBuffer = Buffer.from(computedSignature, 'hex');

    if (signatureBuffer.length !== computedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(signatureBuffer, computedBuffer);
  } catch {
    return false;
  }
}

/**
 * Generates a random 32-byte hexadecimal encryption key.
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
