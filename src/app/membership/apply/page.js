'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { readError } from '@/lib/apiClient';
import {
  MEMBERSHIP_CLASSES,
  FAMILY_ADD_ON,
  LATE_FEE,
  CLUB_TREASURER,
  ACCEPTANCE_STATEMENT,
} from '@/lib/clubConstants';
import { CheckCircle2, Mail, Plane } from 'lucide-react';

const field =
  'mt-2 w-full rounded-3xl border border-black/10 bg-surface-card px-4 py-3 text-sm outline-none focus:border-field-green focus:ring-2 focus:ring-field-green/10';

const emptyFamilyMember = { name: '', dob: '', amaNumber: '', email: '' };

const emptyForm = {
  applicationType: 'new',
  name: '', amaNumber: '', faaNumber: '',
  address: '', city: '', state: '', zip: '',
  homePhone: '', mobilePhone: '', email: '', dateOfBirth: '',
  emergencyName: '', emergencyPhone: '',
  membershipClass: 'regular',
  includesFamily: false,
  lateFee: false,
  signature: '', guardianSignature: '',
  agreed: false,
};

function Label({ children, hint, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium text-ink">{children}</span>
      {hint ? <span className="ml-1 text-xs text-ink-light">{hint}</span> : null}
    </label>
  );
}

