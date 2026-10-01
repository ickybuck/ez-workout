/**
 * How long to rest after the block just finished.
 *
 * One rest timer sat in the workout header on a single global duration, so a
 * set of squats and a set of lateral raises were followed by the same 90
 * seconds. Either the number is right for the heavy lift and you stand around
 * after the small stuff, or it is right for the small stuff and you are back
 * under a loaded bar early. The second one is the one that matters.
 *
 * The split is per exercise and deliberately not a training taxonomy. The flag
 * is called "extended rest" and lives on exercise_defaults, next to the other
 * answers to "how do I do this exercise" — sets, reps, weight, increment, bar
 * weight, hidden. Two consequences worth stating: it is per user, so one
 * account's preference cannot reach into another's, and it makes no claim about
 * whether a movement is compound. `exercises.is_compound` says that, says it
 * wrongly for about fifteen rows, and is left alone here.
 */

/** What the rest timer falls back to. Matches user_settings' column default. */
export const DEFAULT_REST = 90;

/** The long one, for the lifts that earn it. */
export const DEFAULT_EXTENDED_REST = 120;

export interface RestSettings {
  /** user_settings.rest_timer_duration — nullable in the database. */
  normal: number | null | undefined;
  /** user_settings.rest_timer_duration_extended — nullable in the database. */
  extended: number | null | undefined;
}

/** A stored duration is only usable if it is a positive number of seconds. */
function seconds(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * The rest for a block — one exercise for a straight set, several for a
 * superset.
 *
 * A superset is one rest, taken at the end of the pair, so the whole block
 * takes the longer duration if any member asks for it. Resting 90 seconds
 * because the marked lift happened to be listed second would be exactly the
 * wrong way round.
 */
export function restDurationFor(
  blockExerciseIds: ReadonlyArray<string | null | undefined>,
  extendedRestExerciseIds: ReadonlySet<string>,
  settings: RestSettings,
): number {
  const wantsExtended = blockExerciseIds.some(
    (id): id is string => !!id && extendedRestExerciseIds.has(id),
  );

  return wantsExtended
    ? seconds(settings.extended, DEFAULT_EXTENDED_REST)
    : seconds(settings.normal, DEFAULT_REST);
}
