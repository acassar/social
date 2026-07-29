import { hash } from 'bcryptjs';

const SALT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return hash(password, SALT_ROUNDS);
}
