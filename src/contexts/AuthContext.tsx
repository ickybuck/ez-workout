import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { arrivedFromRecoveryLink, supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  /**
   * True from the moment someone lands from a password-reset link until they
   * have chosen a new password. While it is true the app shows the
   * set-password screen in place of every route (EZ-48).
   */
  recovering: boolean;
  endRecovery: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  recovering: false,
  endRecovery: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Seeded from the URL as it was before the Supabase client wiped it. The
  // PASSWORD_RECOVERY event below is the second route in, not the only one:
  // it fires from a setTimeout during client start-up and can come and go
  // before this effect subscribes.
  const [recovering, setRecovering] = useState(arrivedFromRecoveryLink);

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const endRecovery = useCallback(() => setRecovering(false), []);

  return (
    <AuthContext.Provider value={{ user, loading, recovering, endRecovery }}>
      {children}
    </AuthContext.Provider>
  );
};
