import React, { useState } from 'react';
import { ChevronDown, ChevronUp, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface AccountSecuritySectionProps {
  expanded: boolean;
  onToggle: () => void;
  userEmail: string | undefined;
}

const AccountSecuritySection: React.FC<AccountSecuritySectionProps> = ({
  expanded,
  onToggle,
  userEmail,
}) => {
  const navigate = useNavigate();
  const [newEmail, setNewEmail] = useState('');
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) {
      toast.error('Please enter a new email address');
      return;
    }

    setUpdatingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      toast.success('Email update initiated! Please check your new email for confirmation.');
      setNewEmail('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update email');
    } finally {
      setUpdatingEmail(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Logged out successfully');
      navigate('/login');
    } catch {
      toast.error('Failed to log out');
    }
  };

  return (
    <div className="pt-6 border-t">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left"
      >
        <h3 className="text-lg font-medium text-content">Account Security</h3>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-content-subtle" />
        ) : (
          <ChevronDown className="h-5 w-5 text-content-subtle" />
        )}
      </button>

      {expanded && (
        <div className="mt-4 space-y-6">
          <div>
            <h4 className="text-sm font-medium text-content mb-2">Update Email</h4>
            <p className="text-xs text-content-subtle mb-3">Current email: {userEmail}</p>
            <form onSubmit={handleUpdateEmail} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-content-muted">New Email Address</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Enter new email"
                  className="mt-1 block w-full rounded-md border-edge-strong shadow-sm focus:ring-accent focus:border-accent"
                />
              </div>
              <button
                type="submit"
                disabled={updatingEmail}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-content-inverse bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50"
              >
                {updatingEmail ? 'Updating...' : 'Update Email'}
              </button>
            </form>
          </div>

          <div>
            <h4 className="text-sm font-medium text-content mb-2">Update Password</h4>
            <form onSubmit={handleUpdatePassword} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-content-muted">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="mt-1 block w-full rounded-md border-edge-strong shadow-sm focus:ring-accent focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-content-muted">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="mt-1 block w-full rounded-md border-edge-strong shadow-sm focus:ring-accent focus:border-accent"
                />
              </div>
              <button
                type="submit"
                disabled={updatingPassword}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-content-inverse bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50"
              >
                {updatingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>

          <div className="pt-4 border-t">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-critical rounded-md shadow-sm text-sm font-medium text-critical bg-surface-raised hover:bg-critical-soft focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-critical"
            >
              <LogOut className="h-4 w-4" />
              Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountSecuritySection;
