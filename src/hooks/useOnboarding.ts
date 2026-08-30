import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export type OnboardingStatus = 'loading' | 'needed' | 'done';

/**
 * Whether this account has been through first-run setup.
 *
 * Reads `user_settings.onboarded_at` rather than inferring from the shape of
 * the settings row. A missing row means "has never saved a setting", which is
 * not the same question — someone could finish the flow, and someone else
 * could have a row written by a stray save without ever seeing it.
 *
 * Fails OPEN: any error resolves to 'done'. Getting this wrong in the other
 * direction puts a setup wizard in front of a user with three years of history
 * every time the network hiccups, which is far worse than a new user missing
 * the flow and finding the same settings in Settings.
 */
export function useOnboarding() {
  const { user } = useAuth();
  const [status, setStatus] = useState<OnboardingStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('onboarded_at')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        if (!cancelled) setStatus(data?.onboarded_at ? 'done' : 'needed');
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        if (!cancelled) setStatus('done');
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, [user]);

  /** Called by the flow itself once setup has been saved. */
  const markDone = useCallback(() => setStatus('done'), []);

  return { status, markDone };
}
