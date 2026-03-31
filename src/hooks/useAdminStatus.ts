import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useState, useEffect } from 'react';
import { supabase, checkSupabaseConnection } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

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
    }
  )
);

const MAX_RETRIES = 3;
const RETRY_DELAY = 3000; // 3 seconds

export const useAdminStatus = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showAdminTools, setShowAdminTools } = useAdminStatusStore();

  useEffect(() => {
    let retryCount = 0;
    let retryTimeout: number;

    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        setError(null);
        return;
      }

      try {
        // First check if Supabase is accessible
        const isConnected = await checkSupabaseConnection();
        if (!isConnected) {
          throw new Error('Unable to connect to Supabase');
        }

        const { data, error: supabaseError } = await supabase
          .from('user_settings')
          .select('is_admin')
          .eq('user_id', user.id)
          .maybeSingle();

        if (supabaseError) throw supabaseError;
        
        setIsAdmin(data?.is_admin || false);
        setError(null);
        retryCount = 0; // Reset retry count on success
      } catch (error) {
        console.error('Error checking admin status:', error);
        
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          console.log(`Retrying admin status check (attempt ${retryCount}/${MAX_RETRIES})...`);
          retryTimeout = window.setTimeout(checkAdminStatus, RETRY_DELAY);
          setError(`Connection error. Retrying... (${retryCount}/${MAX_RETRIES})`);
        } else {
          setError('Failed to check admin status after multiple attempts');
          setIsAdmin(false);
        }
      } finally {
        if (retryCount >= MAX_RETRIES || !error) {
          setLoading(false);
        }
      }
    };

    checkAdminStatus();

    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
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