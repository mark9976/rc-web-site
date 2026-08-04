'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

const UNREAD_POLL_MS = 60000;

/** Total unread across every mailbox, refreshed without a page reload. */
function useUnreadEmailCount(enabled) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setUnread(0);
      return undefined;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/email/unread-count', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setUnread(data.unread || 0);
      } catch {
        // A failed poll just leaves the previous count in place.
      }
    };

    load();
    const timer = window.setInterval(load, UNREAD_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled]);

  return unread;
}

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/about/', label: 'About' },
  { href: '/fields/', label: 'Our Fields' },
  { href: '/membership/', label: 'Membership' },
  { href: '/events/', label: 'Events' },
  { href: '/media/', label: 'Media' },
  { href: '/classifieds/', label: 'Classifieds' },
  { href: '/links/', label: 'Links' },
  { href: '/contact/', label: 'Contact' },
];

export default function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const auth = useAuth();
  const pendingRequestCount = auth.pendingApplications?.filter((application) => application.status === 'pending').length || 0;
  const unreadEmail = useUnreadEmailCount(auth.isAdmin);

  return (
    <nav className="bg-field-darkgreen sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 shrink-0">
            {/* Served from the database rather than the static file, so the
                site shows the same crest the iOS app fetches and an admin can
                replace both at once. Sized by height so the portrait artwork
                keeps its aspect ratio in the 64px bar. */}
            <img
              src="/api/site-images/logo"
              alt="Laurel Highlands Model Airplane Club"
              width={117}
              height={144}
              className="h-11 w-auto shrink-0"
            />
            <div className="leading-tight">
              <span className="text-white font-display font-bold text-lg tracking-tight block">
                LHMAC
              </span>
              <span className="text-white/60 text-xs font-body hidden sm:block">
                Laurel Highlands Model Airplane Club
              </span>
            </div>
          </Link>

          {/* Desktop nav — full bar only from xl up; twelve tabs are too many
              to fit at lg without wrapping, so those widths get the menu. */}
          <div className="hidden xl:flex items-center gap-3 2xl:gap-5">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="nav-link">
                {link.label}
              </Link>
            ))}
            {auth.isAdmin ? (
              <>
                <Link href="/admin/" className="nav-link text-flyday-maybe flex items-center gap-2">
                  Admin
                  {pendingRequestCount > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-field-green text-white text-[10px] font-semibold px-2 py-0.5">
                      {pendingRequestCount}
                    </span>
                  ) : null}
                </Link>
                <Link href="/admin/email/" className="nav-link text-flyday-maybe flex items-center gap-2 whitespace-nowrap">
                  Admin Email
                  {unreadEmail > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-sky-deep text-white text-[10px] font-semibold px-2 py-0.5">
                      {unreadEmail}
                    </span>
                  ) : null}
                </Link>
              </>
            ) : null}
            {auth.isAuthenticated ? (
              <button
                type="button"
                onClick={auth.logout}
                className="nav-link"
              >
                Logout
              </button>
            ) : (
              <Link href="/login/" className="nav-link">
                Login
              </Link>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className="xl:hidden text-white p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="xl:hidden bg-field-darkgreen border-t border-white/10 pb-4">
          <div className="px-4 pt-2 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block py-2 px-3 text-white/80 hover:text-white hover:bg-white/10 rounded-lg text-sm font-medium"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {auth.isAdmin ? (
              <>
                <Link
                  href="/admin/"
                  className="block py-2 px-3 text-flyday-maybe hover:bg-white/10 rounded-lg text-sm font-medium"
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="flex items-center gap-2">
                    Admin Dashboard
                    {pendingRequestCount > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-field-green text-white text-[10px] font-semibold px-2 py-0.5">
                        {pendingRequestCount}
                      </span>
                    ) : null}
                  </span>
                </Link>
                <Link
                  href="/admin/email/"
                  className="block py-2 px-3 text-flyday-maybe hover:bg-white/10 rounded-lg text-sm font-medium"
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="flex items-center gap-2">
                    Admin Email
                    {unreadEmail > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-sky-deep text-white text-[10px] font-semibold px-2 py-0.5">
                        {unreadEmail}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </>
            ) : null}
            {auth.isAuthenticated ? (
              <button
                type="button"
                onClick={() => {
                  auth.logout();
                  setMobileOpen(false);
                }}
                className="w-full text-left py-2 px-3 text-white/80 hover:text-white hover:bg-white/10 rounded-lg text-sm font-medium"
              >
                Logout
              </button>
            ) : (
              <Link
                href="/login/"
                className="block py-2 px-3 text-white/80 hover:text-white hover:bg-white/10 rounded-lg text-sm font-medium"
                onClick={() => setMobileOpen(false)}
              >
                Login
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
