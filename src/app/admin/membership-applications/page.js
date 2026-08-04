'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { useAuth } from '@/components/AuthProvider';
import { readError } from '@/lib/apiClient';
import { parseDateString } from '@/lib/dateUtils';
import { CLUB_APPLICATION_STATUSES } from '@/lib/clubConstants';
import { ClipboardList, Check, X, Trash2, DollarSign, ChevronDown, ChevronRight } from 'lucide-react';

const STATUS_STYLES = {
  new: 'bg-flyday-maybe/10 text-flyday-maybe',
  approved: 'bg-field-green/10 text-field-green',
  paid: 'bg-sky/10 text-sky-deep',
  rejected: 'bg-surface-muted text-ink-muted',
};

const FILTERS = [
  { value: 'new', label: 'Needs review' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
];

/** Dates of birth are plain YYYY-MM-DD, so parse locally to avoid a shift. */
function formatDate(value) {
  const parsed = parseDateString(value);
  return parsed ? parsed.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' }) : value || '—';
}

function formatSubmitted(value) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('default', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function Detail({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-ink-light">{label}</p>
      <p className="text-sm text-ink">{value}</p>
    </div>
  );
}

export default function MembershipApplicationsPage() {
  const auth = useAuth();
  const [applications, setApplications] = useState([]);
  const [filter, setFilter] = useState('new');
  const [expanded, setExpanded] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const query = filter ? `?status=${filter}` : '';
      const res = await fetch(`/api/club-applications${query}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(await readError(res, 'Unable to load applications.'));
      setApplications((await res.json()).applications ?? []);
      setError('');
    } catch (loadError) {
      setError(loadError.message);
    }
  }, [filter]);

  useEffect(() => {
    if (auth.isAdmin) load();
  }, [auth.isAdmin, load]);

  const setStatus = async (id, status) => {
    const res = await fetch('/api/club-applications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) {
      setError(await readError(res, 'Unable to update the application.'));
      return;
    }
    await load();
  };

  const remove = async (application) => {
    if (!window.confirm(`Delete ${application.name}'s application? This cannot be undone.`)) return;
    await fetch('/api/club-applications', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: application.id }),
    });
    await load();
  };

  return (
    <AdminShell title="Membership Applications" subtitle="New and renewing club members">
      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={`rounded-full px-4 py-2 text-xs font-display font-bold uppercase tracking-wider transition-colors ${
              filter === option.value ? 'bg-field-green text-white' : 'bg-surface-muted text-ink-muted hover:bg-surface-card'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {applications.length === 0 ? (
        <div className="card p-10 text-center">
          <ClipboardList className="w-10 h-10 text-field-green/30 mx-auto mb-3" />
          <p className="font-display font-bold text-lg">Nothing here</p>
          <p className="text-sm text-ink-muted mt-1">
            {filter === 'new' ? 'No applications are waiting for review.' : 'No applications with this status.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((application) => {
            const open = expanded === application.id;
            return (
              <div key={application.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : application.id)}
                    className="flex items-start gap-3 text-left min-w-0 flex-1"
                  >
                    {open ? <ChevronDown className="w-4 h-4 mt-1.5 shrink-0" /> : <ChevronRight className="w-4 h-4 mt-1.5 shrink-0" />}
                    <span className="min-w-0">
                      <span className="font-display font-semibold text-ink block">
                        {application.name}
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLES[application.status]}`}>
                          {application.status}
                        </span>
                        <span className="ml-2 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-muted">
                          {application.applicationType}
                        </span>
                      </span>
                      <span className="text-xs text-ink-muted block mt-0.5">
                        {application.amaNumber ? `AMA #${application.amaNumber} · ` : ''}{application.email} · submitted {formatSubmitted(application.submittedAt)}
                      </span>
                    </span>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center gap-1 rounded-full bg-field-green/10 px-3 py-1 text-sm font-display font-bold text-field-green">
                      <DollarSign className="w-3.5 h-3.5" />{application.duesTotal}
                    </span>
                  </div>
                </div>

                {open ? (
                  <div className="mt-5 border-t border-black/5 pt-5 space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <Detail label="AMA number" value={application.amaNumber} />
                      <Detail label="FAA / UAS number" value={application.faaNumber} />
                      <Detail label="Date of birth" value={formatDate(application.dateOfBirth)} />
                      <Detail
                        label="Address"
                        value={[application.address, application.city, application.state, application.zip].filter(Boolean).join(', ')}
                      />
                      <Detail label="Home phone" value={application.homePhone} />
                      <Detail label="Mobile phone" value={application.mobilePhone} />
                      <Detail label="Email" value={application.email} />
                      <Detail label="Emergency contact" value={application.emergencyName} />
                      <Detail label="Emergency phone" value={application.emergencyPhone} />
                    </div>

                    {application.familyMembers?.length ? (
                      <div>
                        <p className="text-xs text-ink-light mb-2">Family members</p>
                        <div className="rounded-3xl bg-surface-muted p-4 space-y-2">
                          {application.familyMembers.map((member, index) => (
                            <p key={index} className="text-sm text-ink">
                              {member.name}
                              {member.dob ? ` · DOB ${member.dob}` : ''}
                              {member.amaNumber ? ` · AMA #${member.amaNumber}` : ''}
                              {member.email ? ` · ${member.email}` : ''}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-3xl bg-surface-muted p-4">
                      <p className="text-xs text-ink-light">Dues</p>
                      <p className="text-sm text-ink mt-1">
                        {application.membershipClass}
                        {application.includesFamily ? ' + family' : ''}
                        {application.lateFee ? ' + late fee' : ''} —{' '}
                        <strong>${application.duesTotal}</strong>
                      </p>
                      <p className="text-xs text-ink-light mt-3">Signed</p>
                      <p className="text-sm text-ink">
                        {application.signature}
                        {application.guardianSignature ? ` · guardian: ${application.guardianSignature}` : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {CLUB_APPLICATION_STATUSES.filter((status) => status !== application.status).map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setStatus(application.id, status)}
                          className={status === 'rejected' ? 'btn-secondary text-xs' : 'btn-primary text-xs'}
                        >
                          {status === 'rejected' ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                          Mark {status}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => remove(application)}
                        className="inline-flex items-center gap-1 rounded-full bg-flyday-nogo/10 px-3 py-1 text-xs font-semibold text-flyday-nogo hover:bg-flyday-nogo/20"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>

                    {application.reviewedAt ? (
                      <p className="text-xs text-ink-light">
                        Last updated by {application.reviewedBy} on {formatSubmitted(application.reviewedAt)}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
