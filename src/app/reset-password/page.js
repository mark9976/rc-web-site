'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import PageShell from '@/components/PageShell';
import { Key, Lock, ArrowRight } from 'lucide-react';

export default function ResetPasswordPage() {
  const auth = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!password || !confirmPassword) {
      setError('Enter and confirm your new password.');
      return;
    }

    if (password.length < 8) {
      setError('Choose a password of at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const result = await auth.resetPassword(password);
    if (result.error) {
      setError(result.error);
      return;
    }

    // The reset also signs you in, so go to the site rather than back to login.
    setMessage('Password saved. You are now signed in — taking you to the homepage...');
    setTimeout(() => {
      router.push('/');
    }, 1000);
  };

  return (
    <PageShell title="Reset Password" subtitle="Set a new password for your account">
      <div className="max-w-xl mx-auto">
        <div className="card p-6 space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-ink-muted">
              Use this page to create a new password when your account has been approved and requires a reset.
            </p>
            {auth.authLoaded && !auth.pendingReset ? (
              <p className="rounded-3xl bg-flyday-maybe/10 border border-flyday-maybe/30 p-3 text-sm text-flyday-maybe">
                No password reset is in progress. Sign in first and you will be sent here if a reset is required.
              </p>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-ink">New Password</span>
              <div className="mt-2 flex items-center gap-3 rounded-3xl border border-black/10 bg-surface-card px-4 py-3">
                <Lock className="w-5 h-5 text-ink-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full bg-transparent text-sm outline-none"
                  placeholder="Enter a new password"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Confirm Password</span>
              <div className="mt-2 flex items-center gap-3 rounded-3xl border border-black/10 bg-surface-card px-4 py-3">
                <Key className="w-5 h-5 text-ink-muted" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full bg-transparent text-sm outline-none"
                  placeholder="Confirm your new password"
                />
              </div>
            </label>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {message ? <p className="text-sm text-field-green">{message}</p> : null}
            <button type="submit" className="btn-primary w-full justify-center gap-2">
              <Lock className="w-4 h-4" /> Save Password
            </button>
          </form>

          <button
            type="button"
            onClick={() => router.push('/login/')}
            className="btn-secondary w-full text-xs"
          >
            Back to Login
          </button>
        </div>
      </div>
    </PageShell>
  );
}
