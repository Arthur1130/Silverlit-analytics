import { randomBytes } from 'node:crypto';

// Génère un jeton d'invitation à usage unique, non devinable.
// 32 octets → 64 caractères hexadécimaux.
export function generateInvitationToken(): string {
  return randomBytes(32).toString('hex');
}
