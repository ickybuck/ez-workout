import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { supabase } from '../lib/supabase';

/**
 * Where a reset email's link lands (EZ-49).
 *
 * The link used to point straight at Supabase's /auth/v1/verify, which spends
 * the one-time token the moment anything requests the URL. Mail scanners do
 * exactly that: on 2026-11-21 a scanner presenting a made-up "Chrome/158"
 * user agent opened Marilyn's reset link eight seconds after it was sent,
 * signed itself in with it, and her own click three seconds later found the
 * token already spent.
 *
 * Now the email links here, carrying the token_hash, and nothing is spent
 * until a person presses Continue. Scanners fetch pages; they do not press
 * buttons. On success Supabase emits PASSWORD_RECOVERY, AuthContext sets
 * `recovering`, and routes/index.tsx swaps in the "Choose a new password"
 * screen — the same one the older link shape lands on.
 */
const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tokenHash = params.get('token_hash');
  const type = params.get('type');
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState<string | null>(
    tokenHash && type === 'recovery' ? null : 'This reset link is incomplete.',
  );

  const handleContinue = async () => {
    if (!tokenHash) return;
    setWorking(true);
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
    setWorking(false);
    if (error) {
      // The usual cause is a newer reset request, which invalidates every
      // earlier link, or the link being more than a day old.
      setFailed('This reset link has expired or was replaced by a newer one. Only the most recent reset email works.');
    }
    // On success there is nothing to do here: the recovery event replaces
    // this page with the set-password screen.
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="max-w-md w-full space-y-8 p-8 bg-surface-raised rounded-lg shadow-md">
        <div className="text-center">
          <KeyRound className="mx-auto h-12 w-12 text-accent" />
          <h2 className="mt-6 text-3xl font-bold text-content">Reset your password</h2>
        </div>

        {failed ? (
          <>
            <p role="alert" className="text-sm text-content bg-surface border border-edge-strong rounded-md p-3">
              {failed}
            </p>
            <button
              type="button"
              onClick={() => navigate('/login', { state: { forgotPassword: true } })}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-content-inverse bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent"
            >
              Send a new reset email
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-content-muted text-center">
              Press Continue to choose a new password.
            </p>
            <button
              type="button"
              onClick={handleContinue}
              disabled={working}
              autoFocus
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-content-inverse bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50"
            >
              {working ? 'Checking the link…' : 'Continue'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
