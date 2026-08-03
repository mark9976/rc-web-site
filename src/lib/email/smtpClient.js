import nodemailer from 'nodemailer';
import juice from 'juice';

const transporterCache = new Map();

/**
 * Nodemailer transports are pooled and reused per mailbox: building a fresh TLS
 * connection for every message in a blast is slow and looks like abuse to the
 * provider.
 */
export function getTransporter(credentials) {
  // The access token is part of the cache key: a pooled transport holds its
  // credentials for the life of the connection, so reusing one across a token
  // refresh would keep presenting the expired token until it failed.
  const secretTag = credentials.accessToken ? `oauth:${credentials.accessToken.slice(-16)}` : 'basic';
  const key = `${credentials.id}:${credentials.smtp_host}:${credentials.smtp_port}:${credentials.username}:${secretTag}`;
  if (transporterCache.has(key)) return transporterCache.get(key);

  // A refreshed token means the previous transport is dead weight.
  if (credentials.accessToken) clearTransporter(credentials.id);

  const port = credentials.smtp_port || 465;
  const auth = credentials.accessToken
    ? { type: 'OAuth2', user: credentials.username, accessToken: credentials.accessToken }
    : { user: credentials.username, pass: credentials.password };

  const transporter = nodemailer.createTransport({
    host: credentials.smtp_host,
    port,
    secure: port === 465, // 587 negotiates STARTTLS instead
    auth,
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
  });

  transporterCache.set(key, transporter);
  return transporter;
}

export function clearTransporter(mailboxId) {
  for (const key of transporterCache.keys()) {
    if (key.startsWith(`${mailboxId}:`)) {
      transporterCache.get(key)?.close?.();
      transporterCache.delete(key);
    }
  }
}

export async function testSmtpConnection(credentials) {
  try {
    await getTransporter(credentials).verify();
    return { ok: true };
  } catch (error) {
    clearTransporter(credentials.id);
    return { ok: false, error: error.message || 'SMTP connection failed.' };
  }
}

/** Strips tags for the text/plain alternative so the mail isn't HTML-only. */
export function htmlToPlainText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Sends one message.
 *
 * The body is run through juice first: many mail clients drop <style> blocks,
 * so CSS has to be inlined on each element to survive.
 */
export async function sendMail(credentials, message) {
  const html = juice(message.html || '');

  const info = await getTransporter(credentials).sendMail({
    from: { name: credentials.display_name, address: credentials.email_address },
    to: message.to,
    cc: message.cc?.length ? message.cc : undefined,
    bcc: message.bcc?.length ? message.bcc : undefined,
    subject: message.subject,
    html,
    text: message.text || htmlToPlainText(html),
    inReplyTo: message.inReplyTo || undefined,
    references: message.references?.length ? message.references : undefined,
    attachments: message.attachments,
  });

  return { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected };
}

/** One retry, because a transient 4xx from the relay is common and worth a second go. */
export async function sendMailWithRetry(credentials, message) {
  try {
    return await sendMail(credentials, message);
  } catch (firstError) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      return await sendMail(credentials, message);
    } catch (secondError) {
      const error = new Error(secondError.message || firstError.message || 'Send failed.');
      error.cause = secondError;
      throw error;
    }
  }
}
