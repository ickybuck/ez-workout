import { describe, it, expect } from 'vitest';
import {
  extractJson,
  parseBundle,
  convertBundleWeights,
  formatIssueReport,
  BUNDLE_SCHEMA_VERSION,
  type TemplateBundle,
} from './templateBundle';

const validTemplate = {
  name: 'Push Upper Focused',
  description: 'Chest, shoulders and triceps',
  template_type: 'regular',
  category: 'Upper Body',
  exercises: [
    { order_index: 0, exercise_name: 'Bench Press', default_sets: 3, default_reps: 10, default_weight: 185 },
    { order_index: 1, exercise_name: 'Shoulder Press', default_sets: 3, default_reps: 10, default_weight: 95 },
  ],
};

const validBundle = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    schema_version: BUNDLE_SCHEMA_VERSION,
    exported_at: '2026-08-29T00:00:00.000Z',
    weight_unit: 'lb',
    exercise_catalogue: [{ name: 'Bench Press', equipment: 'Barbell', body_part: 'Chest' }],
    templates: [validTemplate],
    proposed_exercises: [],
    ...overrides,
  });

const errorsOf = (text: string) =>
  parseBundle(text).issues.filter((i) => i.severity === 'error');

describe('extractJson', () => {
  it('reads bare JSON', () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}');
  });

  it('reads JSON out of a fenced block surrounded by chat prose', () => {
    // The realistic paste on Android: the user selects the whole reply.
    const reply = 'Here are your updated templates:\n\n```json\n{"a":1}\n```\n\nWant me to explain?';
    expect(extractJson(reply)).toBe('{"a":1}');
  });

  it('reads a fence with no language tag', () => {
    expect(extractJson('sure:\n```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('finds the object when there is prose but no fence', () => {
    expect(extractJson('Here you go: {"a":1} — let me know.')).toBe('{"a":1}');
  });

  it('does not stop at a brace inside a string', () => {
    // A description containing a brace would truncate a naive bracket scan,
    // producing "not valid JSON" for a file that is perfectly fine.
    const text = 'text {"description":"leg day }} hard","a":1} tail';
    expect(extractJson(text)).toBe('{"description":"leg day }} hard","a":1}');
  });

  it('does not stop at a brace that was escaped', () => {
    const text = '{"description":"a \\" quote } here","a":1}';
    expect(extractJson(text)).toBe(text);
  });

  it('returns null for text with no object at all', () => {
    expect(extractJson('I could not do that.')).toBeNull();
    expect(extractJson('   ')).toBeNull();
  });
});

