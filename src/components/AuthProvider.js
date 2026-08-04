'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { readError } from '@/lib/apiClient';

const initialApplications = [];

const AuthContext = createContext(null);

async function fetchJson(url, options = {}) {
  const res = await fetch(url, { cache: 'no-store', ...options });
  if (!res.ok) {
    throw new Error(await readError(res, 'Network error'));
  }
  return res.json();
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [pendingReset, setPendingReset] = useState(false);
  const [pendingApplications, setPendingApplications] = useState(initialApplications);
  const [authLoaded, setAuthLoaded] = useState(false);

  const refreshApplications = async () => {
    try {
      const applicationData = await fetchJson('/api/membership/requests');
      setPendingApplications(applicationData.applications ?? []);
    } catch {
      // Non-admins get a 403 here, which is expected; keep the list empty.
      setPendingApplications(initialApplications);
    }
  };

  useEffect(() => {
    const loadAuthState = async () => {
      try {
        const sessionData = await fetchJson('/api/auth/session');
        setCurrentUser(sessionData?.user ?? null);
        setPendingReset(Boolean(sessionData?.pendingReset));
      } catch {
        // ignore failures while loading the session
      }
      setAuthLoaded(true);
    };

    loadAuthState();
  }, []);

  // The applications list is admin-only, so only fetch it once we know who is
  // signed in — otherwise every visitor triggers a 403 on page load.
  useEffect(() => {
    if (currentUser?.role === 'admin') {
      refreshApplications();
    } else {
      setPendingApplications(initialApplications);
    }
  }, [currentUser]);

  const login = async (username, password) => {
    try {
      const result = await fetchJson('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (result.needsPasswordReset) {
        setPendingReset(true);
        return { needsPasswordReset: true };
      }

      // Confirm the session cookie actually stuck before showing a signed-in UI.
      // Trusting the login response alone means a dropped cookie leaves the nav
      // claiming you are signed in while every API call goes out anonymous.
      const session = await fetchJson('/api/auth/session');
      if (!session?.user) {
        return {
          error:
            'Signed in, but your browser did not keep the session cookie. Check that cookies are enabled for this site.',
        };
      }

      setCurrentUser(session.user);
      setPendingReset(false);
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore network failures during logout
    }
    setCurrentUser(null);
    setPendingReset(false);
  };

  // The account being reset is identified by the session cookie, so this still
  // works after a refresh or a direct visit to /reset-password/.
  const resetPassword = async (password) => {
    try {
      const result = await fetchJson('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      setCurrentUser(result.user);
      setPendingReset(false);
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  };

  const submitMemberApplication = async (application) => {
    try {
      await fetchJson('/api/membership/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(application),
      });
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  };

  const approveApplication = async (applicationId) => {
    try {
      const data = await fetchJson('/api/membership/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: applicationId, action: 'approve' }),
      });
      await refreshApplications();
      return {
        success: true,
        user: data.result?.user,
        email: data.result?.email,
        // Present only when the welcome email could not be sent.
        temporaryPassword: data.result?.temporaryPassword,
      };
    } catch (error) {
      return { error: error.message };
    }
  };

  const rejectApplication = async (applicationId) => {
    try {
      await fetchJson('/api/membership/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: applicationId, action: 'reject' }),
      });
      await refreshApplications();
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  };

  const auth = useMemo(
    () => ({
      currentUser,
      pendingReset,
      pendingApplications,
      authLoaded,
      isAuthenticated: Boolean(currentUser),
      isAdmin: currentUser?.role === 'admin',
      login,
      logout,
      resetPassword,
      submitMemberApplication,
      approveApplication,
      rejectApplication,
      refreshApplications,
    }),
    [currentUser, pendingReset, pendingApplications, authLoaded]
  );

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
