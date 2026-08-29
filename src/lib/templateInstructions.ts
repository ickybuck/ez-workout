/**
 * The instruction document — the file that gets uploaded to an AI chat.
 *
 * This is the other half of the round trip. The bundle carries the data; this
 * carries the rules, and the two travel together in one file so there is
 * nothing for the user to remember to attach. Everything the model needs to
 * produce an importable file is in here, because the alternative is the user
 * relaying validation errors from memory.
 *
 * Three things it must get across, in order of how often they go wrong:
 *
 *   1. Which exercises exist. Without the catalogue a model invents names, and
 *      every import turns into a resolution chore.
 *   2. What unit the numbers are in, and that it must not be changed.
 *   3. That importing only ever ADDS templates. Nothing is overwritten and
 *      nothing is deleted, because workout history points at these rows.
 *
 * Written as instructions to a model rather than documentation for a person,
 * though a person reading it should still recognise their own app.
 */

import {
  BUNDLE_SCHEMA_VERSION,
  TEMPLATE_CATEGORIES,
  TEMPLATE_TYPES,
  type TemplateBundle,
} from './templateBundle';

export interface InstructionOptions {
  /** Included only when the user asked for it; it is their training data. */
  includePerformance?: boolean;
}

/**
 * Performance travels only when asked for, so it is removed rather than left
 * as an undefined key — `JSON.stringify` would drop it either way, but a
 * bundle handed to another function should not carry a field the user opted
 * out of.
 */
function stripPerformance(bundle: TemplateBundle): TemplateBundle {
  const { recent_performance: _omitted, ...rest } = bundle;
  return rest;
}

function catalogueTable(bundle: TemplateBundle): string {
  if (bundle.exercise_catalogue.length === 0) {
    return '_The catalogue came through empty. Do not invent exercises — ask for the export to be run again._';
  }

  const rows = bundle.exercise_catalogue.map(
    (e) => `| ${e.name} | ${e.equipment ?? '—'} | ${e.body_part ?? '—'} |`,
  );

  return ['| Exercise | Equipment | Body part |', '| --- | --- | --- |', ...rows].join('\n');
}

function performanceTable(bundle: TemplateBundle, unit: string): string {
  const performance = bundle.recent_performance ?? [];
  if (performance.length === 0) return '';

  const rows = performance.map(
    (p) =>
      `| ${p.exercise_name} | ${p.sessions} | ${p.recent_weight} | ${p.recent_reps} | ${p.best_weight} | ${Math.round(
        p.failed_rep_rate * 100,
      )}% |`,
  );

  return [
    '',
    '## Recent performance',
    '',
    `Real numbers from the last few months, in ${unit}. Use these to set starting loads that make sense — not the defaults from the old templates, and not round numbers you would guess.`,
    '',
    `"Failed" is the share of prescribed reps that were attempted and not completed. A high rate means the prescribed load is too heavy for the prescribed reps, not that the exercise should be dropped.`,
    '',
    `| Exercise | Sessions | Recent ${unit} | Recent reps | Best ${unit} | Failed |`,
    '| --- | --- | --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
}

/**
 * Build the markdown document, with the bundle embedded at the end.
 *
 * One file rather than two. Asking someone to attach a data file and a rules
 * file to the same chat is asking them to forget one of them.
 */
export function buildInstructionDocument(
  bundle: TemplateBundle,
  options: InstructionOptions = {},
): string {
  const unit = bundle.weight_unit;
  const unitWord = unit === 'lb' ? 'pounds' : 'kilograms';

  const templateSummary =
    bundle.templates.length > 0
      ? bundle.templates
          .map((t) => `- **${t.name}** (${t.category}, ${t.template_type}) — ${t.exercises.length} exercises`)
          .join('\n')
      : '_No templates yet._';

  return `# Workout templates — rebuild instructions

This file was exported from a personal workout-tracking app. It contains that
app's exercise catalogue, the templates currently in it, and the exact format
the app can read back.

**What to do:** talk through the changes wanted, then produce a corrected
template file. Give it as a single \`\`\`json code block. It gets pasted or
uploaded straight back into the app, so it has to be right.

---

## Rules

**1. Only use exercises from the catalogue below, spelled exactly as listed.**
The app matches on name. "Barbell Bench Press" will not match "Bench Press" —
it will be flagged as unknown and the user will have to resolve it by hand.
When an exercise is needed that is not in the catalogue, do not put it in a
template. Put it in \`proposed_exercises\` and explain why, so a human can
approve adding it. This exists to stop the catalogue filling up with four
spellings of the same movement.

**2. All weights are in ${unitWord} (\`"weight_unit": "${unit}"\`).**
Leave that field exactly as it is and write every \`default_weight\` in
${unitWord}. Do not convert to the other unit as a convenience — the app trusts
this field, so changing it silently changes every weight in the file.

**3. Importing only ever adds templates. It never overwrites or deletes.**
So include only the templates that should be created. Re-sending an unchanged
template produces a second copy of it. When a template is meant to replace an
existing one, give it the same name and say so in the chat — the app will spot
the collision and offer to hide the old one, which keeps its workout history
intact rather than deleting it.

**4. \`category\` must be exactly one of:** ${TEMPLATE_CATEGORIES.map((c) => `\`${c}\``).join(', ')}.
No other value is accepted.

**5. \`template_type\` must be one of:** ${TEMPLATE_TYPES.map((t) => `\`${t}\``).join(', ')}.
Use \`superset\` only when the exercises are genuinely meant to be alternated
without rest between them.

**6. \`order_index\` runs 0, 1, 2, …** in the order the exercises should be
performed. Order matters for real reasons: pairing complementary movements, and
the physical layout of the gym — putting exercises that share a machine or a
corner next to each other saves crossing the floor mid-workout.

**7. \`default_sets\` and \`default_reps\` are whole numbers of 1 or more.**
\`default_weight\` is 0 or more; 0 is correct for bodyweight movements and
planks.

**8. Keep \`schema_version\` as \`"${BUNDLE_SCHEMA_VERSION}"\`.**

If the app rejects the file it produces a list of problems that can be pasted
straight back here. Fix all of them and return the whole corrected file, not a
patch.

---

## Format

\`\`\`json
{
  "schema_version": "${BUNDLE_SCHEMA_VERSION}",
  "weight_unit": "${unit}",
  "templates": [
    {
      "name": "Push Upper Focused",
      "description": "Chest, shoulders and triceps",
      "template_type": "regular",
      "category": "Upper Body",
      "exercises": [
        {
          "order_index": 0,
          "exercise_name": "Bench Press",
          "default_sets": 3,
          "default_reps": 10,
          "default_weight": ${unit === 'lb' ? '185' : '84'}
        }
      ]
    }
  ],
  "proposed_exercises": [
    {
      "name": "Landmine Press",
      "equipment": "Barbell",
      "body_part": "Shoulders",
      "reason": "Shoulder-friendly pressing variation"
    }
  ]
}
\`\`\`

Leave \`proposed_exercises\` as \`[]\` when there is nothing to propose.

---

## Current templates

${templateSummary}
${performanceTable(bundle, unit)}

---

## Exercise catalogue

These are the only names that may appear in \`exercise_name\`.

${catalogueTable(bundle)}

---

## The current data

The complete current state, in the format described above. Use it as the
starting point.

\`\`\`json
${JSON.stringify(options.includePerformance ? bundle : stripPerformance(bundle), null, 2)}
\`\`\`
`;
}
