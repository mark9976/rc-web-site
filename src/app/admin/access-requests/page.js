'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';
import { useAuth } from '@/components/AuthProvider';
import { readError } from '@/lib/apiClient';
import { ShieldCheck } from 'lucide-react';

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
  // The pending list lives in AuthProvider, which already refreshes it.
  const pendingApplications = auth.pendingApplications || [];
  const pendingPendingCount = pendingApplications.filter((a) => a.status === 'pending').length;
  const [applicationMessage, setApplicationMessage] = useState('');
  const [applicationError, setApplicationError] = useState('');

  const refreshAdminData = useCallback(async () => {
    await auth.refreshApplications?.();
  }, []);

  useEffect(() => {
    if (auth.isAdmin) refreshAdminData();
  }, [auth.isAdmin, refreshAdminData]);

  const handleApproveApplication = async (applicationId) => {
    const result = await auth.approveApplication(applicationId);
    if (result.error) {
      setApplicationError(result.error);
      setApplicationMessage('');
      return;
    }
    if (!result.user) {
      setApplicationMessage('Application approved.');
      setApplicationError('');
      await refreshAdminData();
      return;
    }

    const who = `${result.user.name} (username: ${result.user.username})`;
    // Their chosen name may have been claimed between applying and approval.
    const renamed = result.usernameChangedFrom
      ? ` Note: “${result.usernameChangedFrom}” had been taken, so they were given “${result.user.username}”.`
      : '';
    if (result.email?.sent) {
      setApplicationMessage(`Approved ${who}. Their login details were emailed to them.${renamed}`);
      setApplicationError('');
    } else {
      // The account exists either way, so show the password for hand-off
      // rather than leaving the admin with no way to reach the new member.
      setApplicationMessage(
        `Approved ${who}, but the welcome email could not be sent${result.email?.reason ? `: ${result.email.reason}` : '.'} ` +
        `Give them this temporary password yourself: ${result.temporaryPassword ?? '(unavailable)'}${renamed}`
      );
      setApplicationError('');
    }
    await refreshAdminData();
  };

  const handleRejectApplication = async (applicationId) => {
    const result = await auth.rejectApplication(applicationId);
    if (result.error) {
      setApplicationError(result.error);
      setApplicationMessage('');
      return;
    }
    setApplicationMessage('Application rejected.');
    setApplicationError('');
  };

  return (
    <AdminShell title="Website Access" subtitle="Roster members asking for a login">
      <>
      <div className="card p-6">

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-field-green" />
              <div>
                <h2 className="font-display font-bold text-xl">Member Access Requests</h2>
                <p className="text-sm text-ink-muted">Roster members asking for website login credentials.</p>
              </div>
            </div>
            <span className="text-xs font-display font-bold bg-field-green/10 text-field-green px-2 py-1 rounded-full shrink-0">
              {pendingPendingCount} pending
            </span>
          </div>

          {applicationMessage ? <p className="text-sm text-field-green mb-4">{applicationMessage}</p> : null}
          {applicationError ? <p className="text-sm text-red-600 mb-4">{applicationError}</p> : null}

          <div className="space-y-3">
            {pendingApplications.length === 0 ? (
              <div className="rounded-3xl bg-surface-muted p-6 text-center text-sm text-ink-muted">
                No membership access requests yet.
              </div>
            ) : (
              pendingApplications.map((application) => (
                <div key={application.id} className="rounded-3xl border border-black/10 bg-surface-card p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="font-display font-semibold text-ink">{application.name}</p>
                      <p className="text-xs text-ink-muted">
                        AMA #{application.amaNumber} · {application.email} · {application.phone}
                      </p>
                      <p className="text-xs text-ink-light mt-1">{application.address}</p>
                      {application.username ? (
                        <p className="text-xs text-ink-muted mt-1">
                          Requested username:{' '}
                          <span className="font-mono text-ink">{application.username}</span>
                        </p>
                      ) : null}
                    </div>
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold shrink-0 ${application.status === 'pending' ? 'bg-field-green/10 text-field-green' : 'bg-surface-muted text-ink-muted'}`}>
                      {application.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-ink-muted">{application.reason || 'No additional note provided.'}</p>
                  {application.status === 'pending' ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => handleApproveApplication(application.id)} className="btn-primary text-xs">
                        Approve
                      </button>
                      <button onClick={() => handleRejectApplication(application.id)} className="btn-secondary text-xs">
                        Reject
                      </button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      </>
    </AdminShell>
  );
}
