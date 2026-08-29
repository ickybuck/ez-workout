#!/usr/bin/env node
/**
 * Quality ratchet.
 *
 * This app carries a backlog of type and lint errors inherited from its
 * bolt.new origin. Turning the build red on all of them at once would mean
 * either a risky big-bang refactor or, more likely, someone disabling the
 * check. So instead we record the counts and fail only when they INCREASE.
 *
 * Burn the backlog down however you like; the ratchet just guarantees it
 * never grows. When a count drops, this script tells you to commit the new
 * baseline, which is what makes the progress stick.
 *
 * Run `node scripts/quality-ratchet.mjs --update` to write the current
 * counts to the baseline deliberately.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(root, 'quality-baseline.json');
const update = process.argv.includes('--update');

/** Run a command and return its combined output, ignoring a non-zero exit. */
function run(command) {
  try {
    return execSync(command, { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  } catch (error) {
    // Both tsc and eslint exit non-zero when they find problems, which is
    // the normal case here — the output is what we actually want.
    return `${error.stdout ?? ''}${error.stderr ?? ''}`;
  }
}

function countTypeErrors() {
  const output = run('npx tsc -b --force --pretty false');
  return (output.match(/error TS\d+/g) ?? []).length;
}

function countLintErrors() {
  const output = run('npx eslint . --format json');
  const start = output.indexOf('[');
  if (start === -1) {
    throw new Error(`Could not parse eslint output:\n${output.slice(0, 500)}`);
  }
  const results = JSON.parse(output.slice(start));
  return results.reduce((total, file) => total + file.errorCount, 0);
}

const current = { typeErrors: countTypeErrors(), lintErrors: countLintErrors() };

if (update || !existsSync(baselinePath)) {
  writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`Baseline written: ${current.typeErrors} type, ${current.lintErrors} lint.`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const checks = [
  { label: 'Type errors', key: 'typeErrors' },
  { label: 'Lint errors', key: 'lintErrors' },
];

let failed = false;
let improved = false;

for (const { label, key } of checks) {
  const now = current[key];
  const then = baseline[key];
  if (now > then) {
    console.error(`✗ ${label}: ${now} (baseline ${then}) — up by ${now - then}.`);
    failed = true;
  } else if (now < then) {
    console.log(`✓ ${label}: ${now} (baseline ${then}) — down by ${then - now}.`);
    improved = true;
  } else {
    console.log(`= ${label}: ${now}, unchanged.`);
  }
}

if (failed) {
  console.error('\nThe backlog grew. Fix the new errors, or explain in the PR why the');
  console.error('baseline should move up — but it should almost never move up.');
  process.exit(1);
}

if (improved) {
  console.log('\nProgress. Run `npm run ratchet:update` and commit quality-baseline.json');
  console.log('so the improvement is locked in.');
}
