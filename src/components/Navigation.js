'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, Plane } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

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

  return (
    <nav className="bg-field-darkgreen sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <Plane className="w-8 h-8 text-white" />
            <div className="leading-tight">
              <span className="text-white font-display font-bold text-lg tracking-tight block">
                LHMAC
              </span>
              <span className="text-white/60 text-xs font-body hidden sm:block">
                Laurel Highlands Model Airplane Club
              </span>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="nav-link">
                {link.label}
              </Link>
            ))}
            {auth.isAdmin ? (
              <Link href="/admin/" className="nav-link text-flyday-maybe flex items-center gap-2">
                Admin
                {pendingRequestCount > 0 ? (
                  <span className="inline-flex items-center rounded-full bg-field-green text-white text-[10px] font-semibold px-2 py-0.5">
                    {pendingRequestCount}
                  </span>
                ) : null}
              </Link>
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
            className="lg:hidden text-white p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-field-darkgreen border-t border-white/10 pb-4">
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
