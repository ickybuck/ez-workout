import { describe, it, expect } from 'vitest';
import { provenanceNote } from './templateProvenance';

const now = new Date('2026-11-21T23:00:00');

describe('provenanceNote', () => {
  it('says who added it when nothing has changed since', () => {
    expect(provenanceNote({ created_via: 'user' }, { now })).toBe('Added by you');
    expect(provenanceNote({ created_via: 'claude' }, { now })).toBe('Added by Claude');
  });

  it('treats a missing source as the person (every template before EZ-53)', () => {
    expect(provenanceNote({}, { now })).toBe('Added by you');
  });

  it('adds the last editor and when', () => {
    const note = provenanceNote(
      { created_via: 'claude', last_edited_via: 'user', last_edited_at: '2026-11-21T22:24:00' },
      { now },
    );
    expect(note).toMatch(/^Added by Claude · last edited by you, /);
    expect(note).toContain('21');
    expect(note).not.toContain('2026');
  });

  it('shows the year for an edit in another year', () => {
    const note = provenanceNote(
      { created_via: 'user', last_edited_via: 'claude', last_edited_at: '2025-03-01T09:00:00' },
      { now },
    );
    expect(note).toMatch(/last edited by Claude, /);
    expect(note).toContain('2025');
  });

  it('names the viewer as asked', () => {
    expect(provenanceNote({ created_via: 'user' }, { self: 'Marilyn', now })).toBe('Added by Marilyn');
  });
});