describe('the unit rule', () => {
  it('accepts a bundle that declares its unit', () => {
    const { bundle, issues } = parseBundle(validBundle());
    expect(bundle?.weight_unit).toBe('lb');
    expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('refuses a v2 bundle with no weight_unit rather than guessing', () => {
    // The entire reason this schema version exists. Guessing is the bug:
    // 185 lb silently stored as 185 kg is EZ-11 all over again.
    const text = validBundle({ weight_unit: undefined });
    const errors = errorsOf(text);
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toBe('weight_unit');
    expect(parseBundle(text).bundle).toBeNull();
  });

  it('refuses a unit it does not recognise', () => {
    expect(errorsOf(validBundle({ weight_unit: 'pounds' }))[0].path).toBe('weight_unit');
  });

  it('reads a version 1.0 file as kilograms, and says so', () => {
    // v1 had no field but was always kg, so this is knowledge, not a guess.
    const text = JSON.stringify({
      schema_version: '1.0',
      templates: [validTemplate],
    });
    const { bundle, issues } = parseBundle(text);
    expect(bundle?.weight_unit).toBe('kg');
    expect(issues.some((i) => i.severity === 'warning' && i.path === 'weight_unit')).toBe(true);
  });

  it('refuses a schema version from the future', () => {
    expect(errorsOf(validBundle({ schema_version: '9.0' }))[0].path).toBe('schema_version');
  });
});

describe('template validation', () => {
  it('rejects a category that is not one of the four', () => {
    const text = validBundle({
      templates: [{ ...validTemplate, category: 'Push' }],
    });
    const errors = errorsOf(text);
    expect(errors.some((e) => e.path === 'templates[0].category')).toBe(true);
    // And the message must name the valid values, since it is written to be
    // pasted back into the chat that got it wrong.
    expect(errors.find((e) => e.path === 'templates[0].category')?.message).toContain('Upper Body');
  });

  it('collects every problem instead of stopping at the first', () => {
    const text = validBundle({
      templates: [
        {
          name: '',
          category: 'Nonsense',
          template_type: 'circuit',
          exercises: [{ exercise_name: '', default_sets: 0, default_reps: -1, default_weight: -5 }],
        },
      ],
    });
    // One round trip should fix all of it, not one problem per round trip.
    expect(errorsOf(text).length).toBeGreaterThanOrEqual(5);
  });

  it('accepts numbers written as strings, which models do constantly', () => {
    const text = validBundle({
      templates: [
        {
          ...validTemplate,
          exercises: [
            { order_index: '0', exercise_name: 'Bench Press', default_sets: '3', default_reps: '10', default_weight: '185' },
          ],
        },
      ],
    });
    const { bundle } = parseBundle(text);
    expect(bundle?.templates[0].exercises[0].default_sets).toBe(3);
    expect(bundle?.templates[0].exercises[0].default_weight).toBe(185);
  });

  it('allows a zero weight, because planks and push-ups carry none', () => {
    const text = validBundle({
      templates: [
        {
          ...validTemplate,
          exercises: [{ order_index: 0, exercise_name: 'Plank', default_sets: 3, default_reps: 1, default_weight: 0 }],
        },
      ],
    });
    expect(errorsOf(text)).toHaveLength(0);
  });

  it('warns about an implausible weight rather than refusing it', () => {
    const text = validBundle({
      templates: [
        {
          ...validTemplate,
          exercises: [{ order_index: 0, exercise_name: 'Leg Press', default_sets: 3, default_reps: 10, default_weight: 5000 }],
        },
      ],
    });
    const { bundle, issues } = parseBundle(text);
    expect(bundle).not.toBeNull();
    expect(issues.some((i) => i.severity === 'warning' && i.message.includes('unit'))).toBe(true);
  });

  it('sorts exercises by order_index and warns when two collide', () => {
    const text = validBundle({
      templates: [
        {
          ...validTemplate,
          exercises: [
            { order_index: 2, exercise_name: 'C', default_sets: 3, default_reps: 10, default_weight: 10 },
            { order_index: 0, exercise_name: 'A', default_sets: 3, default_reps: 10, default_weight: 10 },
            { order_index: 0, exercise_name: 'B', default_sets: 3, default_reps: 10, default_weight: 10 },
          ],
        },
      ],
    });
    const { bundle, issues } = parseBundle(text);
    expect(bundle?.templates[0].exercises.map((e) => e.exercise_name)).toEqual(['A', 'B', 'C']);
    expect(issues.some((i) => i.severity === 'warning' && i.path.endsWith('.exercises'))).toBe(true);
  });

  it('keeps the good templates when one is unusable', () => {
    const text = validBundle({
      templates: [validTemplate, { name: 'Broken', category: 'Nope', exercises: [] }],
    });
    const { bundle } = parseBundle(text);
    expect(bundle?.templates).toHaveLength(1);
    expect(bundle?.templates[0].name).toBe('Push Upper Focused');
  });

  it('carries proposed exercises through rather than dropping them', () => {
    const text = validBundle({
      proposed_exercises: [
        { name: 'Landmine Press', equipment: 'Barbell', body_part: 'Shoulders', reason: 'Shoulder-friendly press' },
      ],
    });
    expect(parseBundle(text).bundle?.proposed_exercises[0].name).toBe('Landmine Press');
  });
});

describe('parse failures a user will actually hit', () => {
  it('explains an empty paste', () => {
    expect(errorsOf('')[0].message).toContain('No JSON object found');
  });

  it('explains truncated JSON', () => {
    expect(errorsOf('{"schema_version": "2.0", "templates": [')[0].message).toContain('Not valid JSON');
  });

  it('refuses a bare array, which is the shape a model reaches for first', () => {
    expect(errorsOf('[{"name":"Push"}]')[0].path).toBe('(file)');
  });
});

describe('convertBundleWeights', () => {
  const bundle: TemplateBundle = {
    schema_version: BUNDLE_SCHEMA_VERSION,
    exported_at: '2026-08-29T00:00:00.000Z',
    weight_unit: 'kg',
    exercise_catalogue: [],
    templates: [
      {
        name: 'T',
        description: null,
        template_type: 'regular',
        category: 'Upper Body',
        exercises: [
          { order_index: 0, exercise_name: 'Bench Press', default_sets: 3, default_reps: 10, default_weight: 100 },
        ],
      },
    ],
    proposed_exercises: [],
  };

  it('converts and restates the unit', () => {
    const converted = convertBundleWeights(bundle, 'lb');
    expect(converted.weight_unit).toBe('lb');
    expect(converted.templates[0].exercises[0].default_weight).toBeCloseTo(220.46, 2);
  });

  it('is a no-op when the unit already matches', () => {
    expect(convertBundleWeights(bundle, 'kg')).toBe(bundle);
  });

  it('round-trips without drifting', () => {
    const there = convertBundleWeights(bundle, 'lb');
    const back = convertBundleWeights(there, 'kg');
    expect(back.templates[0].exercises[0].default_weight).toBeCloseTo(100, 6);
  });

  it('does not mutate the bundle it was given', () => {
    convertBundleWeights(bundle, 'lb');
    expect(bundle.weight_unit).toBe('kg');
    expect(bundle.templates[0].exercises[0].default_weight).toBe(100);
  });
});

describe('formatIssueReport', () => {
  it('tells the model what to do, not just what happened', () => {
    const report = formatIssueReport(errorsOf(validBundle({ weight_unit: undefined })));
    expect(report).toContain('return the corrected JSON');
    expect(report).toContain('weight_unit');
  });

  it('lists warnings separately and says they are not fatal', () => {
    const { issues } = parseBundle(
      validBundle({
        templates: [
          {
            ...validTemplate,
            exercises: [{ order_index: 0, exercise_name: 'Leg Press', default_sets: 3, default_reps: 10, default_weight: 9999 }],
          },
        ],
      }),
    );
    const report = formatIssueReport(issues);
    expect(report).toContain('Warnings');
    expect(report).toContain('not fatal');
  });

  it('always restates the rules, so a partial paste still carries them', () => {
    expect(formatIssueReport([])).toContain('proposed_exercises');
  });
});
