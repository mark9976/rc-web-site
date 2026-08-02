'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import EmailShell from '../EmailShell';
import ComposeForm from '@/components/email/ComposeForm';
import { apiJson } from '@/components/email/emailUi';

export default function ComposePage() {
  const router = useRouter();
  const [mailboxes, setMailboxes] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiJson('/api/email/mailboxes')
      .then((d) => setMailboxes(d.mailboxes || []))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <EmailShell title="Compose" subtitle="Send a message from a club mailbox">
      {error ? <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p> : null}
      {mailboxes.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-muted">Add a mailbox in Settings before sending.</div>
      ) : (
        <div className="card p-6">
          <ComposeForm
            mailboxes={mailboxes}
            mailboxId={mailboxes.find((m) => m.is_default)?.id ?? mailboxes[0].id}
            onSent={() => router.push('/admin/email/')}
            onCancel={() => router.push('/admin/email/')}
          />
        </div>
      )}
    </EmailShell>
  );
}
