import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  encryptToken,
  decryptToken,
  verifyWebhookSignature,
  generateEncryptionKey,
} from '../crypto.js';

describe('AES-256-GCM Token Encryption', () => {
  const masterKey = generateEncryptionKey();
  const testToken = 'vercel_pat_AbCdEf1234567890TestToken';

  it('should generate a valid 64-character hex key', () => {
    expect(masterKey).toHaveLength(64);
    expect(/^[0-9a-f]+$/i.test(masterKey)).toBe(true);
  });

  it('should encrypt and decrypt a token successfully', () => {
    const encrypted = encryptToken(testToken, masterKey);

    expect(encrypted.encrypted).toBeDefined();
    expect(encrypted.iv).toHaveLength(24); // 12 bytes = 24 hex chars
    expect(encrypted.tag).toHaveLength(32); // 16 bytes = 32 hex chars
    expect(encrypted.encrypted).not.toEqual(testToken);

    const decrypted = decryptToken(
      encrypted.encrypted,
      encrypted.iv,
      encrypted.tag,
      masterKey
    );

    expect(decrypted).toBe(testToken);
  });

  it('should fail decryption when ciphertext is tampered', () => {
    const encrypted = encryptToken(testToken, masterKey);
    const tampered = encrypted.encrypted.slice(0, -2) + 'aa';

    expect(() =>
      decryptToken(tampered, encrypted.iv, encrypted.tag, masterKey)
    ).toThrow();
  });

  it('should fail decryption when auth tag is tampered', () => {
    const encrypted = encryptToken(testToken, masterKey);
    const tamperedTag = encrypted.tag.slice(0, -2) + 'ff';

    expect(() =>
      decryptToken(encrypted.encrypted, encrypted.iv, tamperedTag, masterKey)
    ).toThrow();
  });

  it('should fail when key is invalid length', () => {
    expect(() => encryptToken(testToken, 'shortkey')).toThrow(
      'Encryption key must be exactly 32 bytes'
    );
  });
});

describe('Webhook HMAC-SHA1 Signature Verification', () => {
  const secret = 'test_webhook_secret_key_123';
  const payload = JSON.stringify({
    type: 'deployment.succeeded',
    payload: { id: 'dpl_123' },
  });

  it('should verify a valid signature', () => {
    const signature = crypto
      .createHmac('sha1', secret)
      .update(payload)
      .digest('hex');

    const isValid = verifyWebhookSignature(payload, signature, secret);
    expect(isValid).toBe(true);
  });

  it('should reject a tampered payload', () => {
    const signature = crypto
      .createHmac('sha1', secret)
      .update(payload)
      .digest('hex');

    const tamperedPayload = payload + ' ';
    const isValid = verifyWebhookSignature(tamperedPayload, signature, secret);
    expect(isValid).toBe(false);
  });

  it('should reject an incorrect signature or secret', () => {
    const signature = crypto
      .createHmac('sha1', 'wrong_secret')
      .update(payload)
      .digest('hex');

    const isValid = verifyWebhookSignature(payload, signature, secret);
    expect(isValid).toBe(false);
  });

  it('should return false when signature or secret is missing', () => {
    expect(verifyWebhookSignature(payload, undefined, secret)).toBe(false);
    expect(verifyWebhookSignature(payload, 'signature', '')).toBe(false);
  });
});
