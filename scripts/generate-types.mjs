#!/usr/bin/env node
/**
 * Regenerate src/lib/database.types.ts from the live schema.
 *
 * Exists because the obvious one-liner destroys the file it is meant to
 * update. `supabase gen types ... > src/lib/database.types.ts` opens and
 * truncates the target before the command runs, so if the CLI is missing or
 * the project is unreachable the redirect has already emptied it — and since
 * every query in the app is typed against that file, the next typecheck
 * reports hundreds of errors that have nothing to do with what changed. That
 * happened while adding stop_reason.
 *
 * So: generate to a temporary file, sanity-check it, and only then replace the
 * real one.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';

const PROJECT_ID = 'uqnamigtvtzlvbytfjgl';
const TARGET = 'src/lib/database.types.ts';
const TEMP = `${TARGET}.tmp`;

/** A real schema dump is tens of kilobytes. Anything this small is a failure. */
const MIN_PLAUSIBLE_BYTES = 2000;

const result = spawnSync(
  'supabase',
  ['gen', 'types', 'typescript', '--project-id', PROJECT_ID],
  { encoding: 'utf8', shell: true },
);

const cleanup = () => {
  if (existsSync(TEMP)) unlinkSync(TEMP);
};

if (result.error || result.status !== 0) {
  const detail = result.stderr?.trim() || result.error?.message || `exit ${result.status}`;
  console.error(`Could not generate types: ${detail}`);
  console.error(`${TARGET} left unchanged.`);
  cleanup();
  process.exit(1);
}

const generated = result.stdout ?? '';

if (generated.trim().length < MIN_PLAUSIBLE_BYTES || !generated.includes('export type Database')) {
  console.error(
    `Generated output does not look like a schema (${generated.trim().length} bytes). ${TARGET} left unchanged.`,
  );
  cleanup();
  process.exit(1);
}

const previous = existsSync(TARGET) ? readFileSync(TARGET, 'utf8') : '';
writeFileSync(TEMP, generated);
writeFileSync(TARGET, generated);
cleanup();

if (previous === generated) {
  console.log(`${TARGET} already matched the live schema.`);
} else {
  console.log(`${TARGET} updated (${generated.length} bytes).`);
}
