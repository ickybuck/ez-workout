/*
 * What a tool hands back, shared by the read/log tools (tools.ts) and the
 * library/template editing tools (editTools.ts).
 *
 * These are annotated with CallToolResult rather than letting TypeScript infer
 * them. Inferred, the handler return type has to be reconciled against
 * registerTool's generics for every tool, and the compiler gives up with
 * TS2589 ("type instantiation is excessively deep"). Naming the type costs
 * nothing and keeps the whole file inferring in reasonable time.
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { format as formatWeight, type WeightUnit } from '../src/lib/weight';
import { AmbiguousExerciseError, UnknownExerciseError } from './matchExercise';
import { NotAdminError, NotYoursError } from './userScope';
import { LayoutError } from './templateLayout';
import type { TemplateDetail } from './queries';
import { provenanceNote } from '../src/lib/templateProvenance';

export function text(body: string): CallToolResult {
  return { content: [{ type: 'text', text: body }] };
}

export function fail(body: string): CallToolResult {
  return { content: [{ type: 'text', text: body }], isError: true };
}

/** Turns the expected refusals into something a person can act on. */
export async function guard(run: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await run();
  } catch (error) {
    if (
      error instanceof AmbiguousExerciseError ||
      error instanceof UnknownExerciseError ||
      error instanceof NotYoursError ||
      error instanceof NotAdminError ||
      error instanceof LayoutError
    ) {
      return fail(error.message);
    }
    throw error;
  }
}

/** One template as text: a heading, then one line per block. */
export function renderTemplate(t: TemplateDetail, unit: WeightUnit): string {
  const marks = [t.isFavorite ? 'favourite' : null, t.isHidden ? 'hidden' : null].filter(Boolean).join(', ');
  const head = `${t.name}${marks ? ` (${marks})` : ''} - ${t.category}`;

  let position = 0;
  const lines = t.blocks.map((block) => {
    const parts = block.map((row) => {
      position += 1;
      const sets = row.default_sets ?? '?';
      const reps = row.default_reps ?? '?';
      const weight = row.default_weight != null ? ` at ${formatWeight(row.default_weight, unit)}` : '';
      return `${position}. ${row.exerciseName} ${sets}x${reps}${weight}`;
    });
    return block.length > 1 ? `  superset: ${parts.join(' + ')}` : `  ${parts[0]}`;
  });

  // "the person" rather than "you": the reader is the model, relaying it.
  const note = provenanceNote(t, { self: 'the person' });
  return [head, `  (${note})`, ...lines].join('\n');
}
