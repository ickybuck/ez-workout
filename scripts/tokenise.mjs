#!/usr/bin/env node
/**
 * Rewrite hardcoded Tailwind colours to semantic tokens.
 *
 * A migration aid, not a formatter — run it on a file, then read the diff. It
 * handles the mechanical bulk (there are several hundred call sites) and is
 * deliberately conservative about anything it cannot map confidently, leaving
 * those in place so they show up in the leftover count rather than being
 * silently guessed at.
 *
 * The mapping collapses several greys onto fewer roles on purpose. The original
 * markup used gray-400, -500 and -600 fairly interchangeably for "less
 * important text", and preserving that distinction would preserve an accident.
 */

import { readFileSync, writeFileSync } from 'node:fs';

/** Order matters: longer, more specific patterns first. */
const RULES = [
  // Surfaces
  [/\bbg-white\b/g, 'bg-surface-raised'],
  [/\bbg-gray-50\b/g, 'bg-surface'],
  [/\bbg-gray-100\b/g, 'bg-surface-sunken'],
  [/\bbg-gray-200\b/g, 'bg-surface-sunken'],
  [/\bhover:bg-gray-50\b/g, 'hover:bg-surface'],
  [/\bhover:bg-gray-100\b/g, 'hover:bg-surface-sunken'],
  [/\bhover:bg-gray-200\b/g, 'hover:bg-surface-sunken'],

  // Text
  [/\btext-gray-900\b/g, 'text-content'],
  [/\btext-gray-800\b/g, 'text-content'],
  [/\btext-gray-700\b/g, 'text-content-muted'],
  [/\btext-gray-600\b/g, 'text-content-muted'],
  [/\btext-gray-500\b/g, 'text-content-subtle'],
  [/\btext-gray-400\b/g, 'text-content-subtle'],
  [/\btext-gray-300\b/g, 'text-content-subtle'],
  [/\bhover:text-gray-900\b/g, 'hover:text-content'],
  [/\bhover:text-gray-700\b/g, 'hover:text-content'],
  [/\bhover:text-gray-600\b/g, 'hover:text-content'],

  // Edges
  [/\bborder-gray-100\b/g, 'border-edge'],
  [/\bborder-gray-200\b/g, 'border-edge'],
  [/\bborder-gray-300\b/g, 'border-edge-strong'],
  [/\bhover:border-gray-300\b/g, 'hover:border-edge-strong'],
  [/\bdivide-gray-200\b/g, 'divide-edge'],

  // Accent — indigo and blue were used interchangeably for the same role.
  [/\bbg-(?:indigo|blue)-600\b/g, 'bg-accent'],
  [/\bbg-(?:indigo|blue)-700\b/g, 'bg-accent-hover'],
  [/\bhover:bg-(?:indigo|blue)-700\b/g, 'hover:bg-accent-hover'],
  [/\bhover:bg-(?:indigo|blue)-800\b/g, 'hover:bg-accent-hover'],
  [/\bbg-(?:indigo|blue)-50\b/g, 'bg-accent-soft'],
  [/\bhover:bg-(?:indigo|blue)-50\b/g, 'hover:bg-accent-soft'],
  [/\bbg-(?:indigo|blue)-100\b/g, 'bg-accent-soft'],
  [/\btext-(?:indigo|blue)-600\b/g, 'text-accent'],
  [/\btext-(?:indigo|blue)-700\b/g, 'text-accent-content'],
  [/\btext-(?:indigo|blue)-800\b/g, 'text-accent-content'],
  [/\bhover:text-(?:indigo|blue)-600\b/g, 'hover:text-accent'],
  [/\bhover:text-(?:indigo|blue)-700\b/g, 'hover:text-accent-hover'],
  [/\bborder-(?:indigo|blue)-200\b/g, 'border-accent'],
  [/\bborder-(?:indigo|blue)-500\b/g, 'border-accent'],
  [/\bring-(?:indigo|blue)-500\b/g, 'ring-accent'],
  [/\bfocus:ring-(?:indigo|blue)-500\b/g, 'focus:ring-accent'],
  [/\bfocus:border-(?:indigo|blue)-500\b/g, 'focus:border-accent'],

  // Positive
  [/\bbg-(?:green|emerald)-600\b/g, 'bg-positive'],
  [/\bhover:bg-(?:green|emerald)-700\b/g, 'hover:bg-positive'],
  [/\bbg-(?:green|emerald)-500\b/g, 'bg-positive'],
  [/\bbg-(?:green|emerald)-50\b/g, 'bg-positive-soft'],
  [/\bbg-(?:green|emerald)-100\b/g, 'bg-positive-soft'],
  [/\btext-(?:green|emerald)-600\b/g, 'text-positive'],
  [/\btext-(?:green|emerald)-700\b/g, 'text-positive-content'],
  [/\btext-(?:green|emerald)-800\b/g, 'text-positive-content'],
  [/\bborder-(?:green|emerald)-200\b/g, 'border-positive'],

  // Caution
  [/\bbg-(?:yellow|amber)-600\b/g, 'bg-caution'],
  [/\bhover:bg-(?:yellow|amber)-700\b/g, 'hover:bg-caution'],
  [/\bbg-(?:yellow|amber)-500\b/g, 'bg-caution'],
  [/\bbg-(?:yellow|amber)-50\b/g, 'bg-caution-soft'],
  [/\bbg-(?:yellow|amber)-100\b/g, 'bg-caution-soft'],
  [/\bhover:bg-(?:yellow|amber)-100\b/g, 'hover:bg-caution-soft'],
  [/\btext-(?:yellow|amber)-600\b/g, 'text-caution'],
  [/\btext-(?:yellow|amber)-700\b/g, 'text-caution'],
  [/\btext-(?:yellow|amber)-800\b/g, 'text-caution-content'],
  [/\bborder-(?:yellow|amber)-200\b/g, 'border-caution'],
  [/\bhover:border-(?:yellow|amber)-300\b/g, 'hover:border-caution'],

  // Critical
  [/\bbg-red-600\b/g, 'bg-critical'],
  [/\bhover:bg-red-700\b/g, 'hover:bg-critical'],
  [/\bbg-red-50\b/g, 'bg-critical-soft'],
  [/\bhover:bg-red-50\b/g, 'hover:bg-critical-soft'],
  [/\bbg-red-100\b/g, 'bg-critical-soft'],
  [/\bhover:bg-red-200\b/g, 'hover:bg-critical-soft'],
  [/\btext-red-600\b/g, 'text-critical'],
  [/\btext-red-700\b/g, 'text-critical'],
  [/\btext-red-800\b/g, 'text-critical-content'],
  [/\bhover:text-red-600\b/g, 'hover:text-critical'],
  [/\bborder-red-200\b/g, 'border-critical'],
  [/\bhover:border-red-300\b/g, 'hover:border-critical'],
];

/** What is left over after a pass — reported so nothing is assumed converted. */
const LEFTOVER =
  /\b(?:bg|text|border|from|to|via|ring|divide|fill|stroke)-(?:white|black|gray|slate|zinc|neutral|blue|indigo|green|emerald|red|rose|yellow|amber|orange|purple|violet|fuchsia|teal|cyan|sky|lime|pink)(?:-\d{2,3})?\b/g;

let failed = false;

for (const path of process.argv.slice(2)) {
  const before = readFileSync(path, 'utf8');
  let after = before;
  for (const [pattern, replacement] of RULES) after = after.replace(pattern, replacement);

  if (after !== before) writeFileSync(path, after);

  const leftover = [...new Set(after.match(LEFTOVER) ?? [])];
  const changed = (before.match(LEFTOVER) ?? []).length - (after.match(LEFTOVER) ?? []).length;

  console.log(
    `${path}\n  converted ${changed}, leftover ${leftover.length}` +
      (leftover.length ? `: ${leftover.join(' ')}` : ''),
  );
  if (leftover.length) failed = true;
}

process.exit(failed ? 1 : 0);
