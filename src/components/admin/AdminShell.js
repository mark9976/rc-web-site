'use client';

import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { useAuth } from '@/components/AuthProvider';
import { ArrowLeft, Lock } from 'lucide-react';

/**
 * Wrapper for every admin sub-page: one place for the access gate and the way
 * back to the dashboard, so each section page only contains its own feature.
 */
export default function AdminShell({ title, subtitle, children }) {
  const auth = useAuth();

  if (!auth.authLoaded) {
    return (
      <PageShell title={title} subtitle={subtitle}>
        <p className="text-sm text-ink-muted">Checking your access…</p>
      </PageShell>
    );
  }

  if (!auth.isAdmin) {
    return (
      <PageShell title={title} subtitle={subtitle}>
        <div className="card p-6 flex items-start gap-3">
          <Lock className="w-5 h-5 text-flyday-maybe shrink-0 mt-0.5" />
          <div>
            <p className="font-display font-bold text-lg">Admin access required</p>
            <p className="text-sm text-ink-muted mt-1">
              Sign in with an admin account to view this page.{' '}
              <Link href="/login/" className="text-field-green font-semibold">Sign in</Link>
            </p>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title={title} subtitle={subtitle}>
      <Link href="/admin/" className="inline-flex items-center gap-2 text-sm text-field-green font-semibold mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </Link>
      {children}
    </PageShell>
  );
}
