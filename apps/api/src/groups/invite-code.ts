import { randomBytes } from 'node:crypto';

export function generateInviteCode(): string {
  return randomBytes(6).toString('base64url');
}
