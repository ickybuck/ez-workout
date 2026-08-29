/**
 * The template bundle — the file that travels between this app and an AI chat.
 *
 * Version 1 exported templates as a bare list of names and numbers. That works
 * for moving templates between two copies of this app, and fails in two ways
 * the moment a language model is the thing in the middle:
 *
 * 1. It never said what unit the weights were in. They were kilograms, and the
 *    CSV header said so, but the JSON did not — so a user working in pounds
 *    would hold a conversation in pounds, get 185 back, and import 185 KILOS.
 *    This is EZ-11 arriving through a different door, and it is why
 *    `weight_unit` is required rather than optional: a file that does not
 *    declare its units is not importable, full stop. Version 1 files are still
 *    read, and are read as kilograms, because that is what they meant.
 *
 * 2. It never said which exercises exist. So the model invented plausible
 *    names — "Barbell Bench Press" where the library holds "Bench Press" —
 *    and every import landed in the resolution modal. The bundle now carries
 *    the catalogue, and the instruction document tells the model it may only
 *    choose from it, putting anything else in `proposed_exercises` for a human
 *    to approve. That is the same instinct that made the exercise library hide
 *    rather than delete: make the existing thing easy to find, so the
 *    duplicate never gets created.
 *
 * Validation collects every problem rather than throwing on the first one.
 * That is deliberate: the output is meant to be pasted back into the chat that
 * produced the file, and a report listing all eleven mistakes gets fixed in one
 * turn where eleven separate round trips would not.
 */

import { convert, type WeightUnit } from './weight';

export const BUNDLE_SCHEMA_VERSION = '2.0';

/** Versions this app can read. Anything else is refused by name. */
export const SUPPORTED_SCHEMA_VERSIONS = ['1.0', '2.0'] as const;

export const TEMPLATE_CATEGORIES = [
  'Upper Body',
  'Lower Body',
  'Core Focused',
  'Whole Body',
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const TEMPLATE_TYPES = ['regular', 'superset'] as const;

export type TemplateType = (typeof TEMPLATE_TYPES)[number];

export interface CatalogueExercise {
  name: string;
  equipment: string | null;
  body_part: string | null;
}

export interface BundleTemplateExercise {
  order_index: number;
  exercise_name: string;
  default_sets: number;
  default_reps: number;
  /** In the bundle's `weight_unit`, not in storage units. */
  default_weight: number;
}

export interface BundleTemplate {
  name: string;
  description: string | null;
  template_type: TemplateType;
  category: TemplateCategory;
  exercises: BundleTemplateExercise[];
}

/**
 * An exercise the model wanted but could not find in the catalogue.
 *
 * Kept separate from `templates` on purpose. A model that needs something new
 * must say so out loud rather than smuggling an unknown name into a template,
 * because the import screen can then ask a human — which is the only thing
 * standing between "I need a decline press" and a fourth spelling of one.
 */
export interface ProposedExercise {
  name: string;
  equipment: string | null;
  body_part: string | null;
  reason: string | null;
}

/** Optional context so a model can programme from real numbers, not guesses. */
export interface PerformanceSummary {
  exercise_name: string;
  sessions: number;
  last_performed: string | null;
  best_weight: number;
  recent_weight: number;
  recent_reps: number;
  failed_rep_rate: number;
}

export interface TemplateBundle {
  schema_version: string;
  exported_at: string;
  weight_unit: WeightUnit;
  exercise_catalogue: CatalogueExercise[];
  templates: BundleTemplate[];
  proposed_exercises: ProposedExercise[];
  recent_performance?: PerformanceSummary[];
}

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  /** Where the problem is, in a form a model can act on: templates[0].exercises[3].default_reps */
  path: string;
  message: string;
  severity: IssueSeverity;
}

export interface ParseResult {
  bundle: TemplateBundle | null;
  issues: ValidationIssue[];
}

const error = (path: string, message: string): ValidationIssue => ({
  path,
  message,
  severity: 'error',
});

const warn = (path: string, message: string): ValidationIssue => ({
  path,
  message,
  severity: 'warning',
});

/**
 * Pull the JSON out of whatever the user pasted.
 *
 * The paste path exists because on Android, getting a file out of a chat app
 * and into an installed PWA is the worst step in the whole loop — so people
 * will select the reply and paste it. That reply is rarely bare JSON. It is
 * usually "Here are your updated templates:" followed by a fenced block
 * followed by an offer to explain the changes.
 *
 * Fenced blocks are tried first because a model that writes prose around its
 * JSON almost always fences the JSON. Only if there is no fence do we fall
 * back to bracket matching, which is string-aware so a brace inside an
 * exercise description cannot end the object early.
 */
