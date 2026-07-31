export interface EnvironmentVariables {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES_IN: string;
  UPLOADS_DIR: string;
  CORS_ORIGINS: string[];
  VAPID_PUBLIC_KEY: string | null;
  VAPID_PRIVATE_KEY: string | null;
  VAPID_SUBJECT: string;
}

const VALID_NODE_ENVS: EnvironmentVariables['NODE_ENV'][] = ['development', 'test', 'production'];

export function validateEnv(rawEnv: Record<string, unknown>): EnvironmentVariables {
  const nodeEnv = (rawEnv.NODE_ENV as string | undefined) ?? 'development';
  if (!VALID_NODE_ENVS.includes(nodeEnv as EnvironmentVariables['NODE_ENV'])) {
    throw new Error(`NODE_ENV invalide : "${nodeEnv}" (attendu : ${VALID_NODE_ENVS.join(', ')})`);
  }

  const rawPort = (rawEnv.PORT as string | undefined) ?? '3000';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`PORT invalide : "${rawPort}" (attendu un entier positif)`);
  }

  const databaseUrl = rawEnv.DATABASE_URL as string | undefined;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL invalide : variable manquante');
  }

  const jwtAccessSecret = rawEnv.JWT_ACCESS_SECRET as string | undefined;
  if (!jwtAccessSecret) {
    throw new Error('JWT_ACCESS_SECRET invalide : variable manquante');
  }

  const jwtRefreshSecret = rawEnv.JWT_REFRESH_SECRET as string | undefined;
  if (!jwtRefreshSecret) {
    throw new Error('JWT_REFRESH_SECRET invalide : variable manquante');
  }

  const jwtAccessExpiresIn = (rawEnv.JWT_ACCESS_EXPIRES_IN as string | undefined) ?? '15m';
  const jwtRefreshExpiresIn = (rawEnv.JWT_REFRESH_EXPIRES_IN as string | undefined) ?? '30d';

  // Dossier local où sont écrits les fichiers uploadés (M5-T1). En prod, ce
  // dossier vit sur un volume du VPS servi statiquement par le reverse
  // proxy sous /uploads (cf. doc/BACKLOG.md M5-T1/M7-T2).
  const uploadsDir = (rawEnv.UPLOADS_DIR as string | undefined) ?? './uploads';

  // Origines autorisées à appeler l'API depuis un navigateur, séparées par des
  // virgules. Le front (Vite) et l'API tournent sur des ports distincts en dev,
  // donc toute requête du front est cross-origin ; en prod, l'URL publique du
  // front. Liste explicite plutôt que `*` : le front envoie un Bearer token.
  const rawCorsOrigins = (rawEnv.CORS_ORIGINS as string | undefined) ?? 'http://localhost:5173';
  const corsOrigins = rawCorsOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  if (corsOrigins.length === 0) {
    throw new Error(`CORS_ORIGINS invalide : "${rawCorsOrigins}" (attendu au moins une origine)`);
  }

  // Web Push (M6-T2) — optionnel : sans clés VAPID, PushService loggue un
  // avertissement et n'envoie aucune notification (l'opt-in par salon reste
  // fonctionnel, seul l'envoi effectif est désactivé). À générer via
  // `npx web-push generate-vapid-keys` pour un vrai déploiement.
  const vapidPublicKey = (rawEnv.VAPID_PUBLIC_KEY as string | undefined) || null;
  const vapidPrivateKey = (rawEnv.VAPID_PRIVATE_KEY as string | undefined) || null;
  const vapidSubject = (rawEnv.VAPID_SUBJECT as string | undefined) || 'mailto:admin@example.com';

  return {
    NODE_ENV: nodeEnv as EnvironmentVariables['NODE_ENV'],
    PORT: port,
    DATABASE_URL: databaseUrl,
    JWT_ACCESS_SECRET: jwtAccessSecret,
    JWT_ACCESS_EXPIRES_IN: jwtAccessExpiresIn,
    JWT_REFRESH_SECRET: jwtRefreshSecret,
    JWT_REFRESH_EXPIRES_IN: jwtRefreshExpiresIn,
    UPLOADS_DIR: uploadsDir,
    CORS_ORIGINS: corsOrigins,
    VAPID_PUBLIC_KEY: vapidPublicKey,
    VAPID_PRIVATE_KEY: vapidPrivateKey,
    VAPID_SUBJECT: vapidSubject,
  };
}
