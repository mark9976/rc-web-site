import PageShell from '@/components/PageShell';
import { ExternalLink } from 'lucide-react';

export const metadata = { title: 'Links & Resources' };

const linkGroups = [
  {
    category: 'Official & Regulatory',
    links: [
      { label: 'Academy of Model Aeronautics (AMA)', href: 'https://www.modelaircraft.org/' },
      { label: 'FAA UAS Registration', href: 'https://registermyuas.faa.gov/' },
      { label: 'TRUST Exam (AMA)', href: 'https://trust.modelaircraft.org/' },
      { label: 'Know Before You Fly', href: 'https://knowbeforeyoufly.org/' },
      { label: 'FAA Recreational Flyers', href: 'https://www.faa.gov/uas/recreational_fliers/' },
    ],
  },
  {
    category: 'Nearby Clubs',
    links: [
      { label: 'Links to neighboring AMA clubs will be listed here', href: '#' },
    ],
  },
  {
    category: 'Hobby Shops & Vendors',
    links: [
      { label: 'Local and online hobby shops supporting the RC community', href: '#' },
    ],
  },
  {
    category: 'Learning & Community',
    links: [
      { label: 'RC Groups Forum', href: 'https://www.rcgroups.com/' },
      { label: 'Flite Test', href: 'https://www.flitetest.com/' },
    ],
  },
];

export default function LinksPage() {
  return (
    <PageShell title="Links & Resources" subtitle="Useful resources for RC pilots">
      <div className="space-y-8">
        {linkGroups.map((group) => (
          <div key={group.category} className="card">
            <h2 className="font-display font-bold text-lg mb-4">{group.category}</h2>
            <div className="space-y-2">
              {group.links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target={link.href !== '#' ? '_blank' : undefined}
                  rel={link.href !== '#' ? 'noopener noreferrer' : undefined}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-muted transition-colors group"
                >
                  <span className="text-sm text-ink group-hover:text-field-green transition-colors">{link.label}</span>
                  {link.href !== '#' && <ExternalLink className="w-4 h-4 text-ink-light shrink-0" />}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
