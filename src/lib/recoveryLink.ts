/*
 * Reading what a password-reset link left in the URL (EZ-48).
 *
 * A reset email's link goes through Supabase's /auth/v1/verify, which
 * redirects here with the outcome in the URL fragment:
 *
 *   success  #access_token=…&refresh_token=…&type=recovery
 *   failure  #error=access_denied&error_code=otp_expired&error_description=…
 *
 * Both have to be read before the Supabase client is created. With
 * detectSessionInUrl on, the client consumes the fragment during start-up and
 * wipes it with history.replaceState, and it announces PASSWORD_RECOVERY from
 * a setTimeout — so a listener registered by a React effect can arrive after
 * the event has already fired, and there is nothing left in the URL to check.
 * src/lib/supabase.ts calls these at module load for that reason.
 */

function fragmentParams(hash: string): URLSearchParams {
  return new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
}

/** True when the URL fragment is a successful password-recovery landing. */
export function isRecoveryHash(hash: string): boolean {
  return fragmentParams(hash).get('type') === 'recovery';
}

/**
 * What to tell someone whose reset link failed, or null if it did not.
 *
 * otp_expired is by far the common case, and Supabase's own wording ("Email
 * link is invalid or has expired") hides the usual cause: every new reset
 * request invalidates the links in earlier emails, and Gmail threads them all
 * under one subject, so people click an older one.
 */
export function recoveryLinkError(hash: string): string | null {
  const params = fragmentParams(hash);
  const code = params.get('error_code');
  if (!code && !params.get('error')) return null;

  if (code === 'otp_expired') {
    return 'That reset link has expired or was replaced by a newer one. Only the most recent reset email works — request a new one below.';
  }
  return params.get('error_description') ?? 'That link did not work. Request a new reset email below.';
}
