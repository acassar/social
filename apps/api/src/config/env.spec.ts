import { validateEnv } from './env';

describe('validateEnv', () => {
  it('applique les valeurs par défaut si NODE_ENV/PORT sont absents', () => {
    expect(validateEnv({})).toEqual({ NODE_ENV: 'development', PORT: 3000 });
  });

  it('parse un environnement valide', () => {
    expect(validateEnv({ NODE_ENV: 'production', PORT: '4000' })).toEqual({
      NODE_ENV: 'production',
      PORT: 4000,
    });
  });

  it('rejette un NODE_ENV inconnu', () => {
    expect(() => validateEnv({ NODE_ENV: 'staging' })).toThrow(/NODE_ENV invalide/);
  });

  it('rejette un PORT non numérique', () => {
    expect(() => validateEnv({ PORT: 'abc' })).toThrow(/PORT invalide/);
  });
});
