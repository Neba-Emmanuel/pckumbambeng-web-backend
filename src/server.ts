import app from './app';
import { env, testConnection } from './config';
import { startFacebookPolling } from './cron/facebook-poll';

async function main(): Promise<void> {
  await testConnection();
  if (process.env.VERCEL) return;
  app.listen(env.port, () => {
    console.log(`[Server] Running on port ${env.port} (${env.nodeEnv})`);
  });
  startFacebookPolling();
}

main().catch((error) => {
  console.error('[Server] Failed to start:', error);
  process.exit(1);
});
