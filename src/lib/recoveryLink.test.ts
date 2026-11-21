import { describe, expect, it } from 'vitest';
import { isRecoveryHash, recoveryLinkError } from './recoveryLink';

// The real redirect Supabase produced for this project on 2026-11-21, tokens
// replaced.
const RECOVERY =
  '#access_token=AAA&expires_at=1795286727&expires_in=3600&refresh_token=BBB&sb=&token_type=bearer&type=recovery';
const EXPIRED =
  '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=';

describe('isRecoveryHash', () => {
  it('recognises a successful recovery landing', () => {
    expect(isRecoveryHash(RECOVERY)).toBe(true);
  });

  it('accepts the fragment with or without its leading #', () => {
    expect(isRecoveryHash(RECOVERY.slice(1))).toBe(true);
  });

  it('is false for an ordinary sign-in landing', () => {
    expect(isRecoveryHash('#access_token=AAA&type=signup')).toBe(false);
  });

  it('is false for a failed link and for no fragment at all', () => {
    expect(isRecoveryHash(EXPIRED)).toBe(false);
    expect(isRecoveryHash('')).toBe(false);
  });

  it('does not match "recovery" appearing somewhere other than type', () => {
    expect(isRecoveryHash('#error_description=recovery&type=magiclink')).toBe(false);
  });
});

describe('recoveryLinkError', () => {
  it('explains otp_expired in terms of newer emails, not just "invalid"', () => {
    expect(recoveryLinkError(EXPIRED)).toMatch(/replaced by a newer one/);
  });

  it('falls back to Supabase\'s own description for other errors', () => {
    expect(recoveryLinkError('#error=server_error&error_description=Something+broke')).toBe('Something broke');
  });

  it('is null when the link worked or there is no fragment', () => {
    expect(recoveryLinkError(RECOVERY)).toBeNull();
    expect(recoveryLinkError('')).toBeNull();
  });
});
