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
      UPLOADS_DIR: './uploads',
      CORS_ORIGINS: ['http://localhost:5173'],
      VAPID_PUBLIC_KEY: null,
      VAPID_PRIVATE_KEY: null,
      VAPID_SUBJECT: 'mailto:admin@example.com',
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
        UPLOADS_DIR: '/var/data/uploads',
        CORS_ORIGINS: 'https://social.example, https://www.social.example',
        VAPID_PUBLIC_KEY: 'pub-key',
        VAPID_PRIVATE_KEY: 'priv-key',
        VAPID_SUBJECT: 'mailto:ops@social.example',
      }),
    ).toEqual({
      NODE_ENV: 'production',
      PORT: 4000,
      DATABASE_URL,
      JWT_ACCESS_SECRET,
      JWT_ACCESS_EXPIRES_IN: '5m',
      JWT_REFRESH_SECRET,
      JWT_REFRESH_EXPIRES_IN: '7d',
      UPLOADS_DIR: '/var/data/uploads',
      CORS_ORIGINS: ['https://social.example', 'https://www.social.example'],
      VAPID_PUBLIC_KEY: 'pub-key',
      VAPID_PRIVATE_KEY: 'priv-key',
      VAPID_SUBJECT: 'mailto:ops@social.example',
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

  it('rejette un CORS_ORIGINS vide', () => {
    expect(() => validateEnv({ ...REQUIRED_ENV, CORS_ORIGINS: ' , ' })).toThrow(
      /CORS_ORIGINS invalide/,
    );
  });
});
