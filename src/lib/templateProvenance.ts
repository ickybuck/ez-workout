/**
 * The "who changed this" note on a template (EZ-53).
 *
 * The database stamps workout_templates.created_via on insert and
 * last_edited_via / last_edited_at on every later change to the template or
 * its exercise list: 'user' for the person in the app, 'claude' for the MCP
 * connector. See supabase/migrations/20261122050000_template_edit_provenance.sql.
 *
 * Shared by the app (Templates list, template editor) and the MCP server's
 * template listing, so both say it the same way.
 */

export type EditSource = 'user' | 'claude';

export interface TemplateProvenance {
  created_via?: string | null;
  last_edited_via?: string | null;
  last_edited_at?: string | null;
}

function who(source: string | null | undefined, self: string): string {
  return source === 'claude' ? 'Claude' : self;
}

function when(iso: string, now: Date): string {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === now.getFullYear();
  const day = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day}, ${time}`;
}

/**
 * "Added by you", "Added by Claude · last edited by you, Nov 21, 10:24 PM".
 * `self` is how the viewer is named: "you" in the app, a name elsewhere.
 */
export function provenanceNote(t: TemplateProvenance, { self = 'you', now = new Date() } = {}): string {
  const added = `Added by ${who(t.created_via, self)}`;
  if (!t.last_edited_via || !t.last_edited_at) return added;
  return `${added} · last edited by ${who(t.last_edited_via, self)}, ${when(t.last_edited_at, now)}`;
}
