import { compare } from 'bcryptjs';
import { hashPassword } from './password';

describe('hashPassword', () => {
  it('retourne un hash différent du mot de passe en clair', async () => {
    const passwordHash = await hashPassword('super-secret');

    expect(passwordHash).not.toBe('super-secret');
    expect(passwordHash.length).toBeGreaterThan(0);
  });

  it('produit un hash vérifiable avec bcryptjs', async () => {
    const passwordHash = await hashPassword('super-secret');

    await expect(compare('super-secret', passwordHash)).resolves.toBe(true);
    await expect(compare('wrong-password', passwordHash)).resolves.toBe(false);
  });
});
