import cron from 'node-cron';
import { syncAllMailboxes } from '@/lib/email/syncEngine';
import { dueBlasts } from '@/lib/email/emailStore';
import { runBlast, isBlastRunning } from '@/lib/email/blastEngine';

let started = false;

/**
 * Starts the background jobs. Safe to call more than once.
 *
 * Called from instrumentation.js, which Next.js runs once per server process.
 */
export function startEmailScheduler() {
  if (started) return;
  started = true;

  // IMAP poll, every 3 minutes.
  cron.schedule('*/3 * * * *', async () => {
    try {
      await syncAllMailboxes();
    } catch (error) {
      console.error('[email] scheduled sync failed:', error.message);
    }
  });

  // Scheduled blasts: check each minute for anything now due.
  cron.schedule('* * * * *', async () => {
    try {
      for (const { id } of dueBlasts()) {
        if (!isBlastRunning(id)) {
          runBlast(id).catch((error) => console.error(`[email] blast ${id}:`, error.message));
        }
      }
    } catch (error) {
      console.error('[email] blast scheduler failed:', error.message);
    }
  });

  console.log('[email] scheduler started (IMAP sync every 3 min, blast check every 1 min)');
}
