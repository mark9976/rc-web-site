'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { useAuth } from '@/components/AuthProvider';
import { readError } from '@/lib/apiClient';
import { localInputToIso, formatInstant, formatInstantRange } from '@/lib/datetimeLocal';
import { OFFICER_TITLES } from '@/lib/clubConstants';
import { parseDateString } from '@/lib/dateUtils';
import { Camera, Mail, Users, CalendarDays, Radio, Check, X, Eye, Upload, ShieldCheck, Trash2, Lock, Pencil, KeyRound, GraduationCap, CalendarClock, Newspaper, Image as ImageIcon } from 'lucide-react';

const FIELD_STATUSES = [
  { value: 'open', label: 'Open', active: 'bg-flyday-go text-white' },
  { value: 'closed', label: 'Closed', active: 'bg-flyday-nogo text-white' },
  { value: 'maintenance', label: 'Maintenance', active: 'bg-flyday-maybe text-white' },
];

const memberInputClass =
  'w-full rounded-3xl border border-black/10 bg-surface-card px-4 py-3 text-sm outline-none focus:border-field-green focus:ring-2 focus:ring-field-green/10';

/** Newsletters belong to a month; parse locally so the month never shifts. */
function formatIssueMonth(issueDate) {
  const parsed = parseDateString(issueDate);
  return parsed ? parsed.toLocaleDateString('default', { month: 'long', year: 'numeric' }) : issueDate || '';
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatTimestamp(value) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('default', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function AdminPage() {
  const auth = useAuth();
  const [photoQueue, setPhotoQueue] = useState([]);
  const [recentPhotos, setRecentPhotos] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [applicationMessage, setApplicationMessage] = useState('');
  const [applicationError, setApplicationError] = useState('');
  const [counts, setCounts] = useState(null);
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [fieldStatus, setFieldStatus] = useState(null);
  const [statusReason, setStatusReason] = useState('');
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [memberDraft, setMemberDraft] = useState(null);
  const [memberError, setMemberError] = useState('');
  const [memberMessage, setMemberMessage] = useState('');
  const [lessonRequests, setLessonRequests] = useState([]);
  const [manualStatus, setManualStatus] = useState(null);
  const [closures, setClosures] = useState([]);
  const [closureDraft, setClosureDraft] = useState({ status: 'closed', reason: '', startsAt: '', endsAt: '' });
  const [closureError, setClosureError] = useState('');
  const [newsletters, setNewsletters] = useState([]);
  const [newsletterDraft, setNewsletterDraft] = useState({ title: '', issueDate: '' });
  const [newsletterFile, setNewsletterFile] = useState(null);
  const [newsletterError, setNewsletterError] = useState('');
  const [uploadingNewsletter, setUploadingNewsletter] = useState(false);
  const [heroImage, setHeroImage] = useState(null);
  const [logoImage, setLogoImage] = useState(null);
  const [eventTypes, setEventTypes] = useState([]);
  const [typeDraft, setTypeDraft] = useState({ id: null, name: '', color: '#2D5A27' });
  const [typeError, setTypeError] = useState('');
  const [heroError, setHeroError] = useState('');
  const [uploadingHero, setUploadingHero] = useState(false);

  const isAdmin = auth.isAdmin;

  const refreshPhotos = useCallback(async () => {
    try {
      const [queueRes, recentRes] = await Promise.all([
        fetch('/api/photos/queue', { cache: 'no-store' }),
        fetch('/api/photos/recent', { cache: 'no-store' }),
      ]);

      if (!queueRes.ok || !recentRes.ok) {
        throw new Error('Unable to load photos.');
      }

      const [queueData, recentData] = await Promise.all([queueRes.json(), recentRes.json()]);
      setPhotoQueue(queueData);
      setRecentPhotos(recentData);
    } catch (error) {
      setUploadError(error.message || 'Unable to refresh photos.');
    }
  }, []);

  const refreshAdminData = useCallback(async () => {
    try {
      const [membersRes, messagesRes, statusRes, lessonsRes] = await Promise.all([
        fetch('/api/members', { cache: 'no-store' }),
        fetch('/api/contact', { cache: 'no-store' }),
        fetch('/api/field-status', { cache: 'no-store' }),
        fetch('/api/lessons', { cache: 'no-store' }),
      ]);

      if (lessonsRes.ok) {
        setLessonRequests((await lessonsRes.json()).lessonRequests ?? []);
      }

      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(data.members ?? []);
        setCounts(data.counts ?? null);
      }
      if (messagesRes.ok) {
        setMessages((await messagesRes.json()).messages ?? []);
      }
      if (statusRes.ok) {
        const data = await statusRes.json();
        setFieldStatus(data.fieldStatus ?? null);
        setManualStatus(data.manualStatus ?? null);
        setStatusReason(data.manualStatus?.reason ?? '');
      }

      const [closuresRes, newslettersRes, imagesRes, typesRes] = await Promise.all([
        fetch('/api/field-closures', { cache: 'no-store' }),
        fetch('/api/newsletters', { cache: 'no-store' }),
        fetch('/api/site-images', { cache: 'no-store' }),
        fetch('/api/event-types', { cache: 'no-store' }),
      ]);
      if (typesRes.ok) {
        setEventTypes((await typesRes.json()).eventTypes ?? []);
      }
      if (imagesRes.ok) {
        const images = (await imagesRes.json()).images ?? {};
        setHeroImage(images.hero ?? null);
        setLogoImage(images.logo ?? null);
      }
      if (closuresRes.ok) {
        setClosures((await closuresRes.json()).closures ?? []);
      }
      if (newslettersRes.ok) {
        setNewsletters((await newslettersRes.json()).newsletters ?? []);
      }
    } catch {
      // Individual panels show their own empty states if a fetch fails.
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    refreshPhotos();
    refreshAdminData();
  }, [isAdmin, refreshPhotos, refreshAdminData]);

  const handleFiles = async (files) => {
    setUploadError('');
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          throw new Error('Only image files are allowed.');
        }

        const formData = new FormData();
        formData.append('photo', file);
        formData.append('caption', file.name);

        const response = await fetch('/api/photos/upload', { method: 'POST', body: formData });
        if (!response.ok) {
          throw new Error(await readError(response, 'Upload failed.'));
        }
      }
      await refreshPhotos();
    } catch (error) {
      setUploadError(error.message || 'Upload failed.');
    }
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    setDragActive(false);
    if (event.dataTransfer.files.length > 0) {
      await handleFiles(event.dataTransfer.files);
    }
  };

  const handleApprove = async (photoId) => {
    setUploadError('');
    try {
      const response = await fetch('/api/photos/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: photoId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Approve failed.');
      }

      await refreshPhotos();
    } catch (error) {
      setUploadError(error.message || 'Approve failed.');
    }
  };

  const handleReject = async (photoId) => {
    setUploadError('');
    try {
      const response = await fetch('/api/photos/queue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: photoId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Reject failed.');
      }

      await refreshPhotos();
    } catch (error) {
      setUploadError(error.message || 'Reject failed.');
    }
  };

  /**
   * Takes a photo down from the public gallery.
   *
   * Distinct from rejecting: reject only applies while a photo is still in the
   * review queue, and does nothing once it has been approved.
   */
  const handleRemoveFromGallery = async (photo) => {
    const label = photo.caption || photo.filename;
    if (!window.confirm(`Remove "${label}" from the public gallery? This cannot be undone.`)) return;

    setUploadError('');
    try {
      const response = await fetch('/api/photos/recent', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: photo.id }),
      });
      if (!response.ok) throw new Error(await readError(response, 'Could not remove the photo.'));
      await refreshPhotos();
    } catch (error) {
      setUploadError(error.message);
    }
  };

  const handleFileInput = async (event) => {
    if (event.target.files.length > 0) {
      await handleFiles(event.target.files);
      event.target.value = null;
    }
  };

  const pendingApplications = auth.pendingApplications || [];
  const pendingPendingCount = pendingApplications.filter((application) => application.status === 'pending').length;

  const handleApproveApplication = async (applicationId) => {
    const result = await auth.approveApplication(applicationId);
    if (result.error) {
      setApplicationError(result.error);
      setApplicationMessage('');
      return;
    }
    if (!result.user) {
      setApplicationMessage('Application approved.');
      setApplicationError('');
      await refreshAdminData();
      return;
    }

    const who = `${result.user.name} (username: ${result.user.username})`;
    if (result.email?.sent) {
      setApplicationMessage(`Approved ${who}. Their login details were emailed to them.`);
      setApplicationError('');
    } else {
      // The account exists either way, so show the password for hand-off
      // rather than leaving the admin with no way to reach the new member.
      setApplicationMessage(
        `Approved ${who}, but the welcome email could not be sent${result.email?.reason ? `: ${result.email.reason}` : '.'} ` +
        `Give them this temporary password yourself: ${result.temporaryPassword ?? '(unavailable)'}`
      );
      setApplicationError('');
    }
    await refreshAdminData();
  };

  const handleRejectApplication = async (applicationId) => {
    const result = await auth.rejectApplication(applicationId);
    if (result.error) {
      setApplicationError(result.error);
      setApplicationMessage('');
      return;
    }
    setApplicationMessage('Application rejected.');
    setApplicationError('');
  };

  const handleFieldStatus = async (status) => {
    try {
      const res = await fetch('/api/field-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason: statusReason }),
      });
      if (!res.ok) throw new Error(await readError(res, 'Unable to update field status.'));
      const data = await res.json();
      setFieldStatus(data.fieldStatus);
    } catch (error) {
      setUploadError(error.message);
    }
  };

  const handleMessageAction = async (id, method) => {
    await fetch('/api/contact', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await refreshAdminData();
  };

  const handleMemberAction = async (id, body, method) => {
    const res = await fetch('/api/members', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setMemberError(await readError(res, 'Unable to update member.'));
      return false;
    }
    setMemberError('');
    await refreshAdminData();
    return true;
  };

  const startEditMember = (member) => {
    setMemberError('');
    setMemberMessage('');
    setEditingMemberId(member.id);
    setMemberDraft({
      name: member.name ?? '',
      username: member.username ?? '',
      email: member.email ?? '',
      phone: member.phone ?? '',
      address: member.address ?? '',
      amaNumber: member.amaNumber ?? '',
      role: member.role ?? 'member',
      isInstructor: Boolean(member.isInstructor),
      instructorNote: member.instructorNote ?? '',
      officerTitle: member.officerTitle ?? '',
    });
  };

  const saveMember = async (event) => {
    event.preventDefault();
    const saved = await handleMemberAction(editingMemberId, { id: editingMemberId, ...memberDraft }, 'PATCH');
    if (saved) {
      setEditingMemberId(null);
      setMemberMessage('Member updated.');
    }
  };

  /** Shared by every site-image slot; `slot` decides which one is replaced. */
  const uploadSiteImage = async (slot, file) => {
    if (!file) return;
    setHeroError('');

    if (!file.type.startsWith('image/')) {
      setHeroError('Choose an image file.');
      return;
    }

    setUploadingHero(true);
    try {
      const body = new FormData();
      body.append('slot', slot);
      body.append('image', file);

      const res = await fetch('/api/site-images', { method: 'POST', body });
      if (!res.ok) throw new Error(await readError(res, 'Unable to upload the image.'));
      await refreshAdminData();
    } catch (error) {
      setHeroError(error.message);
    } finally {
      setUploadingHero(false);
    }
  };

  const removeSiteImage = async (slot, confirmMessage) => {
    if (!window.confirm(confirmMessage)) return;
    await fetch('/api/site-images', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot }),
    });
    await refreshAdminData();
  };

  const saveEventType = async (submitEvent) => {
    submitEvent.preventDefault();
    setTypeError('');

    const editing = Boolean(typeDraft.id);
    const res = await fetch('/api/event-types', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(typeDraft),
    });
    if (!res.ok) {
      setTypeError(await readError(res, 'Unable to save the type.'));
      return;
    }

    setTypeDraft({ id: null, name: '', color: '#2D5A27' });
    await refreshAdminData();
  };

  const deleteEventType = async (type) => {
    if (!window.confirm(`Delete the “${type.name}” type?`)) return;
    const res = await fetch('/api/event-types', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: type.id }),
    });
    // The API refuses when events still use the type and says how many.
    if (!res.ok) {
      setTypeError(await readError(res, 'Unable to delete the type.'));
      return;
    }
    setTypeError('');
    await refreshAdminData();
  };

  const uploadHeroImage = (file) => uploadSiteImage('hero', file);
  const removeHeroImage = () => removeSiteImage('hero', 'Remove the homepage header image?');

  const uploadNewsletter = async (event) => {
    event.preventDefault();
    setNewsletterError('');

    if (!newsletterDraft.title.trim() || !newsletterDraft.issueDate || !newsletterFile) {
      setNewsletterError('Title, issue date, and a PDF file are all required.');
      return;
    }

    setUploadingNewsletter(true);
    try {
      const body = new FormData();
      body.append('title', newsletterDraft.title);
      body.append('issueDate', newsletterDraft.issueDate);
      body.append('newsletter', newsletterFile);

      const res = await fetch('/api/newsletters', { method: 'POST', body });
      if (!res.ok) throw new Error(await readError(res, 'Unable to upload the newsletter.'));

      setNewsletterDraft({ title: '', issueDate: '' });
      setNewsletterFile(null);
      await refreshAdminData();
    } catch (uploadError) {
      setNewsletterError(uploadError.message);
    } finally {
      setUploadingNewsletter(false);
    }
  };

  const removeNewsletter = async (newsletter) => {
    if (!window.confirm(`Delete "${newsletter.title}"? This removes the PDF permanently.`)) return;
    await fetch('/api/newsletters', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: newsletter.id }),
    });
    await refreshAdminData();
  };

  const scheduleClosure = async (event) => {
    event.preventDefault();
    setClosureError('');

    const startsAt = localInputToIso(closureDraft.startsAt);
    const endsAt = localInputToIso(closureDraft.endsAt);
    if (!startsAt || !endsAt) {
      setClosureError('Pick both a start and an end date/time.');
      return;
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      setClosureError('The end must come after the start.');
      return;
    }

    const res = await fetch('/api/field-closures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...closureDraft, startsAt, endsAt }),
    });
    if (!res.ok) {
      setClosureError(await readError(res, 'Unable to schedule the closure.'));
      return;
    }

    setClosureDraft({ status: 'closed', reason: '', startsAt: '', endsAt: '' });
    await refreshAdminData();
  };

  const removeClosure = async (body) => {
    await fetch('/api/field-closures', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    await refreshAdminData();
  };

  const handleLessonAction = async (id, body, method) => {
    await fetch('/api/lessons', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    });
    await refreshAdminData();
  };

  const resetMemberPassword = async (member) => {
    if (
      !window.confirm(
        `Reset the password for ${member.name}? They will be signed out and must set a new password with the temporary one on their next sign-in.`
      )
    ) {
      return;
    }

    const res = await fetch('/api/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: member.id, action: 'resetPassword' }),
    });
    if (!res.ok) {
      setMemberError(await readError(res, 'Unable to reset password.'));
      return;
    }
    const data = await res.json();
    setMemberError('');
    setMemberMessage(`Password reset for ${member.name}. Temporary password: ${data.temporaryPassword}`);
    await refreshAdminData();
  };


  // The API refuses admin data regardless, but gating the page keeps the
  // dashboard from rendering empty panels to members and visitors.
  if (!auth.authLoaded) {
    return (
      <PageShell title="Admin Dashboard" subtitle="Manage LHMAC site content and members">
        <p className="text-sm text-ink-muted">Checking your access...</p>
      </PageShell>
    );
  }

  if (!isAdmin) {
    return (
      <PageShell title="Admin Dashboard" subtitle="Manage LHMAC site content and members">
        <div className="max-w-xl mx-auto card p-8 text-center">
          <Lock className="w-10 h-10 text-flyday-maybe mx-auto mb-4" />
          <h2 className="font-display font-bold text-xl mb-2">Admin access required</h2>
          <p className="text-sm text-ink-muted mb-6">
            {auth.isAuthenticated
              ? 'Your account does not have admin permissions. Contact a club officer if you believe this is a mistake.'
              : 'Sign in with an admin account to manage photos, members, and club settings.'}
          </p>
          <Link href={auth.isAuthenticated ? '/' : '/login/'} className="btn-primary">
            {auth.isAuthenticated ? 'Back to Homepage' : 'Go to Login'}
          </Link>
        </div>
      </PageShell>
    );
  }

  const statTiles = [
    { icon: Camera, label: 'Photo Queue', count: counts?.photoQueue ?? photoQueue.length, color: 'text-flyday-maybe' },
    { icon: Mail, label: 'Unread Mail', count: counts?.unreadMessages ?? 0, color: 'text-sky-deep' },
    { icon: ShieldCheck, label: 'Requests', count: pendingPendingCount, color: 'text-flyday-maybe' },
    { icon: GraduationCap, label: 'Lessons', count: counts?.newLessonRequests ?? 0, color: 'text-field-green' },
    { icon: Users, label: 'Members', count: counts?.members ?? members.length, color: 'text-field-green' },
    { icon: CalendarDays, label: 'Events', count: counts?.events ?? 0, color: 'text-field-green' },
    { icon: Radio, label: 'Field', count: null, color: 'text-flyday-go' },
  ];

  return (
    <PageShell title="Admin Dashboard" subtitle="Manage LHMAC site content and members">

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        {statTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <div key={tile.label} className="card text-center p-4">
              <Icon className={`w-6 h-6 mx-auto mb-2 ${tile.color}`} />
              <p className="font-display font-bold text-xs uppercase tracking-wider text-ink-muted">{tile.label}</p>
              {tile.count !== null ? (
                <p className="font-display font-bold text-2xl text-ink mt-1">{tile.count}</p>
              ) : (
                <p className="font-display font-bold text-sm text-ink mt-2 capitalize">{fieldStatus?.status ?? '—'}</p>
              )}
            </div>
          );
        })}
      </div>

      {uploadError ? (
        <p className="mb-6 rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{uploadError}</p>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-8 mb-8">
        {/* ─── Member Access Requests ─── */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-field-green" />
              <div>
                <h2 className="font-display font-bold text-xl">Member Access Requests</h2>
                <p className="text-sm text-ink-muted">Roster members asking for website login credentials.</p>
              </div>
            </div>
            <span className="text-xs font-display font-bold bg-field-green/10 text-field-green px-2 py-1 rounded-full shrink-0">
              {pendingPendingCount} pending
            </span>
          </div>

          {applicationMessage ? <p className="text-sm text-field-green mb-4">{applicationMessage}</p> : null}
          {applicationError ? <p className="text-sm text-red-600 mb-4">{applicationError}</p> : null}

          <div className="space-y-3">
            {pendingApplications.length === 0 ? (
              <div className="rounded-3xl bg-surface-muted p-6 text-center text-sm text-ink-muted">
                No membership access requests yet.
              </div>
            ) : (
              pendingApplications.map((application) => (
                <div key={application.id} className="rounded-3xl border border-black/10 bg-surface-card p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="font-display font-semibold text-ink">{application.name}</p>
                      <p className="text-xs text-ink-muted">
                        AMA #{application.amaNumber} · {application.email} · {application.phone}
                      </p>
                      <p className="text-xs text-ink-light mt-1">{application.address}</p>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold shrink-0 ${application.status === 'pending' ? 'bg-field-green/10 text-field-green' : 'bg-surface-muted text-ink-muted'}`}>
                      {application.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-ink-muted">{application.reason || 'No additional note provided.'}</p>
                  {application.status === 'pending' ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => handleApproveApplication(application.id)} className="btn-primary text-xs">
                        Approve
                      </button>
                      <button onClick={() => handleRejectApplication(application.id)} className="btn-secondary text-xs">
                        Reject
                      </button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ─── Field Status Control ─── */}
        <aside className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Radio className="w-6 h-6 text-flyday-go" />
            <div>
              <h3 className="font-display font-bold text-xl">Field Status</h3>
              <p className="text-sm text-ink-muted">Shown on the homepage banner.</p>
            </div>
          </div>

          {fieldStatus?.source === 'scheduled' ? (
            <div className="mb-4 rounded-3xl border border-flyday-maybe/30 bg-flyday-maybe/5 p-3 text-xs text-flyday-maybe">
              A scheduled closure is running right now and overrides the buttons below until{' '}
              <strong>{formatInstant(fieldStatus.activeUntil)}</strong>.
            </div>
          ) : null}

          <div className="space-y-3">
            <div className="flex gap-2">
              {FIELD_STATUSES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleFieldStatus(option.value)}
                  className={`flex-1 py-3 rounded-lg font-display font-bold text-xs uppercase tracking-wider transition-colors ${
                    manualStatus?.status === option.value
                      ? option.active
                      : 'bg-surface-muted text-ink-muted hover:bg-surface-card'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={statusReason}
              onChange={(event) => setStatusReason(event.target.value)}
              placeholder="Optional reason (e.g., mowing today)"
              className="w-full px-4 py-3 rounded-lg border border-black/10 bg-surface-card text-sm focus:outline-none focus:ring-2 focus:ring-field-green/30"
            />
            {manualStatus?.updatedAt ? (
              <p className="text-xs text-ink-light">
                Last set by {manualStatus.updatedBy} on {formatTimestamp(manualStatus.updatedAt)}. Pick a status to apply the reason.
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      {/* ─── Event Types ─── */}
      <div className="card p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <CalendarDays className="w-6 h-6 text-field-green" />
          <div>
            <h3 className="font-display font-bold text-xl">Event Types</h3>
            <p className="text-sm text-ink-muted">
              The categories offered when adding an event. The colour is used for the badge on the events page.
            </p>
          </div>
        </div>

        <form onSubmit={saveEventType} className="flex flex-wrap items-end gap-3 mb-5">
          <label className="block flex-1 min-w-[12rem]">
            <span className="text-sm font-medium text-ink">{typeDraft.id ? 'Rename type' : 'New type'}</span>
            <input
              value={typeDraft.name}
              onChange={(event) => setTypeDraft({ ...typeDraft, name: event.target.value })}
              placeholder="Night Fly"
              className={`mt-2 ${memberInputClass}`}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">Colour</span>
            <input
              type="color"
              value={typeDraft.color}
              onChange={(event) => setTypeDraft({ ...typeDraft, color: event.target.value })}
              className="mt-2 h-12 w-20 cursor-pointer rounded-2xl border border-black/10 bg-surface-card p-1"
            />
          </label>
          <button type="submit" className="btn-primary text-sm py-3">
            {typeDraft.id ? 'Save changes' : 'Add type'}
          </button>
          {typeDraft.id ? (
            <button
              type="button"
              onClick={() => { setTypeDraft({ id: null, name: '', color: '#2D5A27' }); setTypeError(''); }}
              className="btn-secondary text-sm py-3"
            >
              Cancel
            </button>
          ) : null}
        </form>

        {typeError ? <p className="mb-4 text-sm text-red-600">{typeError}</p> : null}

        {eventTypes.length === 0 ? (
          <div className="rounded-3xl bg-surface-muted p-6 text-center text-sm text-ink-muted">
            No event types yet. Add one above.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {eventTypes.map((type) => (
              <div
                key={type.id}
                className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-surface-card py-1 pl-1 pr-2"
              >
                <span
                  className="rounded-full px-3 py-1 text-xs font-display font-bold uppercase tracking-wider"
                  style={{ backgroundColor: `${type.color}1a`, color: type.color }}
                >
                  {type.name}
                </span>
                <button
                  type="button"
                  onClick={() => { setTypeDraft({ id: type.id, name: type.name, color: type.color }); setTypeError(''); }}
                  className="text-ink-muted hover:text-field-green"
                  title={`Edit ${type.name}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteEventType(type)}
                  className="text-ink-muted hover:text-flyday-nogo"
                  title={`Delete ${type.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-ink-light">
          Renaming a type relabels every event using it. A type still in use cannot be deleted.
        </p>
      </div>

      {/* ─── Club Logo ─── */}
      <div className="card p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <ImageIcon className="w-6 h-6 text-field-green" />
          <div>
            <h3 className="font-display font-bold text-xl">Club Logo</h3>
            <p className="text-sm text-ink-muted">
              The crest in the site header. The phone app reads the same image, so replacing it here
              updates both.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          {/* Previewed on the dark green it actually sits on, so a logo with the
              wrong background shows up here rather than in production. */}
          <div className="shrink-0 rounded-2xl bg-field-darkgreen p-4 flex items-center justify-center w-32 h-32">
            {logoImage ? (
              <img
                src={`/api/site-images/logo?v=${encodeURIComponent(logoImage.updatedAt)}`}
                alt="Club logo"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <ImageIcon className="w-8 h-8 text-white/30" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            {logoImage ? (
              <p className="text-xs text-ink-muted mb-3">
                {formatFileSize(logoImage.byteSize)} · set by {logoImage.updatedBy} on{' '}
                {formatTimestamp(logoImage.updatedAt)}
              </p>
            ) : (
              <p className="text-xs text-ink-muted mb-3">No logo set — the header and the app will both show nothing.</p>
            )}
            <div className="flex flex-wrap gap-3">
              <label className="btn-secondary text-xs cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> {logoImage ? 'Replace logo' : 'Upload logo'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => uploadSiteImage('logo', event.target.files?.[0])}
                />
              </label>
              {logoImage ? (
                <button
                  type="button"
                  onClick={() => removeSiteImage('logo', 'Remove the club logo? The site header and the phone app will both lose it.')}
                  className="inline-flex items-center gap-1 rounded-full bg-flyday-nogo/10 px-3 py-1 text-xs font-semibold text-flyday-nogo hover:bg-flyday-nogo/20"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              ) : null}
            </div>
            <p className="text-xs text-ink-light mt-3">
              A PNG with a transparent background works best. Served to both the site and the app at{' '}
              <code className="rounded bg-surface-muted px-1">/api/site-images/logo</code>.
            </p>
          </div>
        </div>
        {heroError ? <p className="mt-4 text-sm text-red-600">{heroError}</p> : null}
      </div>

      {/* ─── Homepage Header Image ─── */}
      <div className="card p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <ImageIcon className="w-6 h-6 text-field-green" />
          <div>
            <h3 className="font-display font-bold text-xl">Homepage Header Image</h3>
            <p className="text-sm text-ink-muted">
              Shown at the top of the homepage, just above &ldquo;Come, Fly with Us!&rdquo;. A wide photo works best.
            </p>
          </div>
        </div>

        {heroImage ? (
          <div className="space-y-4">
            <img
              src={`/api/site-images/hero?v=${encodeURIComponent(heroImage.updatedAt)}`}
              alt="Current homepage header"
              className="w-full max-w-2xl rounded-xl border border-black/10"
            />
            <p className="text-xs text-ink-muted">
              {formatFileSize(heroImage.byteSize)} · set by {heroImage.updatedBy} on{' '}
              {formatTimestamp(heroImage.updatedAt)}
            </p>
            <div className="flex flex-wrap gap-3 items-center">
              <label className="btn-secondary text-xs cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> {uploadingHero ? 'Uploading...' : 'Replace image'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => uploadHeroImage(event.target.files?.[0])}
                />
              </label>
              <button
                type="button"
                onClick={removeHeroImage}
                className="inline-flex items-center gap-1 rounded-full bg-flyday-nogo/10 px-3 py-1 text-xs font-semibold text-flyday-nogo hover:bg-flyday-nogo/20"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-black/10 bg-surface-card p-8 text-center">
            <input
              id="hero-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => uploadHeroImage(event.target.files?.[0])}
            />
            <label htmlFor="hero-upload" className="cursor-pointer flex flex-col items-center gap-2">
              <ImageIcon className="w-8 h-8 text-field-green" />
              <span className="font-display font-semibold">
                {uploadingHero ? 'Uploading...' : 'Choose a header image'}
              </span>
              <span className="text-xs text-ink-muted">
                JPEG, PNG, GIF, or WebP up to 25 MB. Until one is set, the homepage shows the plane icon.
              </span>
            </label>
          </div>
        )}

        {heroError ? <p className="mt-4 text-sm text-red-600">{heroError}</p> : null}
      </div>

      {/* ─── Newsletters ─── */}
      <div className="card p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Newspaper className="w-6 h-6 text-field-green" />
          <div>
            <h3 className="font-display font-bold text-xl">Newsletters</h3>
            <p className="text-sm text-ink-muted">
              Upload a PDF issue. It appears immediately on the Media page, newest first.
            </p>
          </div>
        </div>

        <form onSubmit={uploadNewsletter} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end mb-6">
          <label className="block lg:col-span-2">
            <span className="text-sm font-medium text-ink">Title</span>
            <input
              value={newsletterDraft.title}
              onChange={(event) => setNewsletterDraft({ ...newsletterDraft, title: event.target.value })}
              placeholder="August 2026 Newsletter"
              className={`mt-2 ${memberInputClass}`}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">Issue date</span>
            <input
              type="date"
              value={newsletterDraft.issueDate}
              onChange={(event) => setNewsletterDraft({ ...newsletterDraft, issueDate: event.target.value })}
              className={`mt-2 ${memberInputClass}`}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">PDF file</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => {
                setNewsletterError('');
                setNewsletterFile(event.target.files?.[0] ?? null);
              }}
              className="mt-2 w-full text-sm text-ink-muted file:mr-3 file:rounded-full file:border-0 file:bg-field-green/10 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-field-green hover:file:bg-field-green/20"
            />
          </label>
          <button
            type="submit"
            disabled={uploadingNewsletter}
            className="btn-primary justify-center py-3 lg:col-start-4 disabled:opacity-60"
          >
            {uploadingNewsletter ? 'Uploading...' : 'Upload Issue'}
          </button>
        </form>

        {newsletterError ? <p className="mb-4 text-sm text-red-600">{newsletterError}</p> : null}

        <div className="space-y-2">
          {newsletters.length === 0 ? (
            <div className="rounded-3xl bg-surface-muted p-6 text-center text-sm text-ink-muted">
              No newsletters uploaded yet.
            </div>
          ) : (
            newsletters.map((newsletter, index) => (
              <div
                key={newsletter.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-black/10 bg-surface-card p-4"
              >
                <div className="min-w-0">
                  <p className="font-display font-semibold text-ink">
                    {newsletter.title}
                    {index === 0 ? (
                      <span className="ml-2 rounded-full bg-field-green/10 px-2 py-0.5 text-[10px] font-semibold text-field-green">
                        latest
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-ink-muted mt-1">
                    {formatIssueMonth(newsletter.issueDate)} · {formatFileSize(newsletter.byteSize)} · uploaded by{' '}
                    {newsletter.uploadedBy}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <a
                    href={`/api/newsletters/file/${encodeURIComponent(newsletter.id)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary text-xs"
                  >
                    <Eye className="w-3.5 h-3.5" /> View
                  </a>
                  <button
                    type="button"
                    onClick={() => removeNewsletter(newsletter)}
                    className="inline-flex items-center gap-1 rounded-full bg-flyday-nogo/10 px-3 py-1 text-xs font-semibold text-flyday-nogo hover:bg-flyday-nogo/20"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ─── Scheduled Closures (NOTAM-style) ─── */}
      <div className="card p-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <CalendarClock className="w-6 h-6 text-flyday-maybe" />
            <div>
              <h3 className="font-display font-bold text-xl">Scheduled Closures</h3>
              <p className="text-sm text-ink-muted">
                Announce a closure ahead of time. The field switches itself over for the window, then reverts.
              </p>
            </div>
          </div>
          {closures.some((c) => new Date(c.endsAt) <= new Date()) ? (
            <button type="button" onClick={() => removeClosure({ action: 'purgeExpired' })} className="btn-secondary text-xs shrink-0">
              Clear past closures
            </button>
          ) : null}
        </div>

        <form onSubmit={scheduleClosure} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end mb-6">
          <label className="block">
            <span className="text-sm font-medium text-ink">Status</span>
            <select
              value={closureDraft.status}
              onChange={(event) => setClosureDraft({ ...closureDraft, status: event.target.value })}
              className={`mt-2 ${memberInputClass}`}
            >
              <option value="closed">Closed</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">Starts</span>
            <input
              type="datetime-local"
              value={closureDraft.startsAt}
              onChange={(event) => setClosureDraft({ ...closureDraft, startsAt: event.target.value })}
              className={`mt-2 ${memberInputClass}`}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">Ends</span>
            <input
              type="datetime-local"
              value={closureDraft.endsAt}
              onChange={(event) => setClosureDraft({ ...closureDraft, endsAt: event.target.value })}
              className={`mt-2 ${memberInputClass}`}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">Reason</span>
            <input
              value={closureDraft.reason}
              onChange={(event) => setClosureDraft({ ...closureDraft, reason: event.target.value })}
              placeholder="Mowing, event setup, wet field"
              className={`mt-2 ${memberInputClass}`}
            />
          </label>
          <button type="submit" className="btn-primary justify-center py-3">Schedule</button>
        </form>

        {closureError ? <p className="mb-4 text-sm text-red-600">{closureError}</p> : null}

        <div className="space-y-2">
          {closures.length === 0 ? (
            <div className="rounded-3xl bg-surface-muted p-6 text-center text-sm text-ink-muted">
              Nothing scheduled. The field follows the status buttons above.
            </div>
          ) : (
            closures.map((closure) => {
              const now = new Date();
              const start = new Date(closure.startsAt);
              const end = new Date(closure.endsAt);
              const state = end <= now ? 'past' : start <= now ? 'active' : 'upcoming';
              const stateStyles = {
                active: 'border-flyday-nogo/40 bg-flyday-nogo/5',
                upcoming: 'border-black/10 bg-surface-card',
                past: 'border-black/5 bg-surface-muted opacity-60',
              };
              const stateLabel = { active: 'in effect now', upcoming: 'upcoming', past: 'finished' };

              return (
                <div
                  key={closure.id}
                  className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-3xl border p-4 ${stateStyles[state]}`}
                >
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-ink capitalize">
                      {closure.status}
                      <span className="ml-2 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                        {stateLabel[state]}
                      </span>
                    </p>
                    <p className="text-sm text-ink-muted mt-1">{formatInstantRange(closure.startsAt, closure.endsAt)}</p>
                    {closure.reason ? <p className="text-sm text-ink-muted mt-1">{closure.reason}</p> : null}
                    <p className="text-xs text-ink-light mt-1">Set by {closure.createdBy}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Remove this scheduled closure?')) removeClosure({ id: closure.id });
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-flyday-nogo/10 px-3 py-1 text-xs font-semibold text-flyday-nogo hover:bg-flyday-nogo/20 shrink-0 self-start"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ─── Photo Approval Queue ─── */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-xl flex items-center gap-2">
              <Camera className="w-5 h-5 text-flyday-maybe" />
              Photo Approval Queue
            </h2>
            <span className="text-xs font-display font-bold bg-flyday-maybe/10 text-flyday-maybe px-2 py-1 rounded-full shrink-0">
              {photoQueue.length} pending
            </span>
          </div>

          <div
            className={`mb-4 rounded-3xl border border-dashed p-6 text-center transition ${dragActive ? 'border-field-green bg-field-green/5' : 'border-black/10 bg-surface-card'}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <input id="photo-upload" type="file" accept="image/*" multiple className="hidden" onChange={handleFileInput} />
            <label htmlFor="photo-upload" className="cursor-pointer">
              <div className="flex flex-col items-center justify-center gap-3">
                <Upload className="w-6 h-6 text-field-green" />
                <p className="font-display font-semibold">Drag &amp; drop images here</p>
                <p className="text-xs text-ink-muted">or click to choose files. Uploads join the approval queue.</p>
              </div>
            </label>
          </div>

          <div className="space-y-3">
            {photoQueue.length === 0 ? (
              <div className="rounded-3xl bg-surface-muted p-6 text-center text-sm text-ink-muted">
                Nothing waiting for review.
              </div>
            ) : (
              photoQueue.map((photo) => (
                <div key={photo.id} className="flex items-center gap-3 p-3 bg-surface-muted rounded-lg">
                  <div className="w-16 h-16 rounded-lg overflow-hidden border border-black/5 shrink-0">
                    <img
                      src={`/api/photos/files/${encodeURIComponent(photo.id)}`}
                      alt={photo.caption}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{photo.caption || photo.filename}</p>
                    <p className="text-xs text-ink-muted truncate">
                      by {photo.submitter} · {formatTimestamp(photo.submitted)}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => handleApprove(photo.id)}
                      className="w-8 h-8 rounded-lg bg-flyday-go/10 text-flyday-go hover:bg-flyday-go hover:text-white transition-colors flex items-center justify-center"
                      title="Approve"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <a
                      href={`/api/photos/files/${encodeURIComponent(photo.id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-lg bg-sky/10 text-sky-deep hover:bg-sky hover:text-white transition-colors flex items-center justify-center"
                      title="Preview"
                    >
                      <Eye className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => handleReject(photo.id)}
                      className="w-8 h-8 rounded-lg bg-flyday-nogo/10 text-flyday-nogo hover:bg-flyday-nogo hover:text-white transition-colors flex items-center justify-center"
                      title="Reject"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ─── Public gallery ─── */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-xl flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-field-green" />
              Photo Gallery
            </h2>
            <span className="text-xs font-display font-bold bg-field-green/10 text-field-green px-2 py-1 rounded-full shrink-0">
              {recentPhotos.length} live
            </span>
          </div>
          <p className="text-sm text-ink-muted mb-4">
            Everything approved and visible on the Media page. Removing a photo here takes it off the
            public site immediately.
          </p>

          {recentPhotos.length === 0 ? (
            <div className="rounded-3xl bg-surface-muted p-6 text-center text-sm text-ink-muted">
              No photos in the gallery yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {recentPhotos.map((photo) => (
                <div key={photo.id} className="group relative">
                  <div className="aspect-square rounded-xl overflow-hidden border border-black/5 bg-surface-muted">
                    <img
                      src={`/api/photos/files/${encodeURIComponent(photo.id)}`}
                      alt={photo.caption || photo.filename}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <a
                      href={`/api/photos/files/${encodeURIComponent(photo.id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-lg bg-white/90 text-sky-deep hover:bg-white shadow flex items-center justify-center"
                      title="View full size"
                    >
                      <Eye className="w-4 h-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleRemoveFromGallery(photo)}
                      className="w-8 h-8 rounded-lg bg-white/90 text-flyday-nogo hover:bg-flyday-nogo hover:text-white shadow flex items-center justify-center"
                      title="Remove from gallery"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-ink-muted truncate" title={photo.caption || photo.filename}>
                    {photo.caption || photo.filename}
                  </p>
                  <p className="text-[11px] text-ink-light truncate">
                    by {photo.photographer} · {photo.date}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Contact Inbox ─── */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-xl flex items-center gap-2">
              <Mail className="w-5 h-5 text-sky-deep" />
              Inbox
            </h2>
            <span className="text-xs font-display font-bold bg-sky/10 text-sky-deep px-2 py-1 rounded-full shrink-0">
              {messages.filter((m) => m.status === 'unread').length} unread
            </span>
          </div>

          <div className="space-y-3">
            {messages.length === 0 ? (
              <div className="rounded-3xl bg-surface-muted p-6 text-center text-sm text-ink-muted">
                No messages from the contact form yet.
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-3xl border p-4 ${message.status === 'unread' ? 'border-sky/30 bg-sky/5' : 'border-black/10 bg-surface-card'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-ink truncate">{message.subject}</p>
                      <p className="text-xs text-ink-muted truncate">
                        {message.name} · <a href={`mailto:${message.email}`} className="text-field-green">{message.email}</a>
                      </p>
                    </div>
                    <span className="text-xs text-ink-light shrink-0">{formatTimestamp(message.submittedAt)}</span>
                  </div>
                  <p className="mt-3 text-sm text-ink-muted whitespace-pre-wrap">{message.message}</p>
                  <div className="mt-3 flex gap-2">
                    {message.status === 'unread' ? (
                      <button onClick={() => handleMessageAction(message.id, 'PATCH')} className="btn-secondary text-xs">
                        Mark read
                      </button>
                    ) : null}
                    <a href={`mailto:${message.email}?subject=Re: ${encodeURIComponent(message.subject)}`} className="btn-secondary text-xs">
                      Reply
                    </a>
                    <button
                      onClick={() => handleMessageAction(message.id, 'DELETE')}
                      className="inline-flex items-center gap-1 rounded-full bg-flyday-nogo/10 px-3 py-1 text-xs font-semibold text-flyday-nogo hover:bg-flyday-nogo/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ─── Lesson Requests ─── */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-xl flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-field-green" />
              Flying Lesson Requests
            </h2>
            <span className="text-xs font-display font-bold bg-field-green/10 text-field-green px-2 py-1 rounded-full shrink-0">
              {lessonRequests.filter((r) => r.status === 'new').length} new
            </span>
          </div>

          <div className="space-y-3">
            {lessonRequests.length === 0 ? (
              <div className="rounded-3xl bg-surface-muted p-6 text-center text-sm text-ink-muted">
                No lesson requests yet. The form is on the Membership page.
              </div>
            ) : (
              lessonRequests.map((lesson) => (
                <div
                  key={lesson.id}
                  className={`rounded-3xl border p-4 ${lesson.status === 'new' ? 'border-field-green/30 bg-field-green/5' : 'border-black/10 bg-surface-card'}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-ink">
                        {lesson.name}
                        <span className="ml-2 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                          {lesson.status}
                        </span>
                      </p>
                      <p className="text-xs text-ink-muted mt-1">
                        <a href={`mailto:${lesson.email}`} className="text-field-green">{lesson.email}</a>
                        {' · '}{lesson.phone}
                      </p>
                      <p className="text-xs text-ink-light mt-1">
                        Wants: {lesson.instructorName || 'any instructor'} · {lesson.experience}
                        {lesson.aircraft ? ` · flies ${lesson.aircraft}` : ''}
                      </p>
                    </div>
                    <span className="text-xs text-ink-light shrink-0">{formatTimestamp(lesson.submittedAt)}</span>
                  </div>

                  {lesson.availability ? (
                    <p className="mt-3 text-sm text-ink-muted"><strong>Available:</strong> {lesson.availability}</p>
                  ) : null}
                  {lesson.notes ? (
                    <p className="mt-1 text-sm text-ink-muted whitespace-pre-wrap">{lesson.notes}</p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {lesson.status !== 'scheduled' ? (
                      <button onClick={() => handleLessonAction(lesson.id, { status: 'scheduled' }, 'PATCH')} className="btn-secondary text-xs">
                        Mark scheduled
                      </button>
                    ) : null}
                    {lesson.status !== 'completed' ? (
                      <button onClick={() => handleLessonAction(lesson.id, { status: 'completed' }, 'PATCH')} className="btn-secondary text-xs">
                        Mark completed
                      </button>
                    ) : null}
                    <a
                      href={`mailto:${lesson.email}?subject=${encodeURIComponent('LHMAC flying lesson')}`}
                      className="btn-secondary text-xs"
                    >
                      Email
                    </a>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete the lesson request from ${lesson.name}?`)) {
                          handleLessonAction(lesson.id, {}, 'DELETE');
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-full bg-flyday-nogo/10 px-3 py-1 text-xs font-semibold text-flyday-nogo hover:bg-flyday-nogo/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ─── Member Management ─── */}
        <div className="card lg:col-span-2">
          <h2 className="font-display font-bold text-xl flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-field-green" />
            Member Roster
          </h2>

          {memberMessage ? <p className="mb-4 text-sm text-field-green">{memberMessage}</p> : null}
          {memberError ? <p className="mb-4 text-sm text-red-600">{memberError}</p> : null}

          {members.length === 0 ? (
            <div className="rounded-3xl bg-surface-muted p-6 text-center text-sm text-ink-muted">No members yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-ink-muted border-b border-black/10">
                    <th className="py-2 pr-4 font-display">Name</th>
                    <th className="py-2 pr-4 font-display">Username</th>
                    <th className="py-2 pr-4 font-display">Email</th>
                    <th className="py-2 pr-4 font-display">Phone</th>
                    <th className="py-2 pr-4 font-display">AMA</th>
                    <th className="py-2 pr-4 font-display">Role</th>
                    <th className="py-2 font-display">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => {
                    const isSelf = member.id === auth.currentUser?.id;
                    return (
                      <tr key={member.id} className="border-b border-black/5 align-top">
                        <td className="py-3 pr-4">
                          <span className="font-medium text-ink">{member.name}</span>
                          {isSelf ? <span className="ml-2 text-xs text-ink-light">(you)</span> : null}
                          {member.needsPasswordReset ? (
                            <span className="ml-2 rounded-full bg-flyday-maybe/10 px-2 py-0.5 text-[10px] font-semibold text-flyday-maybe whitespace-nowrap">
                              reset pending
                            </span>
                          ) : null}
                          {member.isInstructor ? (
                            <span className="ml-2 rounded-full bg-sky/10 px-2 py-0.5 text-[10px] font-semibold text-sky-deep whitespace-nowrap">
                              instructor
                            </span>
                          ) : null}
                          {member.officerTitle ? (
                            <span className="ml-2 rounded-full bg-field-green/10 px-2 py-0.5 text-[10px] font-semibold text-field-green whitespace-nowrap">
                              {member.officerTitle}
                            </span>
                          ) : null}
                          {member.address ? <p className="text-xs text-ink-light mt-1">{member.address}</p> : null}
                        </td>
                        <td className="py-3 pr-4 text-ink-muted">{member.username}</td>
                        <td className="py-3 pr-4 text-ink-muted">{member.email || '—'}</td>
                        <td className="py-3 pr-4 text-ink-muted">{member.phone || '—'}</td>
                        <td className="py-3 pr-4 text-ink-muted">{member.amaNumber || '—'}</td>
                        <td className="py-3 pr-4">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${member.role === 'admin' ? 'bg-field-green/10 text-field-green' : 'bg-surface-muted text-ink-muted'}`}>
                            {member.role}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => startEditMember(member)} className="btn-secondary text-xs">
                              <Pencil className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button
                              onClick={() => resetMemberPassword(member)}
                              className="inline-flex items-center gap-1 rounded-full bg-sky/10 px-3 py-1 text-xs font-semibold text-sky-deep hover:bg-sky/20"
                              title="Issue a temporary password"
                            >
                              <KeyRound className="w-3.5 h-3.5" /> Reset password
                            </button>
                            {!isSelf ? (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Remove ${member.name}? This deletes their login.`)) {
                                    handleMemberAction(member.id, { id: member.id }, 'DELETE');
                                  }
                                }}
                                className="inline-flex items-center gap-1 rounded-full bg-flyday-nogo/10 px-3 py-1 text-xs font-semibold text-flyday-nogo hover:bg-flyday-nogo/20"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Remove
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-4 text-xs text-ink-light">
            Approved applicants get a generated username and a random one-time password, emailed to them, which they must
            change on first sign-in. Use <strong>Reset password</strong> to issue that temporary password again if a member is
            locked out.
          </p>
        </div>
      </div>

      {/* ─── Edit member modal ─── */}
      {editingMemberId && memberDraft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-black/40">
          <form
            onSubmit={saveMember}
            className="w-full max-w-2xl rounded-[32px] border border-black/10 bg-white p-6 shadow-2xl max-h-full overflow-y-auto"
          >
            <div className="flex items-center justify-between gap-4 mb-6">
              <h3 className="font-display font-bold text-xl">Edit Member</h3>
              <button
                type="button"
                onClick={() => setEditingMemberId(null)}
                className="text-xs uppercase tracking-[0.2em] text-ink-muted"
              >
                Cancel
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-ink">Full name</span>
                <input
                  value={memberDraft.name}
                  onChange={(event) => setMemberDraft({ ...memberDraft, name: event.target.value })}
                  className={`mt-2 ${memberInputClass}`}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink">Username</span>
                <input
                  value={memberDraft.username}
                  onChange={(event) => setMemberDraft({ ...memberDraft, username: event.target.value })}
                  className={`mt-2 ${memberInputClass}`}
                />
                <span className="text-xs text-ink-light mt-1 block">
                  Letters, numbers, dot, dash, underscore. Changing this changes how they sign in.
                </span>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink">Email</span>
                <input
                  type="email"
                  value={memberDraft.email}
                  onChange={(event) => setMemberDraft({ ...memberDraft, email: event.target.value })}
                  className={`mt-2 ${memberInputClass}`}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink">Phone</span>
                <input
                  value={memberDraft.phone}
                  onChange={(event) => setMemberDraft({ ...memberDraft, phone: event.target.value })}
                  className={`mt-2 ${memberInputClass}`}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-ink">Address</span>
                <input
                  value={memberDraft.address}
                  onChange={(event) => setMemberDraft({ ...memberDraft, address: event.target.value })}
                  className={`mt-2 ${memberInputClass}`}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink">AMA number</span>
                <input
                  value={memberDraft.amaNumber}
                  onChange={(event) => setMemberDraft({ ...memberDraft, amaNumber: event.target.value })}
                  className={`mt-2 ${memberInputClass}`}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink">Role</span>
                <select
                  value={memberDraft.role}
                  onChange={(event) => setMemberDraft({ ...memberDraft, role: event.target.value })}
                  disabled={editingMemberId === auth.currentUser?.id}
                  className={`mt-2 ${memberInputClass} disabled:opacity-60`}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                {editingMemberId === auth.currentUser?.id ? (
                  <span className="text-xs text-ink-light mt-1 block">
                    You cannot change your own role.
                  </span>
                ) : (
                  <span className="text-xs text-ink-light mt-1 block">
                    Admins can manage every member, event, and photo.
                  </span>
                )}
              </label>

              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-ink">Club officer title</span>
                <select
                  value={memberDraft.officerTitle}
                  onChange={(event) => setMemberDraft({ ...memberDraft, officerTitle: event.target.value })}
                  className={`mt-2 ${memberInputClass}`}
                >
                  <option value="">Not an officer</option>
                  {OFFICER_TITLES.map((title) => (
                    <option key={title} value={title}>{title}</option>
                  ))}
                </select>
                <span className="text-xs text-ink-light mt-1 block">
                  Officers are listed publicly on the About page with their name and email.
                </span>
              </label>

              <div className="sm:col-span-2 rounded-3xl border border-black/10 bg-surface-card p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={memberDraft.isInstructor}
                    onChange={(event) => setMemberDraft({ ...memberDraft, isInstructor: event.target.checked })}
                    className="w-4 h-4 accent-field-green"
                  />
                  <span className="text-sm font-medium text-ink">Flight instructor</span>
                </label>
                <p className="text-xs text-ink-light mt-1 ml-7">
                  Instructors appear as a choice on the lesson request form. Only their name and the note below
                  are shown publicly — never their contact details.
                </p>
                {memberDraft.isInstructor ? (
                  <input
                    value={memberDraft.instructorNote}
                    onChange={(event) => setMemberDraft({ ...memberDraft, instructorNote: event.target.value })}
                    placeholder="Short public blurb, e.g. Trainers and warbirds, weekend mornings"
                    className={`mt-3 ${memberInputClass}`}
                  />
                ) : null}
              </div>
            </div>

            {memberError ? <p className="mt-4 text-sm text-red-600">{memberError}</p> : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setEditingMemberId(null)}
                className="rounded-3xl border border-black/10 bg-surface-card px-5 py-3 text-sm font-medium text-ink transition hover:bg-surface-muted"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary rounded-3xl px-5 py-3 text-sm font-medium">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </PageShell>
  );
}
