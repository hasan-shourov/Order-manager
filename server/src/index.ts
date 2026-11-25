import { createApp } from './app';
import { config } from './config';
import { closeDb, connectDb } from './db';

async function main(): Promise<void> {
  await connectDb();
  console.log(`[server] Connected to MongoDB database "${config.mongodbDb}".`);

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[server] Listening on http://localhost:${config.port}`);
    if (config.bootstrapAdminUid) {
      console.log('[server] Bootstrap admin UID is configured.');
    } else {
      console.warn('[server] BOOTSTRAP_ADMIN_UID is not configured.');
    }
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[server] ${signal} received, shutting down.`);
    server.close(() => {
      closeDb()
        .catch((error) => console.error('[server] Error closing database:', error))
        .finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('[server] Failed to start:', error);
  process.exit(1);
});
