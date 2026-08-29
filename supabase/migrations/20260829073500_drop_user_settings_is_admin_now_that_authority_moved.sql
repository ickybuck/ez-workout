/*
  # Phase 2b, part 2 of 2 — retire user_settings.is_admin

  Applied to production 2026-08-29, after the client that stopped reading it
  (37a0e8b) was deployed. Recorded here so the repo tracks the live database.

  Authority now lives in `admin_users` and the app reads it through
  `is_admin()`. Nothing touches this column any more, so leaving it would be
  worse than removing it: a column named `is_admin` that no longer decides
  anything is a trap for whoever reads this schema next, and it would keep
  looking like the answer. EZ-05 is what happens when the schema and the
  documentation disagree; a dead authority column is the same failure with a
  longer fuse.

  The `reject_is_admin_change` trigger goes with it. It existed to defend a
  flag users could write. The flag is gone, and `admin_users` has no
  user-facing write policy at all, so there is nothing left to defend — the
  trigger was scaffolding for a fix that has now been done properly.

  `handle_new_user` is recreated without the column. Worth noticing that it no
  longer decides anything about admin status: a new account simply has no row
  in `admin_users`, which is the correct default and took no code to express.
  The previous version had to remember to write `is_admin, false`.

  Ordering mattered. This ships AFTER the client change rather than with it,
  because the deployed build upserted the whole settings object — including
  `is_admin` — every time anyone saved a preference. Dropping the column first
  would have broken the settings screen for the window between the two
  deploys.

  Verified after applying: column gone, trigger and its function gone, one
  admin (eric), exactly one policy on admin_users (SELECT own row), and the
  signup trigger still attached.
*/

DROP TRIGGER IF EXISTS user_settings_block_is_admin_change ON public.user_settings;
DROP FUNCTION IF EXISTS public.reject_is_admin_change();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  default_user_id uuid;
BEGIN
  INSERT INTO public.user_settings (
    user_id, weight_unit, use_metric, rest_timer_duration, auto_start_timer,
    show_workout_timer, show_exercise_timer, dark_mode,
    available_plates_kg, available_plates_lb
  ) VALUES (
    NEW.id, 'lb', false, 90, true,
    true, true, false,
    '[25, 20, 15, 10, 5, 2.5, 1.25]'::jsonb,
    '[45, 35, 25, 10, 5, 2.5]'::jsonb
  )
  ON CONFLICT (user_id) DO NOTHING;

  SELECT value::uuid INTO default_user_id FROM public.storage
  WHERE key = 'default_template_user_id';

  IF default_user_id IS NOT NULL THEN
    PERFORM public.copy_user_defaults(default_user_id, NEW.id);
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block account creation on seeding.
    RAISE NOTICE 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.user_settings DROP COLUMN IF EXISTS is_admin;
