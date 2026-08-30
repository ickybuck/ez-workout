import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { LogIn } from 'lucide-react';
import { SIGNUPS_ENABLED } from '../config';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [sendingReset, setSendingReset] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success('Successfully logged in!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resetEmail) {
      toast.error('Please enter your email address');
      return;
    }

    setSendingReset(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/login`,
      });

      if (error) throw error;

      toast.success('Password reset email sent! Check your inbox.');
      setShowForgotPassword(false);
      setResetEmail('');
    } catch (error) {
      console.error('Error sending reset email:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send reset email');
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="max-w-md w-full space-y-8 p-8 bg-surface-raised rounded-lg shadow-md">
        <div className="text-center">
          <LogIn className="mx-auto h-12 w-12 text-accent" />
          <h2 className="mt-6 text-3xl font-bold text-content">
            {showForgotPassword ? 'Reset Password' : 'Sign in to your account'}
          </h2>
        </div>

        {!showForgotPassword ? (
          <>
            <form className="mt-8 space-y-6" onSubmit={handleLogin}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-content-muted">
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-edge-strong rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-content-muted">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-edge-strong rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent"
                  />
                  <div className="mt-2 text-right">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-sm font-medium text-accent hover:text-accent"
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-content-inverse bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50"
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
              </div>
            </form>

            {SIGNUPS_ENABLED && (
              <div className="text-center mt-4">
                <p className="text-sm text-content-muted">
                  Don't have an account?{' '}
                  <Link to="/register" className="font-medium text-accent hover:text-accent">
                    Sign up
                  </Link>
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <form className="mt-8 space-y-6" onSubmit={handleForgotPassword}>
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-content-muted">
                  Email address
                </label>
                <input
                  id="reset-email"
                  name="reset-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="mt-1 block w-full px-3 py-2 border border-edge-strong rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent"
                />
                <p className="mt-2 text-sm text-content-subtle">
                  We'll send you an email with instructions to reset your password.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetEmail('');
                  }}
                  className="flex-1 py-2 px-4 border border-edge-strong rounded-md shadow-sm text-sm font-medium text-content-muted bg-surface-raised hover:bg-surface focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingReset}
                  className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-content-inverse bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50"
                >
                  {sendingReset ? 'Sending...' : 'Send Reset Email'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default Login;