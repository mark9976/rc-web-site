'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { useAuth } from '@/components/AuthProvider';
import {
  ClipboardList, UserPlus, Users, Camera, Mail, Radio, CalendarDays, Newspaper,
  GraduationCap, Image as ImageIcon, BarChart3, Send, Lock,
} from 'lucide-react';

/**
 * Dashboard sections. `badge` names a count from /api/admin/summary so a tile
 * can show what is waiting without opening it.
 */
const TILES = [
  {
    href: '/admin/membership-applications/',
    label: 'Membership Applications',
    description: 'New and renewing members, dues owed, and the signed waiver.',
    icon: ClipboardList,
    badge: 'newClubApplications',
  },
  {
    href: '/admin/access-requests/',
    label: 'Website Access',
    description: 'Roster members asking for a login.',
    icon: UserPlus,
    badge: 'pendingApplications',
  },
  {
    href: '/admin/members/',
    label: 'Members',
    description: 'Roster, roles, officers, instructors and password resets.',
    icon: Users,
    badge: 'members',
    badgeTone: 'muted',
  },
  {
    href: '/admin/photos/',
    label: 'Photos',
    description: 'Approve submissions and manage the public gallery.',
    icon: Camera,
    badge: 'photoQueue',
  },
  {
    href: '/admin/inbox/',
    label: 'Inbox',
    description: 'Messages from the contact form.',
    icon: Mail,
    badge: 'unreadMessages',
  },
  {
    href: '/admin/field/',
    label: 'Field Status',
    description: 'Open, closed or maintenance, plus scheduled closures.',
    icon: Radio,
  },
  {
    href: '/admin/field-stats/',
    label: 'Field Activity',
    description: 'Check-in statistics and busiest times.',
    icon: BarChart3,
  },
  {
    href: '/admin/events/',
    label: 'Event Types',
    description: 'The categories offered when adding an event.',
    icon: CalendarDays,
  },
  {
    href: '/admin/newsletters/',
    label: 'Newsletters',
    description: 'Upload and manage PDF issues.',
    icon: Newspaper,
  },
  {
    href: '/admin/lessons/',
    label: 'Lesson Requests',
    description: 'Flight instruction enquiries.',
    icon: GraduationCap,
    badge: 'newLessonRequests',
  },
  {
    href: '/admin/appearance/',
    label: 'Logo & Images',
    description: 'Club logo and the homepage header image.',
    icon: ImageIcon,
  },
  {
    href: '/admin/member-email/',
    label: 'New Member Emails',
    description: 'Which mailbox sends login details, and a test send.',
    icon: Send,
  },
];

export default function AdminPage() {
  const auth = useAuth();
  const [counts, setCounts] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/summary', { cache: 'no-store' });
      if (res.ok) setCounts((await res.json()).counts ?? null);
    } catch {
      // Tiles render without badges if the summary is unavailable.
    }
  }, []);

  useEffect(() => {
    if (auth.isAdmin) load();
  }, [auth.isAdmin, load]);

  if (!auth.authLoaded) {
    return (
      <PageShell title="Admin Dashboard" subtitle="Manage LHMAC site content and members">
        <p className="text-sm text-ink-muted">Checking your access…</p>
      </PageShell>
    );
  }

  if (!auth.isAdmin) {
    return (
      <PageShell title="Admin Dashboard" subtitle="Manage LHMAC site content and members">
        <div className="card p-6 flex items-start gap-3">
          <Lock className="w-5 h-5 text-flyday-maybe shrink-0 mt-0.5" />
          <div>
            <p className="font-display font-bold text-lg">Admin access required</p>
            <p className="text-sm text-ink-muted mt-1">
              Sign in with an admin account.{' '}
              <Link href="/login/" className="text-field-green font-semibold">Sign in</Link>
            </p>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Admin Dashboard" subtitle={`Signed in as ${auth.currentUser?.name}`}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map(({ href, label, description, icon: Icon, badge, badgeTone }) => {
          const count = badge ? counts?.[badge] ?? 0 : 0;
          // Only an actionable queue gets the attention-coloured badge; a plain
          // total (like member count) stays muted so it does not read as a task.
          const isAction = Boolean(badge) && count > 0 && badgeTone !== 'muted';
          return (
            <Link
              key={href}
              href={href}
              className="card p-5 transition-shadow hover:shadow-md group flex flex-col"
            >
              <div className="flex items-start justify-between gap-3">
                <Icon className="w-7 h-7 text-field-green shrink-0" />
                {badge && count > 0 ? (
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-display font-bold ${
                      isAction ? 'bg-flyday-maybe text-white' : 'bg-surface-muted text-ink-muted'
                    }`}
                  >
                    {count}
                  </span>
                ) : null}
              </div>
              <h2 className="font-display font-bold text-lg mt-3 group-hover:text-field-green transition-colors">
                {label}
              </h2>
              <p className="text-sm text-ink-muted mt-1">{description}</p>
            </Link>
          );
        })}
      </div>
    </PageShell>
  );
}
