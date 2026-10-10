import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { ScoringQuestion } from './learning';

export type GuestExam = {
  examId: string;
  expiresAt: number;
  passingScore: number;
  questions: ScoringQuestion[];
};
function key() {
  if (!process.env.AUTH_SECRET) throw new Error('AUTH_SECRET is required.');
  return createHash('sha256').update(process.env.AUTH_SECRET).digest();
}
// Authenticated encryption keeps the answer key private and prevents changing the
// questions, timer, or passing score without persisting an anonymous attempt.
export function sealGuestExam(exam: GuestExam) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(exam)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
}
export function openGuestExam(token: string): GuestExam {
  if (token.length > 4_000_000) throw new Error('Invalid assessment.');
  const data = Buffer.from(token, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', key(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString(),
  );
}
