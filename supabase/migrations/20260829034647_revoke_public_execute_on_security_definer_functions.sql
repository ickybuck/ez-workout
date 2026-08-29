/*
  # Revoke public EXECUTE on SECURITY DEFINER functions

  Applied to production 2026-08-29. Recorded here after the fact so the repo
  stops drifting from the live database — the drift is what allowed the
  problem below to go unnoticed, since none of these grants appear in any
  migration file.

  1. copy_user_defaults — CRITICAL, unauthenticated
     SECURITY DEFINER, granted to anon AND authenticated, and containing no
     authorization check of any kind: it never reads auth.uid(). Because it is
     SECURITY DEFINER it bypassed RLS entirely, so any unauthenticated caller
     who knew two user UUIDs could POST to /rest/v1/rpc/copy_user_defaults and
     write into another account — cloning templates and overwriting the
     target's user_settings via INSERT ... ON CONFLICT DO UPDATE.
     Revoked from both roles. Its only legitimate caller is handle_new_user(),
     which runs as a trigger under definer rights and needs no grant.

  2. handle_new_user — a trigger function that was reachable over RPC.
     Revoked from both roles for the same reason.

  3. set_user_data_as_default — authorizes on its own ARGUMENT, not the caller
     (it checks whether the uuid it was handed is an admin, never auth.uid()).
     anon revoked here as containment; the authenticated grant stays so the
     Admin screen keeps working. The confused-deputy logic itself is still
     wrong and is tracked separately as EZ-27.

  4. list_users / get_user_details — both check auth.uid() correctly, but anon
     has no reason to reach them. Revoked from anon only.

  Verified after applying by reading pg_proc.proacl back rather than trusting
  the success response.
*/

REVOKE EXECUTE ON FUNCTION public.copy_user_defaults(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()               FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_user_data_as_default(uuid)  FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_users()                    FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_details(text)          FROM anon;
