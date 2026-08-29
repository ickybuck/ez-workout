import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { createQueryCache } from '../lib/queryCache';

interface AdminStatusStore {
  showAdminTools: boolean;
  setShowAdminTools: (show: boolean) => void;
}

const useAdminStatusStore = create<AdminStatusStore>()(
  persist(
    (set) => ({
      showAdminTools: true,
      setShowAdminTools: (show) => set({ showAdminTools: show }),
    }),
    {
      name: 'admin-tools-storage',
    },
  ),
);

/**
 * Shared across every consumer of this hook.
 *
 * Four components use it — DashboardLayout, ExerciseLibraryV2, Settings and
 * Admin — and several are mounted together. Each previously ran its own
 * connection probe and its own query, with a three-attempt retry loop on top,
 * which is why the console filled with repeated "Successfully connected to
 * Supabase" lines on an ordinary page load.
 *
 * Whether someone is an admin changes about never, so a shared cache with
 * in-flight de-duplication is the whole fix: one query per session.
 */
const adminCache = createQueryCache<boolean>({ ttlMs: 10 * 60_000 });

async function fetchIsAdmin(): Promise<boolean> {
  // Asks the database rather than reading a column. is_admin() is the same
  // predicate every RLS policy uses, so the client and the database can never
  // disagree about who is an admin — which they did while this read
  // user_settings.is_admin and the policies read something else.
  const { data, error } = await supabase.rpc('is_admin');
  if (error) throw error;
  return data ?? false;
}

/** Call after granting or revoking admin, so the next read is fresh. */
export function invalidateAdminStatus(): void {
  adminCache.invalidate();
}

export const useAdminStatus = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showAdminTools, setShowAdminTools } = useAdminStatusStore();

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    adminCache
      .get(user.id, () => fetchIsAdmin())
      .then((result) => {
        if (cancelled) return;
        setIsAdmin(result);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        // Failing closed is the safe direction: a network error must not
        // surface admin controls, and the cache drops the failed entry so the
        // next mount retries rather than inheriting the rejection.
        console.error('Error checking admin status:', e);
        setIsAdmin(false);
        setError('Could not check admin status');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  return {
    isAdmin,
    loading,
    error,
    showAdminTools,
    setShowAdminTools,
  };
};
