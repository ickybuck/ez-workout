/*
  # Why a set ended, how close it was to failure, and when it was beaten

  Applied to production 2026-08-29. Recorded here so the repo tracks the live
  database. Three columns, one purpose: make a logged set say what actually
  happened.

  ## stop_reason

  `failed_reps` has been carrying three unrelated meanings at once: a set cut
  short, a set never started, and a set traded away to spend the effort
  elsewhere. Over the last year 52.9% of all recorded failed reps came from
  sets with zero reps performed -- not failures of any kind. Every fatigue rule
  proposed from that number was reasoning about the wrong thing, and the
  analysis had to be redone twice because of it.

  Cannot be backfilled. The seventeen months already logged have no cause and
  never will, so cause-based analytics exclude them rather than inferring --
  inferring would be manufacturing data, which is the failure this ends.

    muscular_failure   the muscle could not complete the rep. The ONLY value
                       that may ever feed load prescription.
    session_depletion  spent by the work just done. A recovery signal.
    daily_depletion    arrived low: sleep, illness, stress. A readiness signal.
    deprioritised      chose to spend the effort elsewhere. A template signal.
    out_of_time        the schedule ended it. Not a training signal at all.
    discomfort         joint or other pain.

  session_depletion and daily_depletion must not be merged: one says fix
  recovery, the other says fix readiness, and they call for opposite responses.

  Deliberately absent: a "breathless/nausea" value. An earlier draft had it,
  naming a ventilatory mechanism -- but the athlete can hold a conversation at
  the moment he stops, which places him below the ventilatory threshold. The
  label asserted a physiology that is not the right one. session_depletion
  describes what happens without claiming why.

  ## extra_reps

  Until now a set could fall short of its target but never beat it, because
  performed reps were capped by arithmetic. If the athlete felt like doing
  more, there was nowhere to put it.

  That gap is why the squat sat at 275 lb for fourteen consecutive sessions
  with almost no failed reps: the app could see the sets were completed, but
  not that they were completed easily, so "at capacity" and "never asked to do
  more" looked identical.

  This is better evidence than the reps-in-reserve estimate it partly replaces.
  RIR is a self-assessment and degrades the further a set ends from failure --
  exactly the regime this athlete trains in. Extra reps are counted, not
  judged. It also completes double progression, which the research recommended
  and the schema could not express.

  Mutually exclusive with failed_reps by constraint: a set cannot both fall
  short and exceed.

  ## set_rir

  Stored as a band rather than a number because RIR self-report is least
  accurate far from failure, so a band is the honest resolution -- and it is
  one tap rather than a keypad in a gym. Offered only on a cleanly completed
  last set of a loaded exercise, never on a set that was beaten (overage
  already measured it) or one that fell short.

  All three are nullable and CHECK-constrained rather than enums, so adding a
  value later is a constraint change rather than a type migration. A null means
  "not recorded" and is never coerced to a value.

  Verified after applying: all three columns present and nullable, four
  constraints attached, zero rows backfilled.
*/

ALTER TABLE public.exercise_logs
  ADD COLUMN IF NOT EXISTS stop_reason text,
  ADD COLUMN IF NOT EXISTS set_rir text,
  ADD COLUMN IF NOT EXISTS extra_reps integer;

ALTER TABLE public.exercise_logs
  DROP CONSTRAINT IF EXISTS exercise_logs_stop_reason_check;
ALTER TABLE public.exercise_logs
  ADD CONSTRAINT exercise_logs_stop_reason_check
  CHECK (stop_reason IS NULL OR stop_reason IN (
    'muscular_failure', 'session_depletion', 'daily_depletion',
    'deprioritised', 'out_of_time', 'discomfort'
  ));

ALTER TABLE public.exercise_logs
  DROP CONSTRAINT IF EXISTS exercise_logs_set_rir_check;
ALTER TABLE public.exercise_logs
  ADD CONSTRAINT exercise_logs_set_rir_check
  CHECK (set_rir IS NULL OR set_rir IN ('0', '1-2', '3plus'));

ALTER TABLE public.exercise_logs
  DROP CONSTRAINT IF EXISTS exercise_logs_extra_reps_check;
ALTER TABLE public.exercise_logs
  ADD CONSTRAINT exercise_logs_extra_reps_check
  CHECK (extra_reps IS NULL OR extra_reps >= 0);

ALTER TABLE public.exercise_logs
  DROP CONSTRAINT IF EXISTS exercise_logs_shortfall_or_overage_check;
ALTER TABLE public.exercise_logs
  ADD CONSTRAINT exercise_logs_shortfall_or_overage_check
  CHECK (COALESCE(failed_reps, 0) = 0 OR COALESCE(extra_reps, 0) = 0);

COMMENT ON COLUMN public.exercise_logs.stop_reason IS
  'Why this set ended. NULL means not recorded -- never inferred. Rows predating 2026-08-29 cannot have a value.';
COMMENT ON COLUMN public.exercise_logs.set_rir IS
  'Reps in reserve at set end, as a band: 0, 1-2, 3plus. NULL means not recorded.';
COMMENT ON COLUMN public.exercise_logs.extra_reps IS
  'Reps performed beyond the prescribed target. Mutually exclusive with failed_reps. NULL means not recorded; 0 means recorded as none.';
