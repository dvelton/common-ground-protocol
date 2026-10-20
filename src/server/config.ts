import path from 'node:path';

export interface ServerConfig {
  host: string;
  port: number;
  databasePath: string;
  baseUrl: string;
  trustProxy: boolean;
}

export function getConfig(): ServerConfig {
  const port = Number.parseInt(process.env.CGP_PORT ?? '3000', 10);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('CGP_PORT must be a valid TCP port.');
  }

  return {
    host: process.env.CGP_HOST ?? '127.0.0.1',
    port,
    databasePath: path.resolve(process.env.CGP_DATABASE_PATH ?? './data/common-ground.sqlite'),
    baseUrl: process.env.CGP_BASE_URL ?? `http://localhost:${port}`,
    trustProxy: process.env.CGP_TRUST_PROXY === 'true',
  };
}
