'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';
import { useAuth } from '@/components/AuthProvider';
import { readError } from '@/lib/apiClient';
import { Users, Pencil, KeyRound, Trash2, ShieldCheck } from 'lucide-react';
import { OFFICER_TITLES } from '@/lib/clubConstants';

const memberInputClass =
  'w-full rounded-3xl border border-black/10 bg-surface-card px-4 py-3 text-sm outline-none focus:border-field-green focus:ring-2 focus:ring-field-green/10';

function formatTimestamp(value) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('default', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function Page() {
  const auth = useAuth();
  const [members, setMembers] = useState([]);
  const [counts, setCounts] = useState(null);
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [memberDraft, setMemberDraft] = useState(null);
  const [memberError, setMemberError] = useState('');
  const [memberMessage, setMemberMessage] = useState('');

  const refreshAdminData = useCallback(async () => {
    const res = await fetch('/api/members', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members ?? []);
      setCounts(data.counts ?? null);
    }
  }, []);

  useEffect(() => {
    if (auth.isAdmin) refreshAdminData();
  }, [auth.isAdmin, refreshAdminData]);

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

  const saveMember = async (event) => {
    event.preventDefault();
    const saved = await handleMemberAction(editingMemberId, { id: editingMemberId, ...memberDraft }, 'PATCH');
    if (saved) {
      setEditingMemberId(null);
      setMemberMessage('Member updated.');
    }
  };

  return (
    <AdminShell title="Members" subtitle="Roster, roles, officers and instructors">
      <>

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
      </>
    </AdminShell>
  );
}