export function extractJson(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Every fenced block, not just the first. The first one is often an example:
  // the instruction document this app hands out shows the format before it
  // shows the data, so taking the first fence would import the sample template
  // instead of the user's own — quietly, and with a plausible-looking result.
  // A model explaining its changes before restating the file does the same.
  //
  // So: among the blocks that parse, prefer the ones that actually look like a
  // bundle, and take the largest. Largest rather than last, because a reply
  // that ends with a short excerpt after the full file is just as likely as one
  // that builds up to it.
  const fences = [...trimmed.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/gi)]
    .map((match) => match[1]?.trim())
    .filter((block): block is string => !!block);

  const parseable = fences.filter((block) => {
    try {
      JSON.parse(block);
      return true;
    } catch {
      return false;
    }
  });

  const looksLikeBundle = parseable.filter((block) => {
    const parsed = JSON.parse(block) as unknown;
    return isRecord(parsed) && Array.isArray(parsed.templates);
  });

  const candidates = looksLikeBundle.length > 0 ? looksLikeBundle : parseable;
  if (candidates.length > 0) {
    return candidates.reduce((longest, block) => (block.length > longest.length ? block : longest));
  }

  // A fence that does not parse is still the best guess at intent — hand it
  // over so the JSON error names the real problem.
  if (fences.length > 0) return fences[fences.length - 1];

  // If the whole paste is already valid JSON, take it whole. This matters for
  // the shape a model reaches for first — a bare array of templates with no
  // envelope around it. Scanning for the first brace would dig an inner object
  // out of that array and report a confusing problem with it, when the real
  // problem is the missing envelope.
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // Not whole-file JSON. Fall through and go looking for an object in it.
  }

  const start = trimmed.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return trimmed.slice(start, i + 1);
    }
  }

  // An object that opens and never closes — a reply cut off mid-send, which
  // happens often enough to deserve its own answer. Hand back what there is so
  // the JSON parser reports the truncation. "Not valid JSON: unexpected end of
  // input" tells the user to paste the rest; "no JSON object found" sends them
  // looking for a problem that is not there.
  return trimmed.slice(start);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Read a number that a model may well have written as a string.
 *
 * Returns null rather than NaN so callers cannot accidentally propagate a NaN
 * into a weight column, which Postgres would take without complaint as null
 * and which nothing downstream would flag.
 */
function readNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function validateExercise(
  raw: unknown,
  path: string,
  fallbackOrder: number,
  issues: ValidationIssue[],
): BundleTemplateExercise | null {
  if (!isRecord(raw)) {
    issues.push(error(path, 'Must be an object.'));
    return null;
  }

  const name = readOptionalString(raw.exercise_name);
  if (!name) {
    issues.push(error(`${path}.exercise_name`, 'Required, and must be a non-empty string.'));
    return null;
  }

  const sets = readNumber(raw.default_sets);
  const reps = readNumber(raw.default_reps);
  const weight = readNumber(raw.default_weight);
  const order = readNumber(raw.order_index);

  if (sets === null || sets < 1 || !Number.isInteger(sets)) {
    issues.push(error(`${path}.default_sets`, 'Required, and must be a whole number of 1 or more.'));
  }
  if (reps === null || reps < 1 || !Number.isInteger(reps)) {
    issues.push(error(`${path}.default_reps`, 'Required, and must be a whole number of 1 or more.'));
  }
  // Zero is legitimate — bodyweight movements and planks carry no load — but a
  // negative weight is always a mistake, and a four-digit one is almost always
  // a unit confusion that the required weight_unit field was meant to prevent.
  if (weight === null || weight < 0) {
    issues.push(error(`${path}.default_weight`, 'Required, and must be 0 or more.'));
  } else if (weight > 2000) {
    issues.push(
      warn(`${path}.default_weight`, `${weight} is implausibly heavy — check the unit is right.`),
    );
  }

  if (sets === null || reps === null || weight === null || weight < 0) return null;

  return {
    order_index: order !== null && order >= 0 ? Math.trunc(order) : fallbackOrder,
    exercise_name: name,
    default_sets: Math.trunc(sets),
    default_reps: Math.trunc(reps),
    default_weight: weight,
  };
}

