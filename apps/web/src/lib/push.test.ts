import { describe, expect, it } from 'vitest';
import { ensurePushSubscribed, isPushSupported } from './push';

// VITE_VAPID_PUBLIC_KEY n'est pas défini dans l'environnement de test (pas
// de .env chargé) : ce module doit se dégrader proprement plutôt que
// planter, conformément au commentaire dans .env.example (bouton masqué
// sans clé publique configurée).
describe('push (sans VITE_VAPID_PUBLIC_KEY configurée)', () => {
  it('isPushSupported renvoie false', () => {
    expect(isPushSupported()).toBe(false);
  });

  it('ensurePushSubscribed rejette explicitement plutôt que de planter', async () => {
    await expect(ensurePushSubscribed()).rejects.toThrow(/notifications/i);
  });
});
