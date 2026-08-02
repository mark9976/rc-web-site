'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import PageShell from '@/components/PageShell';
import { Lock, User, Key, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    const result = await auth.login(username.trim(), password);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.needsPasswordReset) {
      router.push('/reset-password/');
      return;
    }
    router.push('/');
  };

  return (
    <PageShell title="Member Login" subtitle="Sign in with your club account">
      <div className="max-w-xl mx-auto">
        <div className="card p-6 space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-ink-muted">
              Existing roster members may sign in here to access the admin area, event editor, classifieds posting, and member-only pages.
            </p>
            <p className="text-sm text-ink-muted">
              If you are a current member and do not yet have site access, submit a request on the Membership page.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-ink">Username</span>
              <div className="mt-2 flex items-center gap-3 rounded-3xl border border-black/10 bg-surface-card px-4 py-3">
                <User className="w-5 h-5 text-ink-muted" />
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full bg-transparent text-sm outline-none"
                  placeholder="Enter your username"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Password</span>
              <div className="mt-2 flex items-center gap-3 rounded-3xl border border-black/10 bg-surface-card px-4 py-3">
                <Key className="w-5 h-5 text-ink-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full bg-transparent text-sm outline-none"
                  placeholder="Enter your password"
                />
              </div>
            </label>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button type="submit" className="btn-primary w-full justify-center gap-2">
              <Lock className="w-4 h-4" /> Sign In
            </button>
          </form>

          <div className="border-t border-black/10 pt-4 text-sm text-ink-muted">
            <p className="mb-2">Need site access?</p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => router.push('/membership/')}
                className="btn-secondary text-xs"
              >
                Request Access
              </button>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="btn-secondary text-xs"
              >
                Back to Homepage
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
