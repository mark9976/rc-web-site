import PageShell from '@/components/PageShell';
import Link from 'next/link';
import { Users, Award, History, BookOpen } from 'lucide-react';
import { getOfficers } from '@/lib/photoStorage';

export const metadata = { title: 'About Us' };

// Rendered per request so officer changes show up without a rebuild.
export const dynamic = 'force-dynamic';

const sections = [
  {
    icon: Users,
    title: 'Who We Are',
    content: `We are a group of approximately 120 members dedicated to good fellowship and the advancement of the hobby of radio controlled flying models — building and flying. New members are always welcome.`,
  },
  {
    icon: History,
    title: 'Club History',
    content: `Founded in 1964, the Laurel Highlands Model Airplane Club has been serving the RC flying community in Western Pennsylvania for over 60 years. From humble beginnings to our current home at Mammoth Park, our club has grown into one of the region's most active AMA-chartered organizations.`,
  },
  {
    icon: Award,
    title: 'AMA Charter',
    content: `LHMAC is AMA Club #557, chartered by the Academy of Model Aeronautics. All members must hold a current AMA membership to fly at our field.`,
  },
];

export default function AboutPage() {
  const officers = getOfficers();

  return (
    <PageShell title="About Us" subtitle="Laurel Highlands Model Airplane Club — AMA #557">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.title} className="card">
              <Icon className="w-8 h-8 text-field-green mb-4" />
              <h2 className="font-display font-bold text-xl mb-3">{s.title}</h2>
              <p className="text-ink-muted leading-relaxed">{s.content}</p>
            </div>
          );
        })}
      </div>

      {/* Club Officers — assigned from the admin dashboard's member roster */}
      <div className="card mb-8">
        <h2 className="section-heading mb-4">Club Officers</h2>
        {officers.length === 0 ? (
          <p className="text-ink-muted">
            Officers have not been listed yet. An admin can assign officer titles from the member roster on the
            admin dashboard.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {officers.map((officer) => (
              <div key={`${officer.officerTitle}-${officer.name}`} className="bg-surface-muted rounded-lg p-4 text-center">
                <div className="w-16 h-16 bg-field-green/10 rounded-full mx-auto mb-3 flex items-center justify-center">
                  <Users className="w-8 h-8 text-field-green/40" />
                </div>
                <p className="font-display font-bold text-sm uppercase tracking-wider text-ink-muted">
                  {officer.officerTitle}
                </p>
                <p className="text-sm text-ink mt-1">{officer.name}</p>
                {officer.email ? (
                  <a href={`mailto:${officer.email}`} className="text-xs text-field-green hover:text-field-darkgreen break-all">
                    {officer.email}
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Constitution / Bylaws placeholder */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <BookOpen className="w-6 h-6 text-field-green" />
          <h2 className="section-heading">Constitution & Bylaws</h2>
        </div>
        <p className="text-ink-muted">Club constitution and bylaws documents will be available here for members to review.</p>
      </div>
    </PageShell>
  );
}
