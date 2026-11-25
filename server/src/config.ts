import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function env(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const nodeEnv = env('NODE_ENV', 'development');

export const config = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: Number.parseInt(env('PORT', '4000'), 10),
  mongodbUri: env('MONGODB_URI'),
  mongodbDb: env('MONGODB_DB', 'order_manager'),
  firebaseProjectId: env('FIREBASE_PROJECT_ID'),
  firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() || '',
  firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim() || '',
  bootstrapAdminUid: process.env.BOOTSTRAP_ADMIN_UID?.trim() || '',
  corsOrigins: env('CORS_ORIGINS', '*')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  serveWeb: env('SERVE_WEB', 'true') !== 'false',
} as const;

if (!Number.isFinite(config.port) || config.port <= 0) {
  throw new Error('PORT must be a positive number');
}

if (!config.bootstrapAdminUid) {
  console.warn(
    '[config] BOOTSTRAP_ADMIN_UID is not set. No account will be promoted to admin automatically.'
  );
}
