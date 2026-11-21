import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * Where a password-reset link lands (EZ-48).
 *
 * Before this existed, the link signed the person in and then showed them the
 * ordinary sign-in form, which asks for the very password they had forgotten.
 * Nothing on screen said they were already signed in or that the place to set
 * a password was Settings > Account security.
 *
 * Rendered by routes/index.tsx in place of every route while
 * AuthContext.recovering is true, so it does not matter which path the
 * redirect lands on.
 */
const SetNewPassword: React.FC = () => {
  const navigate = useNavigate();
  const { user, endRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Same rules as Settings > Account security, so the two never disagree.
    if (password !== confirm) {
      toast.error('The two passwords do not match');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success('Password set. You are signed in.');
      endRecovery();
      navigate('/dashboard', { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not set the password');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    endRecovery();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="max-w-md w-full space-y-8 p-8 bg-surface-raised rounded-lg shadow-md">
        <div className="text-center">
          <KeyRound className="mx-auto h-12 w-12 text-accent" />
          <h2 className="mt-6 text-3xl font-bold text-content">Choose a new password</h2>
          {user?.email && (
            <p className="mt-2 text-sm text-content-muted">for {user.email}</p>
          )}
        </div>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-content-muted">
              New password
            </label>
            <input
              id="new-password"
              name="new-password"
              type="password"
              autoComplete="new-password"
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-edge-strong rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-content-muted">
              Type it again
            </label>
            <input
              id="confirm-password"
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-edge-strong rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-content-inverse bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Set password'}
          </button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={handleSignOut}
            className="text-sm text-content-muted hover:text-content"
          >
            Not you? Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default SetNewPassword;
