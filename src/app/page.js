'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plane, CalendarDays, Users, Newspaper, ShieldCheck, ArrowRight } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import FlyDayForecast from '@/components/FlyDayForecast';
import PhotoStrip from '@/components/PhotoStrip';
import FieldStatus from '@/components/FieldStatus';
import { normalizeDateString, parseDateString } from '@/lib/dateUtils';

const quickLinks = [
  { href: '/membership/', label: 'Join the Club',        icon: Users,       desc: 'Membership info and application' },
  { href: '/fields/',     label: 'Our Field',            icon: Plane,       desc: 'Location, rules, and amenities' },
  { href: '/events/',     label: 'Events Calendar',      icon: CalendarDays, desc: 'Upcoming fly-ins, meetings, and more' },
  { href: '/media/',      label: 'Newsletter',           icon: Newspaper,   desc: 'Latest club newsletter' },
];

export default function HomePage() {
  const auth = useAuth();
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [heroImage, setHeroImage] = useState(null);

  useEffect(() => {
    // Only render the banner if an admin has actually set one, so visitors never
    // see a broken image placeholder.
    const loadHeroImage = async () => {
      try {
        const res = await fetch('/api/site-images', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        setHeroImage(data.images?.hero ?? null);
      } catch {
        setHeroImage(null);
      }
    };

    loadHeroImage();
  }, []);

  useEffect(() => {
    const loadUpcomingEvents = async () => {
      try {
        const res = await fetch('/api/events');
        if (!res.ok) throw new Error('Unable to load upcoming events.');
        const data = await res.json();
        const events = Array.isArray(data.events) ? data.events : [];
        const sortedEvents = events
          .filter((event) => event.date)
          .sort((a, b) => normalizeDateString(a.date).localeCompare(normalizeDateString(b.date)))
          .slice(0, 4);
        setUpcomingEvents(sortedEvents);
      } catch {
        setUpcomingEvents([]);
      }
    };

    loadUpcomingEvents();
  }, []);

  return (
      <div>
      {/* ─── Hero ─── */}
      <section className="relative bg-field-darkgreen overflow-hidden">
        {/* Placeholder hero — replace with rotating club photos */}
        <div className="absolute inset-0 bg-gradient-to-br from-field-darkgreen via-field-green/80 to-sky-deep/60" />
        <div className="relative max-w-7xl mx-auto px-4 py-20 sm:py-28 text-center">
          {heroImage ? (
            <img
              src={`/api/site-images/hero?v=${encodeURIComponent(heroImage.updatedAt)}`}
              alt="Laurel Highlands Model Airplane Club"
              className="mx-auto mb-8 w-full max-w-3xl rounded-2xl border-4 border-white/80 shadow-2xl"
            />
          ) : (
            <Plane className="w-16 h-16 text-white/30 mx-auto mb-6" />
          )}
          <h1 className="font-display text-5xl sm:text-6xl font-bold text-white tracking-tight">
            Come, Fly with Us!
          </h1>
          <p className="mt-4 text-xl text-white/70 font-body max-w-2xl mx-auto">
            Laurel Highlands Model Airplane Club — AMA #557.
            RC flying at Mammoth Park since 1964.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            {/* Straight to the form: someone who has decided to join should not
                have to find it. "Join the Club" still leads to the overview. */}
            <Link href="/membership/apply/" className="btn-primary bg-white text-field-darkgreen hover:bg-white/90">
              Membership Application
            </Link>
            <Link href="/membership/" className="btn-secondary border-white text-white hover:bg-white hover:text-field-darkgreen">
              Join the Club
            </Link>
            <Link href="/fields/" className="btn-secondary border-white text-white hover:bg-white hover:text-field-darkgreen">
              Visit Our Field
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Field Status Bar ─── */}
      <div className="max-w-7xl mx-auto px-4 -mt-6 relative z-10">
        <FieldStatus />
      </div>

      {/* ─── Fly Day Forecast ─── */}
      <div className="max-w-7xl mx-auto px-4 mt-8">
        <FlyDayForecast />
      </div>

      {/* ─── Photo Strip ─── */}
      <div className="max-w-7xl mx-auto px-4 mt-12">
        <PhotoStrip />
      </div>

      {/* ─── Upcoming Events ─── */}
      <div className="max-w-7xl mx-auto px-4 mt-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-heading flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-field-green" />
            Upcoming Events
          </h2>
          <Link href="/events/" className="text-sm font-display font-semibold text-field-green hover:text-field-darkgreen uppercase tracking-wider">
            Full Calendar →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {upcomingEvents.length > 0 ? (
            upcomingEvents.map((event) => (
              <div key={event.id} className="card hover:shadow-md transition-shadow cursor-pointer group">
                <span className="inline-block text-xs font-display font-bold uppercase tracking-wider text-field-green bg-field-green/10 px-2 py-1 rounded mb-3">
                  {event.type}
                </span>
                <h3 className="font-display font-bold text-lg text-ink group-hover:text-field-green transition-colors">
                  {event.title}
                </h3>
                <p className="text-sm text-ink-muted mt-1">
                  {parseDateString(event.date)?.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' }) || event.date} · {event.time}
                </p>
                <p className="text-sm text-ink-muted">{event.location}</p>
              </div>
            ))
          ) : (
            <div className="card col-span-full p-6 text-sm text-ink-muted">
              No upcoming events are available right now.
            </div>
          )}
        </div>
      </div>

      {/* ─── Quick Links ─── */}
      <div className="max-w-7xl mx-auto px-4 mt-12 mb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href} className="card group hover:shadow-md hover:border-field-green/30 transition-all">
                <Icon className="w-8 h-8 text-field-green mb-3" />
                <h3 className="font-display font-bold text-ink group-hover:text-field-green transition-colors flex items-center gap-2">
                  {link.label}
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-sm text-ink-muted mt-1">{link.desc}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ─── Safety / FAA Banner ─── */}
      <div className="bg-surface-muted border-t border-black/5">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <ShieldCheck className="w-10 h-10 text-sky-deep shrink-0" />
            <div>
              <h3 className="font-display font-bold text-lg text-ink">Fly Safe, Fly Legal</h3>
              <p className="text-sm text-ink-muted mt-1">
                All pilots must have a current AMA membership and pass the FAA TRUST exam.
                New to RC flying? We offer free flying lessons.
              </p>
            </div>
            <div className="flex gap-3 sm:ml-auto shrink-0">
              <a
                href="https://trust.modelaircraft.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary text-xs"
              >
                Take TRUST Exam
              </a>
              <Link href="/membership/" className="btn-primary text-xs">
                Flying Lessons
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
