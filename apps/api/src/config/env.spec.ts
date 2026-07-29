import { validateEnv } from './env';

const DATABASE_URL = 'postgresql://social:social@localhost:5432/social?schema=public';

describe('validateEnv', () => {
  it('applique les valeurs par défaut si NODE_ENV/PORT sont absents', () => {
    expect(validateEnv({ DATABASE_URL })).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL,
    });
  });

  it('parse un environnement valide', () => {
    expect(validateEnv({ NODE_ENV: 'production', PORT: '4000', DATABASE_URL })).toEqual({
      NODE_ENV: 'production',
      PORT: 4000,
      DATABASE_URL,
    });
  });

  it('rejette un NODE_ENV inconnu', () => {
    expect(() => validateEnv({ NODE_ENV: 'staging', DATABASE_URL })).toThrow(/NODE_ENV invalide/);
  });

  it('rejette un PORT non numérique', () => {
    expect(() => validateEnv({ PORT: 'abc', DATABASE_URL })).toThrow(/PORT invalide/);
  });

  it('rejette une DATABASE_URL manquante', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL invalide/);
  });
});
