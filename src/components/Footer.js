import Link from 'next/link';
import { Plane, Facebook, Youtube, Mail } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-field-darkgreen text-white/70 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Club info */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Plane className="w-6 h-6 text-white" />
              <span className="font-display font-bold text-white text-lg">LHMAC</span>
            </div>
            <p className="text-sm leading-relaxed">
              Laurel Highlands Model Airplane Club — AMA Club #557.
              Dedicated to good fellowship and the advancement of radio controlled flying models since 1964.
            </p>
          </div>

          {/* Flying field */}
          <div>
            <h4 className="font-display font-semibold text-white text-sm uppercase tracking-wider mb-4">
              Our Field
            </h4>
            <p className="text-sm leading-relaxed">
              Mammoth Park<br />
              Klaka Road<br />
              Mammoth, PA
            </p>
            <p className="text-sm mt-2">Open 10:00 AM – Dusk</p>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="font-display font-semibold text-white text-sm uppercase tracking-wider mb-4">
              Quick Links
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/membership/" className="hover:text-white transition-colors">Join the Club</Link></li>
              <li><Link href="/fields/" className="hover:text-white transition-colors">Field Rules</Link></li>
              <li><Link href="/events/" className="hover:text-white transition-colors">Events Calendar</Link></li>
              <li><Link href="/media/" className="hover:text-white transition-colors">Photo Gallery</Link></li>
              <li><Link href="/contact/" className="hover:text-white transition-colors">Contact Us</Link></li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h4 className="font-display font-semibold text-white text-sm uppercase tracking-wider mb-4">
              Connect
            </h4>
            <div className="flex gap-4">
              <a
                href="https://www.facebook.com/LaurelHighlandsModelAirplaneClub/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="w-6 h-6" />
              </a>
              <a
                href="https://www.youtube.com/user/LHMACRC"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
                aria-label="YouTube"
              >
                <Youtube className="w-6 h-6" />
              </a>
              <Link href="/contact/" className="hover:text-white transition-colors" aria-label="Email">
                <Mail className="w-6 h-6" />
              </Link>
            </div>
            <div className="mt-4 text-sm">
              <a
                href="https://www.modelaircraft.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                Academy of Model Aeronautics →
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 mt-8 pt-6 text-center text-xs text-white/40">
          © {new Date().getFullYear()} Laurel Highlands Model Airplane Club. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
