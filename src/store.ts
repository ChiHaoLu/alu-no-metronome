import { NOTES, fits, ticksPerBar, type NoteId } from './notes';
import { clampBpm, type Settings } from './sequencer';

const KEY = 'alu-no-metronome';

export const MAX_BEATS = 16;
const MAX_STEP = 100;

export function defaults(): Settings {
  return {
    bpm: 120,
    beats: 4,
    note: 'quarter',
    accents: [true, false, false, false],
    countInBars: 0,
    auto: { enabled: false, every: 16, steps: [4] },
    volume: 1,
  };
}

/** Reads "+4 -2", tolerating full-width signs from a Chinese keyboard. */
export function parseSteps(text: string): number[] {
  const normalized = text.replace(/[−–—－]/g, '-').replace(/＋/g, '+');
  return (normalized.match(/[+-]?\d+/g) ?? [])
    .map(Number)
    .filter((n) => n !== 0)
    .map((n) => Math.max(-MAX_STEP, Math.min(MAX_STEP, n)));
}

export function formatStep(step: number): string {
  return step > 0 ? `+${step}` : `${step}`;
}

function intOr(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;
}

/** Saved data may come from an older version, so nothing in it is trusted. */
export function sanitize(raw: Partial<Settings>): Settings {
  const d = defaults();
  const beats = intOr(raw.beats, d.beats, 1, MAX_BEATS);
  const known = NOTES.some((n) => n.id === raw.note);
  const note: NoteId = known && fits(beats, raw.note as NoteId) ? (raw.note as NoteId) : 'quarter';
  const count = ticksPerBar(beats, note);
  const saved = Array.isArray(raw.accents) ? raw.accents : [];
  const steps = Array.isArray(raw.auto?.steps)
    ? parseSteps(raw.auto.steps.map(String).join(' '))
    : d.auto.steps;
  return {
    bpm: clampBpm(intOr(raw.bpm, d.bpm, 1, 1000)),
    beats,
    note,
    accents: Array.from({ length: count }, (_, i) =>
      saved.length === count ? saved[i] === true : i === 0,
    ),
    countInBars: intOr(raw.countInBars, d.countInBars, 0, 2),
    auto: {
      enabled: raw.auto?.enabled === true,
      every: intOr(raw.auto?.every, d.auto.every, 1, 999),
      steps: steps.length > 0 ? steps : d.auto.steps,
    },
    volume:
      typeof raw.volume === 'number' && Number.isFinite(raw.volume)
        ? Math.min(1, Math.max(0, raw.volume))
        : d.volume,
  };
}

export function load(): Settings {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY) ?? '{}'));
  } catch {
    return defaults();
  }
}

export function save(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Private mode or full storage: settings just won't survive a reload.
  }
}
