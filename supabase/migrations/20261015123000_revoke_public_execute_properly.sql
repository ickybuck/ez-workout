/*
  # The EZ-26 revoke named the wrong grantee, so it never took effect

  20260829034647 closed what it called a CRITICAL unauthenticated hole:

    REVOKE EXECUTE ON FUNCTION public.copy_user_defaults(uuid, uuid)
      FROM anon, authenticated;

  That does nothing on its own. Postgres grants EXECUTE to PUBLIC by default on
  every function, and anon and authenticated inherit through PUBLIC -- revoking
  the role-level grant leaves the PUBLIC grant untouched. The ACL on 2026-10-15
  still read "=X/postgres", and Supabase's own linter still reported the
  function as callable by anon via /rest/v1/rpc/copy_user_defaults.

  So for seven weeks copy_user_defaults was what EZ-26 said it was: SECURITY
  DEFINER, no authorization check of any kind, taking a source and a target user
  id and copying exercise defaults, templates and settings between them --
  including an ON CONFLICT DO UPDATE that overwrites the target's user_settings.
  Knowing two UUIDs was the only requirement.

  handle_new_user is in the same state. It is a trigger function and would fail
  on a direct call, but it has no business being in the public API surface.

  Nothing in the client calls either one: copy_user_defaults appears only in the
  generated database.types.ts, and handle_new_user runs from its trigger.

  The five remaining SECURITY DEFINER functions the linter flags -- admin_grant,
  admin_revoke, admin_list_users, get_user_details, list_users -- all begin with
  IF NOT public.is_admin() THEN RAISE EXCEPTION, so for them the warning is
  about surface rather than exposure. Left alone here; tightening them is
  cleanup, not a fix.

  Worth keeping as a lesson: the 08-29 fix was recorded as verified against the
  live endpoint, and it was still wrong. Check the ACL after revoking, not just
  a response code -- a REVOKE that removes nothing raises no error.

  Verified after: anon-executable SECURITY DEFINER functions 7 -> 5,
  authenticated 9 -> 7, with both of these gone from the lists.
*/

REVOKE EXECUTE ON FUNCTION public.copy_user_defaults(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
