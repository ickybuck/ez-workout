-- Deleting a template detaches the workouts started from it instead of being
-- refused (EZ-52).
--
-- workouts.template_id was a plain foreign key (NO ACTION), so a template
-- with even one workout logged from it could not be deleted: the app's
-- Delete reported "Failed to delete template" for every one of Eric's
-- templates, which is how the old copies of "1 Quad Focused" and
-- "3 Ham/Glute Focused" came to be hidden rather than removed.
--
-- With SET NULL a deleted template's workouts keep their name, start and
-- end times and every logged set; they only stop pointing at the template,
-- so they drop out of that template's progress chart and PR comparison.
-- History, Insights and the MCP server already treat a null template_id as
-- "not from a template".
--
-- Applied to the live project first, 2026-11-21.

ALTER TABLE public.workouts DROP CONSTRAINT workouts_template_id_fkey;
ALTER TABLE public.workouts
  ADD CONSTRAINT workouts_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES public.workout_templates(id) ON DELETE SET NULL;
