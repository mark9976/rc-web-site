'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';
import { useAuth } from '@/components/AuthProvider';
import { readError } from '@/lib/apiClient';
import { Mail, AlertTriangle } from 'lucide-react';

const memberInputClass =
  'w-full rounded-3xl border border-black/10 bg-surface-card px-4 py-3 text-sm outline-none focus:border-field-green focus:ring-2 focus:ring-field-green/10';

function formatTimestamp(value) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('default', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function Page() {
  const auth = useAuth();
  const [memberEmail, setMemberEmail] = useState(null);
  const [testAddress, setTestAddress] = useState('');
  const [memberEmailMessage, setMemberEmailMessage] = useState('');
  const [memberEmailError, setMemberEmailError] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  const refreshAdminData = useCallback(async () => {
    const res = await fetch('/api/member-email', { cache: 'no-store' });
    if (res.ok) setMemberEmail(await res.json());
  }, []);

  useEffect(() => {
    if (auth.isAdmin) refreshAdminData();
  }, [auth.isAdmin, refreshAdminData]);

  const selectMemberEmailMailbox = async (mailboxId) => {
    setMemberEmailError('');
    setMemberEmailMessage('');
    const res = await fetch('/api/member-email', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mailboxId: mailboxId || null }),
    });
    if (!res.ok) {
      setMemberEmailError(await readError(res, 'Unable to save the mailbox.'));
      return;
    }
    await refreshAdminData();
  };

  const sendTestMemberEmail = async () => {
    setMemberEmailError('');
    setMemberEmailMessage('');
    setSendingTest(true);
    try {
      const res = await fetch('/api/member-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testAddress }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMemberEmailError(data.error || 'Unable to send the test email.');
      } else if (data.sent) {
        setMemberEmailMessage(`Test email sent to ${data.to} from ${data.from}.`);
      } else {
        setMemberEmailError(`Not sent: ${data.reason}`);
      }
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <AdminShell title="New Member Emails" subtitle="Which mailbox sends login details">
      <>

      <div className="card p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Mail className="w-6 h-6 text-sky-deep" />
          <div>
            <h3 className="font-display font-bold text-xl">New Member Emails</h3>
            <p className="text-sm text-ink-muted">
              Which club mailbox sends the username and temporary password when you approve a membership
              request.
            </p>
          </div>
        </div>

        {memberEmail?.mailboxes?.length ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-ink">Send from</span>
                <select
                  value={memberEmail.selectedId ?? ''}
                  onChange={(event) => selectMemberEmailMailbox(event.target.value)}
                  className={`mt-2 ${memberInputClass}`}
                >
                  <option value="">Use the default mailbox</option>
                  {memberEmail.mailboxes.map((mailbox) => (
                    <option key={mailbox.id} value={mailbox.id}>
                      {mailbox.display_name} — {mailbox.email_address}
                      {mailbox.is_default ? ' (default)' : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-ink">Send a test to</span>
                <div className="mt-2 flex gap-2">
                  <input
                    type="email"
                    value={testAddress}
                    onChange={(event) => setTestAddress(event.target.value)}
                    placeholder="you@example.com"
                    className={memberInputClass}
                  />
                  <button
                    type="button"
                    onClick={sendTestMemberEmail}
                    disabled={sendingTest}
                    className="btn-secondary text-xs shrink-0 disabled:opacity-60"
                  >
                    {sendingTest ? 'Sending…' : 'Send test'}
                  </button>
                </div>
                <span className="mt-1 block text-xs text-ink-light">
                  Sends a sample welcome email. No account is created or changed.
                </span>
              </label>
            </div>

            {/* Say which mailbox is genuinely in use after the fallback, and
                flag it up front if that mailbox cannot currently send. */}
            {memberEmail.activeMailbox ? (
              <p className="mt-4 text-xs text-ink-light">
                Currently sending from{' '}
                <strong className="text-ink">{memberEmail.activeMailbox.email_address}</strong>.
              </p>
            ) : null}
            {memberEmail.activeMailbox?.needs_reauth ? (
              <p className="mt-3 flex items-start gap-2 rounded-2xl border border-flyday-nogo/30 bg-flyday-nogo/5 p-3 text-sm text-flyday-nogo">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  This mailbox needs reconnecting before it can send. Go to{' '}
                  <Link href="/admin/email/settings/" className="underline font-semibold">Email → Settings</Link>{' '}
                  and press Reconnect. Until then, approving a member will show you their password to pass on by hand.
                </span>
              </p>
            ) : null}
          </>
        ) : (
          <div className="rounded-2xl border border-flyday-maybe/30 bg-flyday-maybe/5 p-4 text-sm text-flyday-maybe">
            <p className="font-semibold">No club mailbox is set up yet.</p>
            <p className="mt-1">
              Add one under <Link href="/admin/email/settings/" className="underline font-semibold">Email → Settings</Link>{' '}
              before approvals can send email. Approving still works — you will be shown the temporary password to pass on.
            </p>
          </div>
        )}

        {memberEmailMessage ? (
          <p className="mt-4 rounded-2xl border border-field-green/30 bg-field-green/5 p-3 text-sm text-field-green">
            {memberEmailMessage}
          </p>
        ) : null}
        {memberEmailError ? <p className="mt-4 text-sm text-red-600">{memberEmailError}</p> : null}
      </div>
      </>
    </AdminShell>
  );
}
