-- Who added a template and who last changed it: the person in the app, or
-- Claude through the MCP connector (EZ-53).
--
-- Stamped by triggers rather than by the code that writes, because a
-- template is changed from many places -- the template editor, the plate
-- calculator and the exercise editor both push targets into
-- template_exercises, the importer, the copy button, and now Claude -- and a
-- stamp each of them had to remember would be wrong the first time one
-- forgot. Changes to a template's exercise list count as edits to the
-- template.
--
-- The source of a write:
--   'claude'  the service_role key AND the x-ez-client: claude-mcp header the
--             MCP server sends. Requiring both means a browser cannot label
--             its own edits as Claude's by sending the header.
--   'user'    a signed-in app user (role authenticated).
--   NULL      anything else (SQL maintenance, the dashboard): not stamped,
--             so tidying data does not claim to be anyone's edit.
--
-- Building a template is one act, not an edit: writes from the creator in
-- the first two minutes after creation (adding its exercises, the first
-- save) do not stamp "last edited".
--
-- Applied to the live project first, 2026-11-21.

ALTER TABLE public.workout_templates
  ADD COLUMN IF NOT EXISTS created_via text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS last_edited_via text,
  ADD COLUMN IF NOT EXISTS last_edited_at timestamptz;

ALTER TABLE public.workout_templates
  DROP CONSTRAINT IF EXISTS workout_templates_created_via_check,
  ADD CONSTRAINT workout_templates_created_via_check CHECK (created_via IN ('user', 'claude')),
  DROP CONSTRAINT IF EXISTS workout_templates_last_edited_via_check,
  ADD CONSTRAINT workout_templates_last_edited_via_check CHECK (last_edited_via IS NULL OR last_edited_via IN ('user', 'claude'));

CREATE OR REPLACE FUNCTION public.template_edit_source()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN coalesce(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role', '') = 'service_role'
     AND lower(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-ez-client', '')) = 'claude-mcp'
      THEN 'claude'
    WHEN coalesce(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role', '') = 'authenticated'
      THEN 'user'
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.stamp_template_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  src text := public.template_edit_source();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF src IS NOT NULL THEN
      NEW.created_via := src;
    END IF;
    NEW.last_edited_via := NULL;
    NEW.last_edited_at := NULL;
    RETURN NEW;
  END IF;

  -- UPDATE. Provenance is not editable through an update.
  NEW.created_via := OLD.created_via;
  IF src IS NULL THEN
    RETURN NEW;
  END IF;
  IF src = OLD.created_via AND OLD.created_at > now() - interval '2 minutes' THEN
    -- Still being built by whoever created it.
    NEW.last_edited_via := OLD.last_edited_via;
    NEW.last_edited_at := OLD.last_edited_at;
    RETURN NEW;
  END IF;
  NEW.last_edited_via := src;
  NEW.last_edited_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS stamp_template_write ON public.workout_templates;
CREATE TRIGGER stamp_template_write
  BEFORE INSERT OR UPDATE ON public.workout_templates
  FOR EACH ROW EXECUTE FUNCTION public.stamp_template_write();

CREATE OR REPLACE FUNCTION public.stamp_template_from_exercises()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  src text := public.template_edit_source();
  tid uuid := coalesce(NEW.template_id, OLD.template_id);
BEGIN
  IF src IS NULL OR tid IS NULL THEN
    RETURN NULL;
  END IF;
  -- Touching the parent runs stamp_template_write, which applies the same
  -- rules. The WHERE skips the write when this transaction already stamped it.
  UPDATE public.workout_templates
     SET last_edited_at = now()
   WHERE id = tid
     AND (last_edited_at IS DISTINCT FROM now() OR last_edited_via IS DISTINCT FROM src);
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS stamp_template_from_exercises ON public.template_exercises;
CREATE TRIGGER stamp_template_from_exercises
  AFTER INSERT OR UPDATE OR DELETE ON public.template_exercises
  FOR EACH ROW EXECUTE FUNCTION public.stamp_template_from_exercises();

REVOKE EXECUTE ON FUNCTION public.template_edit_source() FROM PUBLIC, anon;
-- Called inside the triggers, which run as the writer.
GRANT EXECUTE ON FUNCTION public.template_edit_source() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.stamp_template_write() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.stamp_template_from_exercises() FROM PUBLIC, anon, authenticated;