function validateTemplate(
  raw: unknown,
  path: string,
  issues: ValidationIssue[],
): BundleTemplate | null {
  if (!isRecord(raw)) {
    issues.push(error(path, 'Must be an object.'));
    return null;
  }

  const name = readOptionalString(raw.name);
  if (!name) {
    issues.push(error(`${path}.name`, 'Required, and must be a non-empty string.'));
  }

  const type = readOptionalString(raw.template_type) ?? 'regular';
  if (!TEMPLATE_TYPES.includes(type as TemplateType)) {
    issues.push(
      error(`${path}.template_type`, `Must be one of: ${TEMPLATE_TYPES.join(', ')}. Got "${type}".`),
    );
  }

  const category = readOptionalString(raw.category);
  const categoryValid = !!category && TEMPLATE_CATEGORIES.includes(category as TemplateCategory);
  if (!categoryValid) {
    issues.push(
      error(
        `${path}.category`,
        `Must be exactly one of: ${TEMPLATE_CATEGORIES.join(', ')}. Got ${
          category ? `"${category}"` : 'nothing'
        }.`,
      ),
    );
  }

  if (!Array.isArray(raw.exercises)) {
    issues.push(error(`${path}.exercises`, 'Required, and must be an array.'));
    return null;
  }

  if (raw.exercises.length === 0) {
    issues.push(warn(`${path}.exercises`, 'This template has no exercises and will import empty.'));
  }

  const exercises: BundleTemplateExercise[] = [];
  raw.exercises.forEach((rawExercise, i) => {
    const parsed = validateExercise(rawExercise, `${path}.exercises[${i}]`, i, issues);
    if (parsed) exercises.push(parsed);
  });

  // Duplicate order_index values are not fatal — the import sorts and reindexes
  // — but they mean the model's intended order is not recoverable, so say so.
  const orders = exercises.map((e) => e.order_index);
  if (new Set(orders).size !== orders.length) {
    issues.push(
      warn(
        `${path}.exercises`,
        'Two or more exercises share an order_index; the order shown may not be the one intended. Number them 0, 1, 2, … in the order they should be performed.',
      ),
    );
  }

  // A bad category is fatal to the template rather than something to coerce.
  // `category` is a narrow union in the app's types and drives grouping in
  // Insights; letting "Push" through because it happens to be a non-empty
  // string would put a value in the database that nothing else can read.
  if (!name || !categoryValid) return null;

  return {
    name,
    description: readOptionalString(raw.description),
    template_type: (TEMPLATE_TYPES.includes(type as TemplateType) ? type : 'regular') as TemplateType,
    category: category as TemplateCategory,
    exercises: exercises.sort((a, b) => a.order_index - b.order_index),
  };
}

function validateProposed(raw: unknown, path: string, issues: ValidationIssue[]): ProposedExercise | null {
  if (!isRecord(raw)) {
    issues.push(error(path, 'Must be an object.'));
    return null;
  }
  const name = readOptionalString(raw.name);
  if (!name) {
    issues.push(error(`${path}.name`, 'Required, and must be a non-empty string.'));
    return null;
  }
  return {
    name,
    equipment: readOptionalString(raw.equipment),
    body_part: readOptionalString(raw.body_part),
    reason: readOptionalString(raw.reason),
  };
}

/**
 * Parse and validate text into a bundle.
 *
 * Never throws for a content problem. A caller that gets `bundle: null` has a
 * file it cannot use; a caller that gets a bundle alongside warnings has one it
 * can use with reservations. Both cases want the issue list.
 */
