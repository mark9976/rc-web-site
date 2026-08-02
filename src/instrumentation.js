/**
 * Next.js runs this once when the server process boots.
 *
 * The nodejs-runtime guard matters: this file is also evaluated for the edge
 * runtime and during the build, neither of which can open IMAP sockets or load
 * better-sqlite3.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  // Cron jobs would fire against a half-built app during `next build`.
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  const { startEmailScheduler } = await import('@/lib/email/scheduler');
  startEmailScheduler();
}
