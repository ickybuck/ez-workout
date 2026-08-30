import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Shield, Trash2, Plus, Download, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useAdminStatus, invalidateAdminStatus } from '../hooks/useAdminStatus';
import { Navigate } from 'react-router-dom';
import { exportExercises } from '../lib/exerciseExport';
import { importExercises } from '../lib/exerciseImport';

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  is_admin: boolean;
}

const Admin: React.FC = () => {
  const { user } = useAuth();
  const { isAdmin, loading } = useAdminStatus();
  const [settingAsDefault, setSettingAsDefault] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [exportingExercises, setExportingExercises] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdmin) {
      loadAdminUsers();
    }
  }, [isAdmin]);

  const loadAdminUsers = async () => {
    try {
      // One call, and it returns every account with its admin state. The
      // previous version joined list_users against user_settings under a
      // SELECT policy scoped to the caller's own row, so the list could only
      // ever contain you (EZ-02).
      const { data, error } = await supabase.rpc('admin_list_users');
      if (error) throw error;
      setAdminUsers(data ?? []);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoadingAdmins(false);
    }
  };

  const addAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim()) return;

    setAddingAdmin(true);
    try {
      // Returns the number of rows changed, so "already an admin" is
      // distinguishable from "granted". The old version updated another
      // user's row, matched zero under RLS, and reported success regardless.
      const { data: granted, error } = await supabase.rpc('admin_grant', {
        target_email: newAdminEmail.trim(),
      });

      if (error) throw error;

      toast.success(granted ? 'Admin access granted' : 'That account is already an admin');
      setNewAdminEmail('');
      invalidateAdminStatus();
      await loadAdminUsers();
    } catch (error) {
      console.error('Error granting admin:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to grant admin access');
    } finally {
      setAddingAdmin(false);
    }
  };

  const removeAdmin = async (adminId: string) => {
    if (!confirm('Remove admin access for this user?')) return;

    try {
      // Refusing to remove yourself, and refusing to remove the last admin,
      // are both enforced in the function as well as here — an app with no
      // administrator has no way back short of direct database access.
      const { error } = await supabase.rpc('admin_revoke', { target_user_id: adminId });
      if (error) throw error;

      toast.success('Admin access removed');
      invalidateAdminStatus();
      await loadAdminUsers();
    } catch (error) {
      console.error('Error revoking admin:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to remove admin access');
    }
  };

  const setAsDefault = async () => {
    if (!user || !isAdmin) return;
    setSettingAsDefault(true);

    try {
      // No argument any more: the function acts on its caller. It used to
      // take a uuid and check whether THAT id was an admin, never the caller
      // (EZ-27).
      const { error } = await supabase.rpc('set_user_data_as_default');

      if (error) throw error;

      toast.success('Your data has been set as the default template for new users');
    } catch (error) {
      console.error('Error setting default template:', error);
      toast.error('Failed to set default template');
    } finally {
      setSettingAsDefault(false);
    }
  };

  const handleExport = async () => {
    setExportingExercises(true);
    await exportExercises();
    setExportingExercises(false);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv') {
      toast.error('Please select a CSV file');
      return;
    }

    setImporting(true);
    await importExercises(file);
    setImporting(false);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="py-8">
      <div className="bg-surface-raised rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-8 w-8 text-accent" />
          <h2 className="text-2xl font-bold text-content">Admin Settings</h2>
        </div>

        <div className="space-y-6">
          {/* Exercise Management */}
          <div className="border-b pb-6">
            <h3 className="text-lg font-medium text-content mb-4">Exercise Management</h3>
            <div className="flex gap-4">
              <button
                onClick={handleExport}
                disabled={exportingExercises}
                className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-content-inverse bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50"
              >
                <Download className="h-4 w-4 mr-2" />
                {exportingExercises ? 'Exporting...' : 'Export Exercises'}
              </button>

              <div className="relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  className="hidden"
                  disabled={importing}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-content-inverse bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {importing ? 'Importing...' : 'Import Exercises'}
                </button>
              </div>
            </div>
            <p className="mt-2 text-sm text-content-subtle">
              Export exercises to CSV, make changes, then import the updated file.
            </p>
          </div>

          {/* Admin Users Section */}
          <div className="border-b pb-6">
            <h3 className="text-lg font-medium text-content mb-4">Accounts</h3>
            
            {/* Add Admin Form */}
            <form onSubmit={addAdmin} className="mb-6">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="flex-1 rounded-md border-edge-strong shadow-sm focus:border-accent focus:ring-accent"
                />
                <button
                  type="submit"
                  disabled={addingAdmin || !newAdminEmail.trim()}
                  className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-content-inverse bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Admin
                </button>
              </div>
            </form>

            {/* Admin Users List */}
            <div className="space-y-2">
              {loadingAdmins ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-accent mx-auto"></div>
                </div>
              ) : adminUsers.length === 0 ? (
                <p className="text-content-subtle text-center py-4">No accounts found</p>
              ) : (
                adminUsers.map(account => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between py-2 px-3 bg-surface rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-content flex items-center gap-2">
                        {account.email}
                        {account.is_admin && (
                          <span className="text-xs px-2 py-0.5 bg-accent-soft text-accent-content rounded">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-content-subtle">
                        Joined {new Date(account.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    {account.is_admin && (
                      <button
                        onClick={() => removeAdmin(account.id)}
                        disabled={account.id === user?.id}
                        className="p-1.5 text-content-subtle hover:text-critical hover:bg-critical-soft rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                        title={account.id === user?.id ? "You can't remove yourself" : 'Remove admin access'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Default Template Settings */}
          <div>
            <h3 className="text-lg font-medium text-content mb-2">Default Template Settings</h3>
            <button
              onClick={setAsDefault}
              disabled={settingAsDefault}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-content-inverse bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50"
            >
              {settingAsDefault ? 'Setting as Default...' : 'Set My Data as Default Template'}
            </button>
            <p className="mt-2 text-sm text-content-subtle">
              This will use your current exercises, settings, and templates as the default for all new users.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;