export function parseBundle(text: string): ParseResult {
  const issues: ValidationIssue[] = [];

  const json = extractJson(text);
  if (!json) {
    issues.push(
      error(
        '(file)',
        'No JSON object found. Paste the whole reply including the ```json block, or upload the .json file.',
      ),
    );
    return { bundle: null, issues };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    issues.push(error('(file)', `Not valid JSON: ${e instanceof Error ? e.message : String(e)}`));
    return { bundle: null, issues };
  }

  if (!isRecord(raw)) {
    issues.push(error('(file)', 'The top level must be a JSON object.'));
    return { bundle: null, issues };
  }

  const version = readOptionalString(raw.schema_version);
  if (!version) {
    issues.push(
      error('schema_version', `Required. This app writes and reads "${BUNDLE_SCHEMA_VERSION}".`),
    );
    return { bundle: null, issues };
  }
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(version as (typeof SUPPORTED_SCHEMA_VERSIONS)[number])) {
    issues.push(
      error(
        'schema_version',
        `"${version}" is not a version this app understands. Supported: ${SUPPORTED_SCHEMA_VERSIONS.join(', ')}.`,
      ),
    );
    return { bundle: null, issues };
  }

  // The whole reason version 2 exists. A version 1 file predates the field and
  // was always kilograms, so it is read as kilograms and the user is told. A
  // version 2 file without it is refused rather than guessed at, because the
  // guess is the bug.
  let weightUnit: WeightUnit;
  const declaredUnit = readOptionalString(raw.weight_unit)?.toLowerCase();
  if (version === '1.0' && !declaredUnit) {
    weightUnit = 'kg';
    issues.push(
      warn(
        'weight_unit',
        'This is an older file with no unit declared. Weights are being read as kilograms, which is what version 1.0 always meant.',
      ),
    );
  } else if (declaredUnit === 'kg' || declaredUnit === 'lb') {
    weightUnit = declaredUnit;
  } else {
    issues.push(
      error(
        'weight_unit',
        `Required, and must be "kg" or "lb". ${
          declaredUnit ? `Got "${declaredUnit}".` : 'It was missing.'
        } Without it there is no way to know whether 185 means pounds or kilograms, so the file cannot be imported.`,
      ),
    );
    return { bundle: null, issues };
  }

  if (!Array.isArray(raw.templates)) {
    issues.push(error('templates', 'Required, and must be an array.'));
    return { bundle: null, issues };
  }

  const templates: BundleTemplate[] = [];
  raw.templates.forEach((rawTemplate, i) => {
    const parsed = validateTemplate(rawTemplate, `templates[${i}]`, issues);
    if (parsed) templates.push(parsed);
  });

  const seenNames = new Set<string>();
  for (const template of templates) {
    const key = template.name.toLowerCase();
    if (seenNames.has(key)) {
      issues.push(warn(`templates`, `More than one template is named "${template.name}".`));
    }
    seenNames.add(key);
  }

  const proposed: ProposedExercise[] = [];
  if (Array.isArray(raw.proposed_exercises)) {
    raw.proposed_exercises.forEach((rawProposed, i) => {
      const parsed = validateProposed(rawProposed, `proposed_exercises[${i}]`, issues);
      if (parsed) proposed.push(parsed);
    });
  }

  if (templates.length === 0) {
    issues.push(error('templates', 'No usable templates were found in this file.'));
    return { bundle: null, issues };
  }

  const catalogue: CatalogueExercise[] = Array.isArray(raw.exercise_catalogue)
    ? raw.exercise_catalogue
        .filter(isRecord)
        .map((c) => ({
          name: readOptionalString(c.name) ?? '',
          equipment: readOptionalString(c.equipment),
          body_part: readOptionalString(c.body_part),
        }))
        .filter((c) => c.name)
    : [];

  return {
    bundle: {
      schema_version: version,
      exported_at: readOptionalString(raw.exported_at) ?? new Date().toISOString(),
      weight_unit: weightUnit,
      exercise_catalogue: catalogue,
      templates,
      proposed_exercises: proposed,
    },
    issues,
  };
}

/**
 * Restate the bundle's weights in another unit.
 *
 * Import converts to kilograms for storage; export converts out of them. Both
 * go through here so there is exactly one place the conversion can be wrong,
 * and `weight.ts` is already tested to death after EZ-11.
 */
export function convertBundleWeights(bundle: TemplateBundle, to: WeightUnit): TemplateBundle {
  if (bundle.weight_unit === to) return bundle;

  return {
    ...bundle,
    weight_unit: to,
    templates: bundle.templates.map((template) => ({
      ...template,
      exercises: template.exercises.map((exercise) => ({
        ...exercise,
        default_weight: convert(exercise.default_weight, bundle.weight_unit, to),
      })),
    })),
  };
}

/**
 * Render issues as text meant to be pasted back into the chat that produced
 * the file.
 *
 * Written as instructions to the model rather than as a description of what
 * went wrong, because that is what it is for. The alternative — a user
 * paraphrasing "it said something about categories" — is how the loop breaks.
 */
export function formatIssueReport(issues: ValidationIssue[]): string {
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  const lines: string[] = [];

  if (errors.length > 0) {
    lines.push(
      `The workout app rejected the file. Fix every point below and return the corrected JSON in a single \`\`\`json block, with no other changes.`,
      '',
      `Errors (${errors.length}):`,
    );
    for (const issue of errors) lines.push(`- ${issue.path}: ${issue.message}`);
  } else {
    lines.push('The workout app accepted the file, with notes.');
  }

  if (warnings.length > 0) {
    lines.push('', `Warnings (${warnings.length}) — not fatal, but worth correcting:`);
    for (const issue of warnings) lines.push(`- ${issue.path}: ${issue.message}`);
  }

  lines.push(
    '',
    `Reminder: schema_version must be "${BUNDLE_SCHEMA_VERSION}", weight_unit must be "kg" or "lb" and must match the numbers you wrote, category must be exactly one of ${TEMPLATE_CATEGORIES.join(', ')}, and every exercise_name must appear in the exercise catalogue from the original file. Anything not in the catalogue belongs in proposed_exercises.`,
  );

  return lines.join('\n');
}
