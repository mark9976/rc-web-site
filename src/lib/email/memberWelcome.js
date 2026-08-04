import { getDefaultMailbox } from '@/lib/email/emailStore';
import { resolveMailboxAuth } from '@/lib/email/mailboxAuth';
import { sendMailWithRetry } from '@/lib/email/smtpClient';

/** Values land in an HTML email, so escape anything that came from a form. */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHtml({ name, username, password, siteUrl }) {
  return `
    <div style="font-family:Helvetica,Arial,sans-serif;color:#1A1A2E;line-height:1.5;">
      <h2 style="color:#2D5A27;margin:0 0 12px;">Welcome to LHMAC</h2>
      <p>Hi ${escapeHtml(name)},</p>
      <p>Your request for website access to the Laurel Highlands Model Airplane Club has been approved.
         Here are your sign-in details:</p>
      <table style="border-collapse:collapse;margin:18px 0;">
        <tr>
          <td style="padding:8px 16px 8px 0;color:#5A5A6E;">Username</td>
          <td style="padding:8px 0;font-family:monospace;font-size:16px;"><strong>${escapeHtml(username)}</strong></td>
        </tr>
        <tr>
          <td style="padding:8px 16px 8px 0;color:#5A5A6E;">Temporary password</td>
          <td style="padding:8px 0;font-family:monospace;font-size:16px;"><strong>${escapeHtml(password)}</strong></td>
        </tr>
      </table>
      <p><a href="${escapeHtml(siteUrl)}/login/"
            style="display:inline-block;background:#2D5A27;color:#ffffff;text-decoration:none;
                   padding:12px 22px;border-radius:999px;font-weight:bold;">Sign in</a></p>
      <p style="margin-top:18px;">You will be asked to choose your own password the first time you sign in.
         The temporary one above stops working at that point.</p>
      <p style="color:#5A5A6E;font-size:13px;margin-top:24px;">
        If you did not request access, you can ignore this email and nothing will happen.
      </p>
      <p style="color:#5A5A6E;font-size:13px;">— Laurel Highlands Model Airplane Club</p>
    </div>`;
}

function buildText({ name, username, password, siteUrl }) {
  return [
    `Hi ${name},`,
    '',
    'Your request for website access to the Laurel Highlands Model Airplane Club has been approved.',
    '',
    `Username:           ${username}`,
    `Temporary password: ${password}`,
    '',
    `Sign in: ${siteUrl}/login/`,
    '',
    'You will be asked to choose your own password the first time you sign in.',
    'The temporary one above stops working at that point.',
    '',
    'If you did not request access, you can ignore this email.',
    '',
    '— Laurel Highlands Model Airplane Club',
  ].join('\n');
}

/**
 * Emails a newly approved member their username and one-time password.
 *
 * Only ever called after an admin approves an application — nothing is sent
 * when a request is submitted or rejected.
 *
 * Never throws: the account already exists by this point, so a mail failure
 * must not undo the approval. The caller reports the outcome so the admin can
 * pass the credentials on by hand if needed.
 */
export async function sendMemberWelcomeEmail({ to, name, username, password, siteUrl }) {
  const mailbox = getDefaultMailbox();
  if (!mailbox) {
    return { sent: false, reason: 'No club mailbox is configured, so no email could be sent.' };
  }

  try {
    const credentials = await resolveMailboxAuth(mailbox.id);
    if (!credentials) return { sent: false, reason: 'The club mailbox could not be opened.' };

    const fields = { name, username, password, siteUrl };
    await sendMailWithRetry(credentials, {
      to: [to],
      subject: 'Your LHMAC website login',
      html: buildHtml(fields),
      text: buildText(fields),
    });

    return { sent: true, from: mailbox.email_address };
  } catch (error) {
    return { sent: false, reason: error.message || 'The welcome email could not be sent.' };
  }
}
