/*
  # Template renames carry back to workout history

  Applied to production 2026-08-29. Recorded here so the repo tracks the live
  database.

  workouts.name is denormalised at creation. Renaming a template therefore left
  every past session labelled with the old name, and the app groups history by
  that stored string -- so one template with a rename behind it shows up as two
  unrelated series, with its progression split between them.

  This was not one rename. 159 of 317 sessions carried a stale name across five
  historical names for four templates ("Lower Body + Core" and "Legs + Core 1"
  are both "1 Quad Focused"; "Upper Body + Core" is "2 Push Upper Focused";
  "Legs + Core 2" and "3 Hamstring/Glute Focused" are both "3 Ham/Glute
  Focused"). Any per-template trend was being computed over fragments -- the
  frequency analysis in the research brief had to be redone because of it.

  Two parts: backfill what is already stale, then a trigger so it cannot happen
  again. The trigger is the point. A backfill alone would be stale again after
  the next rename, and this project's recurring failure has been fixes that
  only held until the next time.

  Scoped by user_id as well as template_id. template_id already implies
  ownership, so this is belt and braces, but a SECURITY DEFINER function that
  writes to other people's rows is exactly the shape of the bug this codebase
  has already had once (EZ-01), and the extra predicate costs nothing.

  Deliberately NOT dropping the denormalised column. It is the fallback when a
  template is deleted and the workout must still say what it was, which is real
  history worth keeping.

  Verified after applying: 0 rows where workouts.name differs from its
  template's name, trigger attached, and the four templates now report as four
  series (39, 36, 34, 33 sessions) rather than five fragments.
*/

UPDATE public.workouts w
SET name = t.name,
    updated_at = now()
FROM public.workout_templates t
WHERE w.template_id = t.id
  AND w.user_id = t.user_id
  AND w.name IS DISTINCT FROM t.name;

CREATE OR REPLACE FUNCTION public.sync_workout_names_on_template_rename()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.workouts
    SET name = NEW.name,
        updated_at = now()
    WHERE template_id = NEW.id
      AND user_id = NEW.user_id
      AND name IS DISTINCT FROM NEW.name;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_workout_names_on_template_rename() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS workout_templates_sync_workout_names ON public.workout_templates;
CREATE TRIGGER workout_templates_sync_workout_names
  AFTER UPDATE OF name ON public.workout_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_workout_names_on_template_rename();
