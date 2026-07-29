export interface EnvironmentVariables {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL: string;
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

  return {
    NODE_ENV: nodeEnv as EnvironmentVariables['NODE_ENV'],
    PORT: port,
    DATABASE_URL: databaseUrl,
  };
}
