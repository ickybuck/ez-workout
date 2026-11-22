/**
 * Which parts of an exercise belong to everyone.
 *
 * The exercise library is one list shared by every account. What an exercise
 * *is* -- its name, description, equipment, body part, muscle groups, and
 * whether it is compound or plate-loaded -- lives on that shared row, so a
 * change there changes the exercise for everyone who has it in a template or
 * in their history. Targets (sets, reps, weight, increments, bar weight,
 * extended rest) live in exercise_defaults, one row per person, and are
 * nobody else's business.
 *
 * Editing shared fields is limited to admins, and the editor warns before
 * saving a change to them (EZ-51). This works out which shared fields an edit
 * actually touches, so the warning names them and an edit that only changes
 * your own targets does not warn at all.
 */

export interface SharedFields {
  name?: string | null;
  description?: string | null;
  equipmentTypeId?: string | null;
  bodyPartId?: string | null;
  isCompound?: boolean | null;
  isPlateLoaded?: boolean | null;
  /** muscle group id to is_primary */
  muscleGroups?: Array<{ id: string; is_primary: boolean }>;
}

const blank = (value: string | null | undefined) => (value ?? '').trim();

function sameMuscles(a: SharedFields['muscleGroups'] = [], b: SharedFields['muscleGroups'] = []): boolean {
  if (a.length !== b.length) return false;
  const key = (list: NonNullable<SharedFields['muscleGroups']>) =>
    list
      .map((m) => `${m.id}:${m.is_primary ? 1 : 0}`)
      .sort()
      .join(',');
  return key(a) === key(b);
}

/** Labels of the shared fields that differ, in the order a form shows them. */
export function changedSharedFields(before: SharedFields, after: SharedFields): string[] {
  const changed: string[] = [];
  if (blank(before.name) !== blank(after.name)) changed.push('name');
  if (blank(before.description) !== blank(after.description)) changed.push('description');
  if ((before.equipmentTypeId ?? null) !== (after.equipmentTypeId ?? null)) changed.push('equipment');
  if ((before.bodyPartId ?? null) !== (after.bodyPartId ?? null)) changed.push('body part');
  if (!sameMuscles(before.muscleGroups, after.muscleGroups)) changed.push('muscle groups');
  if (!!before.isCompound !== !!after.isCompound) changed.push('compound');
  if (!!before.isPlateLoaded !== !!after.isPlateLoaded) changed.push('plate-loaded');
  return changed;
}

/** The sentence shown before a shared change is saved. */
export function sharedChangeWarning(exerciseName: string, changed: string[]): string {
  const list =
    changed.length <= 1 ? changed.join('') : `${changed.slice(0, -1).join(', ')} and ${changed[changed.length - 1]}`;
  return (
    `This changes the ${list} of "${exerciseName}" for everyone who uses it, ` +
    'in their templates and in their workout history. Your own sets, reps and weight are separate and only affect you. Save anyway?'
  );
}
