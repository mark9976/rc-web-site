import PageShell from '@/components/PageShell';
import FieldMap from '@/components/FieldMap';
import { FLYING_SITES } from '@/lib/clubConstants';
import { Clock, Compass, Shield, Waves, Plane } from 'lucide-react';

export const metadata = { title: 'Our Fields' };

const mammothAmenities = [
  'Asphalt runway', 'Grass runways', 'Grass pit area', 'Covered shelter / pavilion',
  'Setup tables & workbenches', 'Startup stands', 'Pilot bench seating',
  'Transmitter impound rack', 'Windsocks', 'Gated entrance',
  'Spectator area', 'Handicap accessible', 'Night flying capable', 'Porta-pots',
];

const aircraftTypes = [
  'Fixed Wing', 'Electric', 'Fuel / Gas', 'Giant Scale', 'Helicopters',
  'Park Flyers', '3-D', 'Ducted Fan / Jets', 'Pattern', 'Pylon Racing',
  'Rockets', 'Soaring', 'FPV',
];

export default function FieldsPage() {
  return (
    <PageShell title="Our Fields" subtitle="Two great locations to fly in Western Pennsylvania">

      {/* Mammoth Park — Primary Field */}
      <div className="card mb-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 bg-field-green/10 rounded-lg flex items-center justify-center shrink-0">
            <Plane className="w-6 h-6 text-field-green" />
          </div>
          <div>
            <h2 className="font-display font-bold text-2xl">Mammoth Park</h2>
            <p className="text-ink-muted">Primary Flying Field — Klaka Road, Mammoth, PA</p>
          </div>
        </div>

        <FieldMap site={FLYING_SITES.mammoth} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Hours & Info */}
          <div>
            <h3 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-field-green" /> Hours & Info
            </h3>
            <div className="space-y-2 text-sm text-ink-muted">
              <p><strong className="text-ink">Hours:</strong> 10:00 AM – Dusk daily</p>
              <p><strong className="text-ink">AMA Required:</strong> Current AMA membership mandatory</p>
              <p><strong className="text-ink">Guests:</strong> Guest pilots welcome with AMA card</p>
              <p><strong className="text-ink">Spectators:</strong> Always welcome</p>
            </div>
          </div>

          {/* Directions */}
          <div>
            <h3 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
              <Compass className="w-5 h-5 text-field-green" /> Getting There
            </h3>
            <p className="text-sm text-ink-muted leading-relaxed">
              The field is on Klaka Road in Mammoth, PA. Use <strong className="text-ink">Get Directions</strong>{' '}
              above the map for turn-by-turn navigation — on a phone it opens straight into your maps app.
            </p>
          </div>
        </div>

        {/* Amenities */}
        <div className="mt-8">
          <h3 className="font-display font-bold text-lg mb-3">Field Amenities</h3>
          <div className="flex flex-wrap gap-2">
            {mammothAmenities.map((item) => (
              <span key={item} className="text-xs bg-field-green/10 text-field-green px-3 py-1.5 rounded-full font-medium">
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Aircraft types */}
        <div className="mt-6">
          <h3 className="font-display font-bold text-lg mb-3">What We Fly</h3>
          <div className="flex flex-wrap gap-2">
            {aircraftTypes.map((item) => (
              <span key={item} className="text-xs bg-sky/10 text-sky-deep px-3 py-1.5 rounded-full font-medium">
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Field Rules */}
        <div className="mt-8 pt-6 border-t border-black/5">
          <h3 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
            <Shield className="w-5 h-5 text-field-green" /> Field Rules & Regulations
          </h3>
          <p className="text-sm text-ink-muted">
            Complete field rules and safety regulations will be displayed here. All pilots must read and follow these rules.
            A downloadable PDF version will also be available.
          </p>
        </div>
      </div>

      {/* Chestnut Ridge / Acme Dam — Float Fly */}
      <div className="card">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 bg-sky/10 rounded-lg flex items-center justify-center shrink-0">
            <Waves className="w-6 h-6 text-sky-deep" />
          </div>
          <div>
            <h2 className="font-display font-bold text-2xl">Chestnut Ridge Park — Acme Dam</h2>
            <p className="text-ink-muted">Float Fly Site</p>
          </div>
        </div>

        <FieldMap site={FLYING_SITES.acmeDam} />

        <p className="text-ink-muted leading-relaxed">
          Our float fly events take place at Acme Dam in Chestnut Ridge Park. These events are open to
          anyone with a current AMA membership. Check the events calendar for scheduled float fly dates.
        </p>
      </div>
    </PageShell>
  );
}
