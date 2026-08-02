'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import PageShell from '@/components/PageShell';
import { Lock, Inbox, Users, UsersRound, Megaphone, FileText, PenLine, Settings } from 'lucide-react';

const TABS = [
  { href: '/admin/email/', label: 'Mail', icon: Inbox, exact: true },
  { href: '/admin/email/contacts/', label: 'Contacts', icon: Users },
  { href: '/admin/email/groups/', label: 'Groups', icon: UsersRound },
  { href: '/admin/email/blasts/', label: 'Blasts', icon: Megaphone },
  { href: '/admin/email/templates/', label: 'Templates', icon: FileText },
  { href: '/admin/email/signatures/', label: 'Signatures', icon: PenLine },
  { href: '/admin/email/settings/', label: 'Settings', icon: Settings },
];

/**
 * Gate plus sub-navigation for every email screen.
 * The APIs refuse non-admins regardless; this keeps the UI from rendering
 * empty panels to someone who cannot use them.
 */
export default function EmailShell({ title, subtitle, children }) {
  const auth = useAuth();
  const pathname = usePathname();

  if (!auth.authLoaded) {
    return (
      <PageShell title="Admin Email" subtitle="Club mailboxes">
        <p className="text-sm text-ink-muted">Checking your access…</p>
      </PageShell>
    );
  }

  if (!auth.isAdmin) {
    return (
      <PageShell title="Admin Email" subtitle="Club mailboxes">
        <div className="max-w-xl mx-auto card p-8 text-center">
          <Lock className="w-10 h-10 text-flyday-maybe mx-auto mb-4" />
          <h2 className="font-display font-bold text-xl mb-2">Admin access required</h2>
          <p className="text-sm text-ink-muted mb-6">
            {auth.isAuthenticated
              ? 'Your account does not have admin permissions.'
              : 'Sign in with an admin account to read and send club email.'}
          </p>
          <Link href={auth.isAuthenticated ? '/' : '/login/'} className="btn-primary">
            {auth.isAuthenticated ? 'Back to Homepage' : 'Go to Login'}
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title={title || 'Admin Email'} subtitle={subtitle}>
      <nav className="mb-6 flex flex-wrap gap-2 border-b border-black/10 pb-3">
        {TABS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                active ? 'bg-field-green text-white' : 'text-ink-muted hover:bg-surface-muted'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </Link>
          );
        })}
      </nav>
      {children}
    </PageShell>
  );
}
