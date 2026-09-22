import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export const isApiKeySyntaxValid = (apiKey: string): boolean => {
  if (!apiKey || !apiKey.startsWith('pls_')) return false;

  const firstUnderscore = apiKey.indexOf('_');
  const secondUnderscore = apiKey.indexOf('_', firstUnderscore + 1);
  if (secondUnderscore === -1) return false;

  const prefix = apiKey.slice(0, firstUnderscore);
  const keyId = apiKey.slice(firstUnderscore + 1, secondUnderscore);
  const secret = apiKey.slice(secondUnderscore + 1);

  return (
    prefix === 'pls' &&
    keyId.length === 32 &&
    secret.length === 43 &&
    /^[a-f0-9]{32}$/i.test(keyId) &&
    /^[a-zA-Z0-9_-]{43}$/.test(secret)
  );
};

export const extractApiKeyId = (apiKey: string): string => {
  const apiParts = apiKey.split('_');
  return apiParts[1];
};

export const digestApiKey = (apiKey: string): string => {
  const REDIS_KEY_SECRET = process.env.REDIS_KEY_SECRET;
  if (!REDIS_KEY_SECRET) throw new Error('REDIS_KEY_SECRET is required');
  return crypto
    .createHmac('sha256', REDIS_KEY_SECRET)
    .update(apiKey)
    .digest('hex');
};

export function addUuidDashes(uuid: string): string {
  const cleanUuid = uuid.replace(/-/g, '');

  if (!/^[0-9a-fA-F]{32}$/.test(cleanUuid)) {
    throw new Error('Invalid UUID');
  }

  return [
    cleanUuid.slice(0, 8),
    cleanUuid.slice(8, 12),
    cleanUuid.slice(12, 16),
    cleanUuid.slice(16, 20),
    cleanUuid.slice(20, 32),
  ].join('-');
}
