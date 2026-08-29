/*
  # EZ-04 — make `exercises` an admin-curated catalogue

  Applied to production 2026-08-29 and recorded here so the repo tracks the
  live database.

  ## What was actually exposed

  Two holes, and the one we went looking for was the smaller of them:

  * **DELETE** — only 11 of 58 exercises were deletable at all, because
    `template_exercises.exercise_id` and `workout_exercises.exercise_id` are
    `NO ACTION`. Postgres already refused to delete anything in use, so
    history was never at risk from deletion.

  * **UPDATE** — completely unconstrained, and the real problem. Renaming
    "Bench Press" silently relabels it across every historical workout and
    every Insights chart. Because nothing is deleted, no foreign key protects
    against it, and there is no audit trail.

  Both close by making writes admin-only. Reads stay open to every
  authenticated user; the catalogue is meant to be shared.

  `exercise_muscle_groups` was worse than the migration files suggested. They
  read `USING (true)`; production actually had
  `EXISTS (SELECT 1 FROM exercises e WHERE e.id = exercise_muscle_groups.exercise_id)`,
  which is true for every row with a valid parent — the same practical effect
  through different text. Another reason to audit `pg_policies` rather than
  these files (EZ-05, EZ-24).

  ## Verified after applying

  Measured rows affected, not just absence of an error — an UPDATE that RLS
  filters to zero rows succeeds silently, which is the whole substance of
  EZ-02 and would otherwise read as success here too:

  * admin: rename wrote 1 row, muscle-group write touched 194 rows, delete of
    an in-use exercise blocked by the foreign key.
  * non-admin: rename, delete, and muscle-group write all affected 0 rows.

  Every probe ran inside a subtransaction that always rolls back; afterwards
  58 exercises, "Bench Press" intact, 0 stray renames, 194 links.

  ## A consequence worth knowing before building the library UI

  Under RLS a client cannot determine whether an exercise is unused. The
  `NOT EXISTS` check against `workout_exercises` only sees the caller's own
  workouts, so an exercise another user relies on looks unused. "Delete if
  nothing references it" is therefore not implementable client-side — an
  independent argument for hide-not-delete.
*/

-- ---------------------------------------------------------------------------
-- Shared admin predicate. SECURITY DEFINER so a policy can consult
-- user_settings without depending on that table's own RLS, and STABLE so it
-- is evaluated once per statement rather than once per row.
-- Phase 2b will repoint this at admin_users without touching any policy.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_settings
    WHERE user_id = (SELECT auth.uid()) AND is_admin = true
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- exercises: read for everyone, write for admins
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can insert new exercises"                    ON public.exercises;
DROP POLICY IF EXISTS "Users can update exercises they have defaults for" ON public.exercises;
DROP POLICY IF EXISTS "Users can delete exercises they have defaults for" ON public.exercises;

CREATE POLICY "Admins can insert exercises" ON public.exercises
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update exercises" ON public.exercises
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete exercises" ON public.exercises
  FOR DELETE TO authenticated USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- exercise_muscle_groups
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can modify exercise muscle groups" ON public.exercise_muscle_groups;

CREATE POLICY "Anyone authenticated can read exercise muscle groups"
  ON public.exercise_muscle_groups
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can modify exercise muscle groups"
  ON public.exercise_muscle_groups
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- Groundwork, no behaviour change today
-- ---------------------------------------------------------------------------

-- Lets "users create private exercises, admins promote them" become a policy
-- change later rather than a schema migration. SET NULL, never CASCADE: an
-- exercise must not disappear because the account that added it was removed.
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Hiding is a per-user preference, so it lives on the per-user row and can
-- never affect anyone else's library. exercise_defaults is already keyed
-- (user_id, exercise_id), which is exactly the shape needed.
ALTER TABLE public.exercise_defaults
  ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

-- Backstop against literal repeats. Verified clean first: 58 rows, 0
-- collisions under lower(trim(name)). Near-duplicates are deliberately NOT
-- caught here — "Incline Bench Press" and "Bench Press" are different
-- exercises, as are "Hack Squats" and "Squats", and all four are in the
-- current catalogue. A fuzzy match would cry wolf on legitimate variants on
-- day one; the real answer to accidental duplicates is a search-first picker.
CREATE UNIQUE INDEX IF NOT EXISTS exercises_name_unique_ci
  ON public.exercises (lower(trim(name)));
