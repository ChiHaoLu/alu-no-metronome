export type NoteId =
  | 'half'
  | 'dottedQuarter'
  | 'quarter'
  | 'eighth'
  | 'triplet'
  | 'sixteenth'
  | 'sextuplet'
  | 'thirtySecond';

export interface Note {
  id: NoteId;
  label: string;
  /** Length in beats, as a fraction, so triplets stay exact. */
  num: number;
  den: number;
}

export const NOTES: readonly Note[] = [
  { id: 'half', label: '二分音符', num: 2, den: 1 },
  { id: 'dottedQuarter', label: '附點四分音符', num: 3, den: 2 },
  { id: 'quarter', label: '四分音符', num: 1, den: 1 },
  { id: 'eighth', label: '八分音符', num: 1, den: 2 },
  { id: 'triplet', label: '三連音', num: 1, den: 3 },
  { id: 'sixteenth', label: '十六分音符', num: 1, den: 4 },
  { id: 'sextuplet', label: '六連音', num: 1, den: 6 },
  { id: 'thirtySecond', label: '三十二分音符', num: 1, den: 8 },
];

export function getNote(id: NoteId): Note {
  return NOTES.find((n) => n.id === id) ?? NOTES[2];
}

export function noteBeats(id: NoteId): number {
  const n = getNote(id);
  return n.num / n.den;
}

/** A note fits when a bar holds a whole number of them, e.g. half notes don't fit in 3 beats. */
export function fits(beats: number, id: NoteId): boolean {
  const n = getNote(id);
  return (beats * n.den) % n.num === 0;
}

export function ticksPerBar(beats: number, id: NoteId): number {
  const n = getNote(id);
  return (beats * n.den) / n.num;
}

export function isOnBeat(tick: number, id: NoteId): boolean {
  const n = getNote(id);
  return (tick * n.num) % n.den === 0;
}

/**
 * Carries accents over to a new grid by musical position, so an accent on
 * beat 3 stays on beat 3 whatever the note value. Positions with no
 * counterpart in the old grid start unaccented.
 */
export function remapAccents(
  accents: readonly boolean[],
  oldNote: NoteId,
  newBeats: number,
  newNote: NoteId,
): boolean[] {
  const from = getNote(oldNote);
  const to = getNote(newNote);
  return Array.from({ length: ticksPerBar(newBeats, newNote) }, (_, i) => {
    // old index = i * (to.num / to.den) / (from.num / from.den)
    const top = i * to.num * from.den;
    const bottom = to.den * from.num;
    return top % bottom === 0 ? (accents[top / bottom] ?? false) : false;
  });
}
