-- Marks that a user has been through the first-run setup.
--
-- Deliberately NOT inferred from "does a user_settings row exist" or "is
-- weight null". A row is written the first time anything in Settings is
-- saved, and weight is genuinely optional, so both proxies would either
-- re-show the flow to someone who finished it or skip it for someone who
-- never saw it. A dedicated column says exactly one thing.
--
-- Nullable rather than defaulted: null means "not yet", and the timestamp
-- records when, which is worth having if the flow ever needs revisiting.
alter table public.user_settings
  add column if not exists onboarded_at timestamptz;

-- Everyone who already has settings has, by definition, already set them up.
-- Without this backfill the flow would greet existing users on next load.
update public.user_settings
   set onboarded_at = coalesce(created_at, now())
 where onboarded_at is null;
