import { compare } from 'bcryptjs';
import { hashPassword, verifyPassword } from './password';

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

describe('verifyPassword', () => {
  it('retourne true pour le bon mot de passe', async () => {
    const passwordHash = await hashPassword('super-secret');

    await expect(verifyPassword('super-secret', passwordHash)).resolves.toBe(true);
  });

  it('retourne false pour un mauvais mot de passe', async () => {
    const passwordHash = await hashPassword('super-secret');

    await expect(verifyPassword('wrong-password', passwordHash)).resolves.toBe(false);
  });
});
