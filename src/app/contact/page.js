import PageShell from '@/components/PageShell';
import ContactForm from './ContactForm';
import { Mail, MapPin, Facebook, Youtube } from 'lucide-react';

export const metadata = { title: 'Contact' };

export default function ContactPage() {
  return (
    <PageShell title="Contact Us" subtitle="Get in touch with the Laurel Highlands Model Airplane Club">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Contact form */}
        <div className="card">
          <h2 className="font-display font-bold text-xl mb-6">Send Us a Message</h2>
          <ContactForm />
        </div>

        {/* Club info sidebar */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="font-display font-bold text-xl mb-4">Find Us</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-field-green shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Mammoth Park Flying Field</p>
                  <p className="text-sm text-ink-muted">Klaka Road, Mammoth, PA</p>
                  <a
                    href="https://maps.google.com/maps?q=40.213889,-79.462197"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-field-green hover:text-field-darkgreen font-medium mt-1 inline-block"
                  >
                    Get Directions →
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-field-green shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Email</p>
                  <p className="text-sm text-ink-muted">Club email will be configured here</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="font-display font-bold text-xl mb-4">Social Media</h2>
            <div className="space-y-3">
              <a
                href="https://www.facebook.com/LaurelHighlandsModelAirplaneClub/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-muted transition-colors group"
              >
                <Facebook className="w-6 h-6 text-[#1877F2]" />
                <div>
                  <p className="text-sm font-medium group-hover:text-field-green transition-colors">Facebook</p>
                  <p className="text-xs text-ink-muted">Follow us for updates and photos</p>
                </div>
              </a>
              <a
                href="https://www.youtube.com/user/LHMACRC"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-muted transition-colors group"
              >
                <Youtube className="w-6 h-6 text-[#FF0000]" />
                <div>
                  <p className="text-sm font-medium group-hover:text-field-green transition-colors">YouTube</p>
                  <p className="text-xs text-ink-muted">Watch club videos and flight footage</p>
                </div>
              </a>
            </div>
          </div>

          <div className="card">
            <h2 className="font-display font-bold text-xl mb-4">Monthly Meetings</h2>
            <p className="text-sm text-ink-muted leading-relaxed">
              Regular club meetings are held on the first Saturday of each month at 12 noon.
              Check the events calendar for location and any schedule changes.
            </p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
