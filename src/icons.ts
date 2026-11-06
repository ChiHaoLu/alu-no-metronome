import type { NoteId } from './notes';

interface Glyph {
  hollow?: boolean;
  dotted?: boolean;
  flags?: number;
  tuplet?: number;
}

const GLYPHS: Record<NoteId, Glyph> = {
  half: { hollow: true },
  dottedQuarter: { dotted: true },
  quarter: {},
  eighth: { flags: 1 },
  triplet: { flags: 1, tuplet: 3 },
  sixteenth: { flags: 2 },
  sextuplet: { flags: 2, tuplet: 6 },
  thirtySecond: { flags: 3 },
};

/**
 * Notes are drawn rather than typed: music symbols are missing or inconsistent
 * in the fonts that ship on many phones.
 */
export function noteIcon(id: NoteId): string {
  const { hollow, dotted, flags = 0, tuplet } = GLYPHS[id];
  const head = hollow
    ? '<ellipse cx="12" cy="22" rx="3.3" ry="2.4" transform="rotate(-20 12 22)" fill="none" stroke="currentColor" stroke-width="1.5"/>'
    : '<ellipse cx="12" cy="22" rx="3.6" ry="2.7" transform="rotate(-20 12 22)" fill="currentColor"/>';
  const stem = '<path d="M15.2 21V5" stroke="currentColor" stroke-width="1.4" fill="none"/>';
  const flagPaths = Array.from(
    { length: flags },
    (_, i) =>
      `<path d="M15.2 ${5 + i * 3.6}c.4 3.4 5 4.2 3.8 8.4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  ).join('');
  const dot = dotted ? '<circle cx="19" cy="22" r="1.5" fill="currentColor"/>' : '';
  const digit = tuplet
    ? `<text x="7" y="11" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">${tuplet}</text>`
    : '';
  return `<svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">${head}${stem}${flagPaths}${dot}${digit}</svg>`;
}
