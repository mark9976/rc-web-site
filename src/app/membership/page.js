'use client';

import { useState } from 'react';
import PageShell from '@/components/PageShell';
import { useAuth } from '@/components/AuthProvider';
import LessonRequestForm from './LessonRequestForm';
import { UserPlus, GraduationCap, ShieldCheck, Mail, Home, CalendarDays, ExternalLink } from 'lucide-react';

const initialForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
  amaNumber: '',
  reason: '',
};

export default function MembershipPage() {
  const auth = useAuth();
  const [form, setForm] = useState(initialForm);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!form.name || !form.phone || !form.email || !form.address || !form.amaNumber) {
      setError('Please complete all required fields before requesting access.');
      return;
    }

    const result = await auth.submitMemberApplication(form);
    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess('Your access request has been submitted. An admin will review it and create your login.');
    setForm(initialForm);
  };

  return (
    <PageShell title="Membership" subtitle="Request site access for current roster members">
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] mb-8">
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <UserPlus className="w-6 h-6 text-field-green" />
            <h2 className="section-heading">Existing Member Access Request</h2>
          </div>
          <p className="text-sm text-ink-muted leading-relaxed mb-6">
            If you are already a club member, submit your request to receive a site username and password. The admin will verify roster membership before approving access.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-ink">Full Name</span>
                <input
                  value={form.name}
                  onChange={handleChange('name')}
                  className="mt-2 w-full rounded-3xl border border-black/10 bg-surface-card px-4 py-3 text-sm outline-none focus:border-field-green focus:ring-2 focus:ring-field-green/10"
                  placeholder="Jane Doe"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink">Phone</span>
                <input
                  value={form.phone}
                  onChange={handleChange('phone')}
                  className="mt-2 w-full rounded-3xl border border-black/10 bg-surface-card px-4 py-3 text-sm outline-none focus:border-field-green focus:ring-2 focus:ring-field-green/10"
                  placeholder="(555) 123-4567"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-ink">Email</span>
                <input
                  value={form.email}
                  onChange={handleChange('email')}
                  className="mt-2 w-full rounded-3xl border border-black/10 bg-surface-card px-4 py-3 text-sm outline-none focus:border-field-green focus:ring-2 focus:ring-field-green/10"
                  placeholder="name@example.com"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink">AMA Number</span>
                <input
                  value={form.amaNumber}
                  onChange={handleChange('amaNumber')}
                  className="mt-2 w-full rounded-3xl border border-black/10 bg-surface-card px-4 py-3 text-sm outline-none focus:border-field-green focus:ring-2 focus:ring-field-green/10"
                  placeholder="1234567"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-ink">Address</span>
              <input
                value={form.address}
                onChange={handleChange('address')}
                className="mt-2 w-full rounded-3xl border border-black/10 bg-surface-card px-4 py-3 text-sm outline-none focus:border-field-green focus:ring-2 focus:ring-field-green/10"
                placeholder="123 Main St, Greensburg, PA 15601"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-ink">Membership verification note</span>
              <textarea
                value={form.reason}
                onChange={handleChange('reason')}
                rows={4}
                className="mt-2 w-full rounded-3xl border border-black/10 bg-surface-card px-4 py-3 text-sm outline-none focus:border-field-green focus:ring-2 focus:ring-field-green/10"
                placeholder="Optional note for the admin reviewer"
              />
            </label>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {success ? <p className="text-sm text-field-green">{success}</p> : null}

            <button type="submit" className="btn-primary w-full justify-center gap-2">
              <Mail className="w-4 h-4" /> Submit Request
            </button>
          </form>
        </div>

        <aside className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck className="w-6 h-6 text-sky-deep" />
            <h3 className="font-display font-bold text-lg">Access Request Status</h3>
          </div>
          <p className="text-sm text-ink-muted leading-relaxed mb-4">
            Only verified LHMAC roster members are approved for site access. Admins will review your request and send your username/password once approved.
          </p>
          <div className="rounded-3xl bg-surface-muted p-4">
            <div className="flex items-center gap-3 text-sm font-medium text-ink mb-3">
              <CalendarDays className="w-4 h-4 text-field-green" /> What happens next
            </div>
            <ol className="space-y-2 text-xs text-ink-muted list-decimal list-inside">
              <li>An admin checks your name against the club roster.</li>
              <li>Once approved, you receive a username and a temporary password.</li>
              <li>You choose your own password the first time you sign in.</li>
            </ol>
          </div>
          <div className="mt-6 rounded-3xl bg-surface-card p-4 text-sm text-ink-muted">
            <p className="font-semibold mb-2">Already have credentials?</p>
            <p>Sign in through the login page to access member-only features and the event editor.</p>
          </div>
        </aside>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Home className="w-5 h-5 text-field-green" />
          <h3 className="font-display font-bold text-lg">Member Login</h3>
        </div>
        <p className="text-sm text-ink-muted leading-relaxed">
          If you already have a username and password, use the login page to sign in instead of submitting a new request.
        </p>
      </div>

      <div className="card mt-8">
        <div className="flex items-center gap-3 mb-4">
          <GraduationCap className="w-6 h-6 text-field-green" />
          <h2 className="section-heading">Request Flying Lessons</h2>
        </div>
        <p className="text-ink-muted leading-relaxed mb-6">
          Free flying instruction is available to club members. Tell us a little about yourself and pick an
          instructor — or leave it open and whoever is available will get in touch.
        </p>
        <LessonRequestForm />
      </div>

      <div className="card mt-8">
        <div className="flex items-center gap-3 mb-4">
          <ShieldCheck className="w-6 h-6 text-sky-deep" />
          <h2 className="section-heading">FAA & Safety Requirements</h2>
        </div>
        <p className="text-ink-muted leading-relaxed mb-6">
          All RC pilots must complete the FAA Recreational UAS Safety Test (TRUST) and register their aircraft.
          Here&apos;s everything you need to get legal:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'Take the TRUST Exam',             href: 'https://trust.modelaircraft.org/', desc: 'AMA\'s free TRUST test — takes 30 minutes' },
            { label: 'Register Your Aircraft (FAA)',     href: 'https://registermyuas.faa.gov/',   desc: 'FAA sUAS registration — $5 for 3 years' },
            { label: 'TRUST Exam FAQ',                   href: 'https://www.faa.gov/uas/recreational_fliers/knowledge_test_updates/', desc: 'What to expect from the exam' },
            { label: 'AMA Membership',                   href: 'https://www.modelaircraft.org/',   desc: 'Join AMA for insurance and community' },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="card hover:shadow-md hover:border-sky/30 transition-all group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display font-bold text-sm text-ink group-hover:text-sky-deep transition-colors">
                    {link.label}
                  </h3>
                  <p className="text-xs text-ink-muted mt-1">{link.desc}</p>
                </div>
                <ExternalLink className="w-4 h-4 text-ink-light shrink-0 mt-0.5" />
              </div>
            </a>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