export default function MembershipApplicationPage() {
  const [form, setForm] = useState(emptyForm);
  const [family, setFamily] = useState([{ ...emptyFamilyMember }]);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setFamilyField = (index, key) => (event) => {
    setFamily((prev) => prev.map((member, i) => (i === index ? { ...member, [key]: event.target.value } : member)));
  };

  // Mirrors the server's calculation; the server recomputes it on submit so the
  // figure shown here can never become the figure that is owed.
  const dues = useMemo(() => {
    const base = MEMBERSHIP_CLASSES.find((option) => option.value === form.membershipClass);
    const lines = [];
    if (base) lines.push({ label: base.label, amount: base.amount });
    if (form.includesFamily) lines.push({ label: 'Family — spouse & children under 19', amount: FAMILY_ADD_ON });
    if (form.lateFee) lines.push({ label: 'Renewal late fee (after 31 December)', amount: LATE_FEE });
    return { lines, total: lines.reduce((sum, line) => sum + line.amount, 0) };
  }, [form.membershipClass, form.includesFamily, form.lateFee]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/club-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, familyMembers: family.filter((member) => member.name.trim()) }),
      });
      if (!res.ok) throw new Error(await readError(res, 'Unable to submit your application.'));
      setSubmitted({ total: (await res.json()).duesTotal });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <PageShell title="Membership Application" subtitle="Thank you — we have your application">
        <div className="card p-8 max-w-2xl">
          <CheckCircle2 className="w-10 h-10 text-field-green mb-4" />
          <h2 className="font-display font-bold text-2xl">Application received</h2>
          <p className="text-ink-muted mt-2">
            A club officer will review it. <strong className="text-ink">Your membership is not active until
            dues are paid.</strong>
          </p>

          <div className="mt-6 rounded-3xl bg-surface-muted p-6">
            <p className="text-sm text-ink-muted">Amount due</p>
            <p className="font-display font-bold text-3xl text-field-green">${submitted.total}</p>
            <p className="mt-4 text-sm text-ink">
              Make cheques payable to <strong>LHMAC</strong> and mail to:
            </p>
            <p className="mt-2 text-sm text-ink-muted leading-relaxed">
              {CLUB_TREASURER.name}<br />
              {CLUB_TREASURER.address}
            </p>
            <p className="mt-3 text-xs text-ink-light">Questions? Call {CLUB_TREASURER.phone}.</p>
          </div>

          <Link href="/membership/" className="btn-secondary text-sm mt-6 inline-flex">Back to Membership</Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Membership Application" subtitle="AMA Charter #557 · Mt. Pleasant, PA">
      <form onSubmit={submit} className="max-w-3xl space-y-6">
        <div className="card p-6">
          <div className="flex flex-wrap items-center gap-6">
            <span className="text-sm font-medium text-ink">This application is a</span>
            {['new', 'renewal'].map((option) => (
              <label key={option} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="applicationType"
                  checked={form.applicationType === option}
                  onChange={() => setForm((prev) => ({ ...prev, applicationType: option }))}
                  className="w-4 h-4 accent-field-green"
                />
                <span className="text-sm font-display font-bold uppercase tracking-wider">{option}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-display font-bold text-xl mb-4">Your details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Label className="sm:col-span-2">Full name
              <input value={form.name} onChange={set('name')} className={field} required />
            </Label>
            <Label hint="(optional)">AMA number
              <input value={form.amaNumber} onChange={set('amaNumber')} className={field} />
            </Label>
            <Label hint="(optional)">FAA / UAS number
              <input value={form.faaNumber} onChange={set('faaNumber')} className={field} />
            </Label>
            <Label className="sm:col-span-2">Street address
              <input value={form.address} onChange={set('address')} className={field} />
            </Label>
            <Label>City<input value={form.city} onChange={set('city')} className={field} /></Label>
            <div className="grid grid-cols-2 gap-4">
              <Label>State<input value={form.state} onChange={set('state')} className={field} /></Label>
              <Label>ZIP<input value={form.zip} onChange={set('zip')} className={field} /></Label>
            </div>
            <Label>Home phone<input value={form.homePhone} onChange={set('homePhone')} className={field} /></Label>
            <Label>Mobile phone<input value={form.mobilePhone} onChange={set('mobilePhone')} className={field} /></Label>
            <Label>Email<input type="email" value={form.email} onChange={set('email')} className={field} required /></Label>
            <Label>Date of birth
              <input type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} className={field} />
            </Label>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-display font-bold text-xl">Other family members</h2>
          <p className="text-sm text-ink-muted mb-4">Only needed for a family membership. Leave blank otherwise.</p>
          <div className="space-y-4">
            {family.map((member, index) => (
              <div key={index} className="grid gap-3 sm:grid-cols-4 rounded-3xl bg-surface-muted p-4">
                <input placeholder="Name" value={member.name} onChange={setFamilyField(index, 'name')} className={`${field} mt-0`} />
                <input placeholder="Date of birth" value={member.dob} onChange={setFamilyField(index, 'dob')} className={`${field} mt-0`} />
                <input placeholder="AMA #" value={member.amaNumber} onChange={setFamilyField(index, 'amaNumber')} className={`${field} mt-0`} />
                <input placeholder="Email" value={member.email} onChange={setFamilyField(index, 'email')} className={`${field} mt-0`} />
              </div>
            ))}
          </div>
          {family.length < 3 ? (
            <button type="button" onClick={() => setFamily((prev) => [...prev, { ...emptyFamilyMember }])} className="btn-secondary text-xs mt-4">
              Add another family member
            </button>
          ) : null}
        </div>

        <div className="card p-6">
          <h2 className="font-display font-bold text-xl mb-4">In case of emergency</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Label hint="(name & relationship)">Contact
              <input value={form.emergencyName} onChange={set('emergencyName')} className={field} />
            </Label>
            <Label>Phone<input value={form.emergencyPhone} onChange={set('emergencyPhone')} className={field} /></Label>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-display font-bold text-xl mb-4">Membership type and dues</h2>
          <div className="space-y-3">
            {MEMBERSHIP_CLASSES.map((option) => (
              <label key={option.value} className="flex items-center justify-between gap-4 rounded-3xl border border-black/10 bg-surface-card px-4 py-3 cursor-pointer">
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="membershipClass"
                    checked={form.membershipClass === option.value}
                    onChange={() => setForm((prev) => ({ ...prev, membershipClass: option.value }))}
                    className="w-4 h-4 accent-field-green"
                  />
                  <span className="text-sm text-ink">{option.label}</span>
                </span>
                <span className="font-display font-bold text-ink">${option.amount}</span>
              </label>
            ))}
            <label className="flex items-center justify-between gap-4 rounded-3xl border border-black/10 bg-surface-card px-4 py-3 cursor-pointer">
              <span className="flex items-center gap-3">
                <input type="checkbox" checked={form.includesFamily} onChange={set('includesFamily')} className="w-4 h-4 accent-field-green" />
                <span className="text-sm text-ink">Family — includes spouse &amp; children under 19</span>
              </span>
              <span className="font-display font-bold text-ink">+${FAMILY_ADD_ON}</span>
            </label>
            <label className="flex items-center justify-between gap-4 rounded-3xl border border-black/10 bg-surface-card px-4 py-3 cursor-pointer">
              <span className="flex items-center gap-3">
                <input type="checkbox" checked={form.lateFee} onChange={set('lateFee')} className="w-4 h-4 accent-field-green" />
                <span className="text-sm text-ink">Renewal late fee (renewing after 31 December)</span>
              </span>
              <span className="font-display font-bold text-ink">+${LATE_FEE}</span>
            </label>
          </div>

          <div className="mt-5 rounded-3xl bg-field-green/5 border border-field-green/20 p-5">
            {dues.lines.map((line) => (
              <div key={line.label} className="flex justify-between text-sm text-ink-muted">
                <span>{line.label}</span><span>${line.amount}</span>
              </div>
            ))}
            <div className="mt-3 flex justify-between border-t border-field-green/20 pt-3">
              <span className="font-display font-bold text-lg">Total</span>
              <span className="font-display font-bold text-lg text-field-green">${dues.total}</span>
            </div>
          </div>

          <p className="mt-4 flex items-start gap-2 text-xs text-ink-muted">
            <Plane className="w-4 h-4 shrink-0 mt-0.5 text-field-green" />
            Joining after 1 August? Your membership runs through the following calendar year.
          </p>
        </div>

        <div className="card p-6">
          <h2 className="font-display font-bold text-xl mb-3">Acceptance statement</h2>
          <p className="text-sm text-ink-muted leading-relaxed">{ACCEPTANCE_STATEMENT}</p>

          <label className="mt-5 flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={form.agreed} onChange={set('agreed')} className="mt-1 w-4 h-4 accent-field-green" required />
            <span className="text-sm text-ink">I have read and accept the statement above.</span>
          </label>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Label hint="(type your full name)">Signature
              <input value={form.signature} onChange={set('signature')} className={field} required />
            </Label>
            <Label hint={form.membershipClass === 'youth' ? '(required under 19)' : '(if under 19)'}>
              Parent / guardian signature
              <input
                value={form.guardianSignature}
                onChange={set('guardianSignature')}
                className={field}
                required={form.membershipClass === 'youth'}
              />
            </Label>
          </div>
        </div>

        <div className="card p-6 bg-surface-muted">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-field-green shrink-0 mt-0.5" />
            <div className="text-sm text-ink-muted">
              <p className="font-semibold text-ink">Dues are paid by cheque</p>
              <p className="mt-1">
                Submitting this form sends your application to the club. Make cheques payable to
                <strong className="text-ink"> LHMAC</strong> and mail with payment to {CLUB_TREASURER.name},
                {' '}{CLUB_TREASURER.address}. Questions? Call {CLUB_TREASURER.phone}.
              </p>
            </div>
          </div>
        </div>

        {error ? <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p> : null}

        <button type="submit" disabled={busy} className="btn-primary w-full justify-center py-4 disabled:opacity-60">
          {busy ? 'Submitting…' : 'Submit application'}
        </button>
      </form>
    </PageShell>
  );
}
