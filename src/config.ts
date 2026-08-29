/**
 * Build-time application flags.
 */

/**
 * Whether the app offers self-service registration.
 *
 * Currently false. Signups were disabled in Supabase on 2026-08-29 as
 * containment for EZ-01, where any account could set its own `is_admin` and
 * then read every user's email address. That specific hole is fixed, but
 * reopening registration is gated on EZ-04's exercise ownership model — the
 * catalogue is shared, so a new account is still a data-integrity risk even
 * though it is no longer a privilege one.
 *
 * This flag exists because Supabase gives the client no way to ask whether
 * signups are enabled. Without it the app cheerfully renders a registration
 * form that the API then refuses (EZ-29), which reads as broken rather than
 * closed.
 *
 * When registration reopens it should come back behind the invite-code
 * pattern period-tracker already uses, not simply by flipping this to true.
 */
export const SIGNUPS_ENABLED = false;
