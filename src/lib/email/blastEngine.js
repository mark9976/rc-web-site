import { getMailboxCredentials, pendingBlastRecipients, markRecipient, updateBlastStatus, refreshBlastCounts, getBlast } from '@/lib/email/emailStore';
import { sendMailWithRetry } from '@/lib/email/smtpClient';
import { applyMergeFields, mergeContextForContact } from '@/lib/email/mergeFields';

// GoDaddy allows roughly 250-500 messages/hour. 10 per batch with a 2s gap is
// ~1800/hour in theory, so the real limiter is the hourly cap below.
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 2000;
const MAX_PER_HOUR = 240;

const running = new Set();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends a blast, one message per recipient.
 *
 * Individual sends rather than a single BCC, because merge fields have to
 * resolve per person — and it means one bad address fails alone instead of
 * taking the batch with it.
 */
export async function runBlast(blastId) {
  if (running.has(blastId)) return { skipped: true, reason: 'Blast already running.' };
  running.add(blastId);

  try {
    const blast = getBlast(blastId);
    if (!blast) return { ok: false, error: 'Blast not found.' };
    if (blast.status === 'completed') return { ok: true, alreadyDone: true };

    const credentials = getMailboxCredentials(blast.mailbox_id);
    if (!credentials) {
      updateBlastStatus(blastId, { status: 'failed' });
      return { ok: false, error: 'Sending mailbox no longer exists.' };
    }

    updateBlastStatus(blastId, { status: 'sending', started_at: new Date().toISOString() });

    let sentThisHour = 0;
    let hourStarted = Date.now();

    for (;;) {
      const batch = pendingBlastRecipients(blastId, BATCH_SIZE);
      if (batch.length === 0) break;

      // Respect the provider's hourly ceiling by parking until the hour rolls.
      if (sentThisHour >= MAX_PER_HOUR) {
        const elapsed = Date.now() - hourStarted;
        const wait = Math.max(0, 3600_000 - elapsed);
        console.log(`[email] blast ${blastId} hit the hourly cap; pausing ${Math.round(wait / 60000)} min`);
        await sleep(wait);
        sentThisHour = 0;
        hourStarted = Date.now();
      }

      for (const recipient of batch) {
        const context = mergeContextForContact(recipient);
        try {
          await sendMailWithRetry(credentials, {
            to: recipient.email,
            subject: applyMergeFields(blast.subject, context),
            html: applyMergeFields(blast.body_html, context),
          });
          markRecipient(recipient.id, 'sent');
        } catch (error) {
          markRecipient(recipient.id, 'failed', error.message?.slice(0, 500) || 'Send failed.');
        }
        sentThisHour += 1;
      }

      refreshBlastCounts(blastId);
      await sleep(BATCH_DELAY_MS);
    }

    const counts = refreshBlastCounts(blastId);
    updateBlastStatus(blastId, {
      status: counts.sent === 0 && counts.failed > 0 ? 'failed' : 'completed',
      completed_at: new Date().toISOString(),
    });

    return { ok: true, ...counts };
  } catch (error) {
    console.error(`[email] blast ${blastId} crashed:`, error.message);
    updateBlastStatus(blastId, { status: 'failed', completed_at: new Date().toISOString() });
    return { ok: false, error: error.message };
  } finally {
    running.delete(blastId);
  }
}

/** Kicks a blast off without blocking the HTTP response. */
export function startBlastInBackground(blastId) {
  setImmediate(() => {
    runBlast(blastId).catch((error) => console.error(`[email] blast ${blastId}:`, error.message));
  });
}

export function isBlastRunning(blastId) {
  return running.has(blastId);
}
