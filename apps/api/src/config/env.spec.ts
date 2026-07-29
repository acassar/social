import { validateEnv } from './env';

const DATABASE_URL = 'postgresql://social:social@localhost:5432/social?schema=public';
const JWT_ACCESS_SECRET = 'access-secret';
const JWT_REFRESH_SECRET = 'refresh-secret';
const REQUIRED_ENV = { DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET };

describe('validateEnv', () => {
  it('applique les valeurs par défaut si NODE_ENV/PORT/expirations sont absents', () => {
    expect(validateEnv(REQUIRED_ENV)).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL,
      JWT_ACCESS_SECRET,
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_SECRET,
      JWT_REFRESH_EXPIRES_IN: '30d',
    });
  });

  it('parse un environnement valide', () => {
    expect(
      validateEnv({
        ...REQUIRED_ENV,
        NODE_ENV: 'production',
        PORT: '4000',
        JWT_ACCESS_EXPIRES_IN: '5m',
        JWT_REFRESH_EXPIRES_IN: '7d',
      }),
    ).toEqual({
      NODE_ENV: 'production',
      PORT: 4000,
      DATABASE_URL,
      JWT_ACCESS_SECRET,
      JWT_ACCESS_EXPIRES_IN: '5m',
      JWT_REFRESH_SECRET,
      JWT_REFRESH_EXPIRES_IN: '7d',
    });
  });

  it('rejette un NODE_ENV inconnu', () => {
    expect(() => validateEnv({ ...REQUIRED_ENV, NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV invalide/,
    );
  });

  it('rejette un PORT non numérique', () => {
    expect(() => validateEnv({ ...REQUIRED_ENV, PORT: 'abc' })).toThrow(/PORT invalide/);
  });

  it('rejette une DATABASE_URL manquante', () => {
    expect(() => validateEnv({ JWT_ACCESS_SECRET, JWT_REFRESH_SECRET })).toThrow(
      /DATABASE_URL invalide/,
    );
  });

  it('rejette un JWT_ACCESS_SECRET manquant', () => {
    expect(() => validateEnv({ DATABASE_URL, JWT_REFRESH_SECRET })).toThrow(
      /JWT_ACCESS_SECRET invalide/,
    );
  });

  it('rejette un JWT_REFRESH_SECRET manquant', () => {
    expect(() => validateEnv({ DATABASE_URL, JWT_ACCESS_SECRET })).toThrow(
      /JWT_REFRESH_SECRET invalide/,
    );
  });
});
