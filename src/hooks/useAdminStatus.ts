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

async function fetchIsAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('is_admin')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data?.is_admin ?? false;
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
      .get(user.id, () => fetchIsAdmin(user.id))
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
