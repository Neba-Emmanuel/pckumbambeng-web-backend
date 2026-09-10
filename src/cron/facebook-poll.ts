import cron from 'node-cron';
import { facebookService } from '../services/facebook.service';

/**
 * Starts a cron job that polls Facebook for new posts every 6 hours.
 * Runs at minute 0 of every 6th hour (00:00, 06:00, 12:00, 18:00).
 */
export function startFacebookPolling(): void {
  console.log('[FacebookPoll] Scheduling Facebook polling cron job (every 6 hours)');

  cron.schedule('0 */6 * * *', async () => {
    console.log('[FacebookPoll] Starting Facebook post fetch...');
    try {
      await facebookService.fetchPosts();
      console.log('[FacebookPoll] Facebook post fetch completed successfully');
    } catch (error: any) {
      console.error(
        '[FacebookPoll] Error during Facebook post fetch:',
        error.message || error
      );
    }
  });
}
