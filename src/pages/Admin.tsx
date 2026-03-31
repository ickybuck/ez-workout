import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Shield, Trash2, Plus, Download, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useAdminStatus } from '../hooks/useAdminStatus';
import { Navigate } from 'react-router-dom';
import { exportExercises } from '../lib/exerciseExport';
import { importExercises } from '../lib/exerciseImport';

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
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
      // First get all users
      const { data: allUsers, error: usersError } = await supabase
        .rpc('list_users');

      if (usersError) throw usersError;

      // Then get admin settings
      const { data: adminSettings, error: settingsError } = await supabase
        .from('user_settings')
        .select('user_id')
        .eq('is_admin', true);

      if (settingsError) throw settingsError;

      // Filter users to only include admins
      const adminIds = new Set(adminSettings.map(setting => setting.user_id));
      const adminUsers = allUsers.filter(user => adminIds.has(user.id));

      setAdminUsers(adminUsers);
    } catch (error) {
      console.error('Error loading admin users:', error);
      toast.error('Failed to load admin users');
    } finally {
      setLoadingAdmins(false);
    }
  };

  const addAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim()) return;

    setAddingAdmin(true);
    try {
      // Get user details by email
      const { data: users, error: usersError } = await supabase
        .rpc('get_user_details', { user_email: newAdminEmail.trim() });

      if (usersError) throw usersError;
      if (!users?.length) {
        toast.error('User not found');
        return;
      }

      // Update user settings to make them an admin
      const { error: updateError } = await supabase
        .from('user_settings')
        .update({ is_admin: true })
        .eq('user_id', users[0].id);

      if (updateError) throw updateError;

      toast.success('Admin user added successfully');
      setNewAdminEmail('');
      loadAdminUsers();
    } catch (error) {
      console.error('Error adding admin:', error);
      toast.error('Failed to add admin user');
    } finally {
      setAddingAdmin(false);
    }
  };

  const removeAdmin = async (adminId: string) => {
    if (!confirm('Are you sure you want to remove this admin?')) return;

    // Don't allow removing yourself
    if (adminId === user?.id) {
      toast.error('You cannot remove yourself as an admin');
      return;
    }

    try {
      const { error } = await supabase
        .from('user_settings')
        .update({ is_admin: false })
        .eq('user_id', adminId);

      if (error) throw error;

      toast.success('Admin removed successfully');
      setAdminUsers(adminUsers.filter(admin => admin.id !== adminId));
    } catch (error) {
      console.error('Error removing admin:', error);
      toast.error('Failed to remove admin');
    }
  };

  const setAsDefault = async () => {
    if (!user || !isAdmin) return;
    setSettingAsDefault(true);

    try {
      const { error } = await supabase.rpc('set_user_data_as_default', {
        admin_user_id: user.id,
      });

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
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="py-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-8 w-8 text-indigo-600" />
          <h2 className="text-2xl font-bold text-gray-900">Admin Settings</h2>
        </div>

        <div className="space-y-6">
          {/* Exercise Management */}
          <div className="border-b pb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Exercise Management</h3>
            <div className="flex gap-4">
              <button
                onClick={handleExport}
                disabled={exportingExercises}
                className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
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
                  className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {importing ? 'Importing...' : 'Import Exercises'}
                </button>
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Export exercises to CSV, make changes, then import the updated file.
            </p>
          </div>

          {/* Admin Users Section */}
          <div className="border-b pb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Admin Users</h3>
            
            {/* Add Admin Form */}
            <form onSubmit={addAdmin} className="mb-6">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={addingAdmin || !newAdminEmail.trim()}
                  className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
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
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-600 mx-auto"></div>
                </div>
              ) : adminUsers.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No admin users found</p>
              ) : (
                adminUsers.map(admin => (
                  <div
                    key={admin.id}
                    className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{admin.email}</div>
                      <div className="text-sm text-gray-500">
                        Added {new Date(admin.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => removeAdmin(admin.id)}
                      disabled={admin.id === user?.id}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                      title={admin.id === user?.id ? "You can't remove yourself" : "Remove admin"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Default Template Settings */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Default Template Settings</h3>
            <button
              onClick={setAsDefault}
              disabled={settingAsDefault}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {settingAsDefault ? 'Setting as Default...' : 'Set My Data as Default Template'}
            </button>
            <p className="mt-2 text-sm text-gray-500">
              This will use your current exercises, settings, and templates as the default for all new users.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;