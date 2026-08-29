/*
  # Phase 2b, part 1 of 2 — move admin authority off a user-writable row

  Applied to production 2026-08-29 and recorded here so the repo tracks the
  live database.

  EZ-01 was contained by a trigger rejecting direct writes to
  `user_settings.is_admin`. That works, but the shape is still wrong: an
  authority flag living on a row its own subject can update, defended by a
  trigger. This puts it somewhere users cannot write at all.

  `admin_users` has RLS enabled and exactly one policy — read your own row.
  With RLS on and no INSERT, UPDATE or DELETE policy, those are denied
  outright, so the SECURITY DEFINER functions below are the only way in.
  Verified: an existing admin can grant through `admin_grant` but cannot
  INSERT into `admin_users` directly.

  Reading only your own row also means one user cannot enumerate the
  administrators, which the previous design leaked to anyone who asked.

  `is_admin()` is repointed at the new table, so every policy written against
  it by the EZ-04 curation migration follows with no policy changes at all.
  That indirection was worth having.

  ## What this fixes beyond EZ-01

  EZ-02, the admin screen that reported success while doing nothing.
  `admin_grant` and `admin_revoke` return the number of rows changed, so the
  client can distinguish "granted" from "already an admin" instead of
  assuming. The old code updated another user's row, matched zero under RLS,
  and toasted success regardless.

  EZ-27's vestigial argument is gone: `set_user_data_as_default()` now takes
  no parameter and acts on its caller. It previously accepted a uuid and
  checked whether THAT id belonged to an admin, never the caller.

  ## Deliberately not done here

  `user_settings.is_admin` is LEFT IN PLACE. The running app still reads it,
  and dropping it in this migration would break the deployed build until the
  next release. Part 2 drops it, along with the now-redundant
  `reject_is_admin_change` trigger, once the new client is live.

  Refusing to remove the last administrator is enforced in `admin_revoke`
  rather than only in the UI: an app with no administrator has no way back
  short of direct database access.
*/

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can see whether they are an admin" ON public.admin_users;
CREATE POLICY "Users can see whether they are an admin"
  ON public.admin_users FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

INSERT INTO public.admin_users (user_id)
SELECT user_id FROM public.user_settings WHERE is_admin = true
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = (SELECT auth.uid()));
$$;

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (id uuid, email text, created_at timestamptz, is_admin boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT u.id, u.email::text, u.created_at,
         EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = u.id)
  FROM auth.users u
  ORDER BY u.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_grant(target_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target uuid;
  affected integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT u.id INTO target FROM auth.users u WHERE lower(u.email) = lower(trim(target_email));
  IF target IS NULL THEN
    RAISE EXCEPTION 'No account with that email address' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.admin_users (user_id, granted_by)
  VALUES (target, (SELECT auth.uid()))
  ON CONFLICT (user_id) DO NOTHING;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke(target_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  affected integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  IF target_user_id = (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'You cannot remove your own admin access' USING ERRCODE = '42501';
  END IF;

  IF (SELECT count(*) FROM public.admin_users) <= 1 THEN
    RAISE EXCEPTION 'Cannot remove the last administrator' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.admin_users WHERE user_id = target_user_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_users()
RETURNS TABLE (id uuid, email text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT u.id, u.email::text, u.created_at FROM auth.users u;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_details(user_email text)
RETURNS TABLE (id uuid, email text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT u.id, u.email::text, u.created_at FROM auth.users u WHERE u.email = user_email;
END;
$$;

DROP FUNCTION IF EXISTS public.set_user_data_as_default(uuid);

CREATE FUNCTION public.set_user_data_as_default()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.storage (key, value)
  VALUES ('default_template_user_id', (SELECT auth.uid())::text)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_user_data_as_default() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_admin()                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users()         TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant(text)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_data_as_default() TO authenticated;
