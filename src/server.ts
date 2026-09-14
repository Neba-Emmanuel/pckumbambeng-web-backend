import app from './app';
import { env, testConnection } from './config';
import { startFacebookPolling } from './cron/facebook-poll';

async function main(): Promise<void> {
  // Test database connection
  await testConnection();

  app.get('/', (req, res) => {
    res.json({ message: 'Server is running!' });
  });

  // Start Express server
  app.listen(env.port, () => {
    console.log(`[Server] Running on port ${env.port} (${env.nodeEnv})`);
  });

  // Start background cron jobs
  startFacebookPolling();
}

main().catch((error) => {
  console.error('[Server] Failed to start:', error);
  process.exit(1);
});
