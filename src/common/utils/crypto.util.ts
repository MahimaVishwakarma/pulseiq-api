import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-ctr';

export function encrypt(text: string, key: string): string {
  const iv = randomBytes(16);
  const derivedKey = scryptSync(key, 'salt', 32);
  const cipher = createCipheriv(ALGORITHM, derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(hash: string, key: string): string {
  const [ivHex, encryptedHex] = hash.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const derivedKey = scryptSync(key, 'salt', 32);
  const decipher = createDecipheriv(ALGORITHM, derivedKey, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString();
}
