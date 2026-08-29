/*
  # Phase 2a — close EZ-01 and EZ-27 without an application change

  Applied to production 2026-08-29 and recorded here so the repo tracks the
  live database. That drift is what let EZ-05 and EZ-26 hide.

  ## EZ-01 — any account could promote itself to admin

  `user_settings.is_admin` is a plain column, and the UPDATE policy is
  `USING ((select auth.uid()) = user_id)` with no column restriction, so any
  signed-in account could set its own `is_admin` and then read every user's
  email via `list_users()`. Confirmed against live `pg_policies`, not inferred
  from these files.

  Rather than restructure the schema now (Phase 2b), block the column at the
  row level with a trigger. This costs no working functionality: the only
  in-app path that grants admin is `Admin.tsx`, which updates *another* user's
  row and therefore already matches zero rows under RLS while reporting
  success (EZ-02). There is nothing to break.

  The escape hatch is a transaction-local GUC, `app.allow_is_admin_change`.
  Ordinary API roles cannot set it — PostgREST exposes only functions in the
  `public` schema and `set_config` is not among them — so it is reachable only
  from a SECURITY DEFINER function that opts in deliberately. Phase 2b's
  grant/revoke RPCs will use it.

  Verified after applying: the update is rejected for both accounts without
  the GUC and permitted with it, and ordinary preference updates (the Settings
  screen) are unaffected, since `IS DISTINCT FROM` is false when `is_admin`
  does not change.

  ## EZ-27 — set_user_data_as_default trusted its own argument

  It checked whether the uuid it was *handed* belonged to an admin, never
  whether the *caller* was one, and never read `auth.uid()` — a confused
  deputy. Combined with the anon grant revoked in the previous migration, any
  unauthenticated caller who knew an admin's uuid could invoke it.

  It now authorizes on `auth.uid()` and acts only on the caller. The parameter
  is retained, and ignored, so the existing `Admin.tsx` call still resolves;
  it is dropped in Phase 2b alongside the client change. Behaviour for the
  real caller is unchanged, since the app only ever passes its own user id.
*/

-- ---------------------------------------------------------------------------
-- EZ-01: reject direct writes to is_admin
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reject_is_admin_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin
     AND coalesce(current_setting('app.allow_is_admin_change', true), 'off') <> 'on'
  THEN
    RAISE EXCEPTION
      'is_admin cannot be changed directly; use an administrative function (EZ-01)'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_settings_block_is_admin_change ON public.user_settings;
CREATE TRIGGER user_settings_block_is_admin_change
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_is_admin_change();

-- ---------------------------------------------------------------------------
-- EZ-27: authorize on the caller, not on an attacker-supplied argument
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_user_data_as_default(admin_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller uuid := (SELECT auth.uid());
BEGIN
  -- admin_user_id is deliberately ignored: authority comes from the caller's
  -- own identity. Kept only so the existing client call still resolves.
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Access denied: not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_settings
    WHERE user_id = caller AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied: caller is not an admin' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.storage (key, value)
  VALUES ('default_template_user_id', caller::text)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_user_data_as_default(uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.set_user_data_as_default(uuid) TO authenticated;
