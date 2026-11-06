import { describe, expect, it } from 'vitest';
import { fits, isOnBeat, remapAccents, ticksPerBar, type NoteId } from './notes';
import { Sequencer, type Settings, type Tick } from './sequencer';

function settings(overrides: Partial<Settings> = {}): Settings {
  const beats = overrides.beats ?? 4;
  const note: NoteId = overrides.note ?? 'quarter';
  const accents = Array.from({ length: ticksPerBar(beats, note) }, (_, i) => i === 0);
  return {
    bpm: 120,
    beats,
    note,
    accents,
    countInBars: 0,
    auto: { enabled: false, every: 16, steps: [4] },
    volume: 1,
    ...overrides,
  };
}

function take(seq: Sequencer, n: number): Tick[] {
  return Array.from({ length: n }, () => seq.next());
}

/** First tick of each bar, keyed by the BPM it sounded at. */
function barStarts(ticks: Tick[]): Tick[] {
  return ticks.filter((t) => t.index === 0);
}

describe('notes', () => {
  it('counts how many of each note fill a bar', () => {
    expect(ticksPerBar(4, 'half')).toBe(2);
    expect(ticksPerBar(4, 'quarter')).toBe(4);
    expect(ticksPerBar(4, 'eighth')).toBe(8);
    expect(ticksPerBar(4, 'triplet')).toBe(12);
    expect(ticksPerBar(4, 'sixteenth')).toBe(16);
    expect(ticksPerBar(4, 'sextuplet')).toBe(24);
    expect(ticksPerBar(4, 'thirtySecond')).toBe(32);
    expect(ticksPerBar(6, 'dottedQuarter')).toBe(4);
  });

  it('rejects notes that do not divide the bar evenly', () => {
    expect(fits(3, 'half')).toBe(false);
    expect(fits(4, 'half')).toBe(true);
    expect(fits(4, 'dottedQuarter')).toBe(false);
    expect(fits(3, 'dottedQuarter')).toBe(true);
    expect(fits(7, 'triplet')).toBe(true);
  });

  it('marks which ticks land on a beat', () => {
    expect([0, 1, 2, 3].map((i) => isOnBeat(i, 'triplet'))).toEqual([true, false, false, true]);
    expect([0, 1, 2].map((i) => isOnBeat(i, 'dottedQuarter'))).toEqual([true, false, true]);
    expect([0, 1].map((i) => isOnBeat(i, 'half'))).toEqual([true, true]);
  });

  it('keeps accents on the same beat when the note changes', () => {
    const quarters = [true, false, true, false];
    expect(remapAccents(quarters, 'quarter', 4, 'eighth')).toEqual([
      true, false, false, false, true, false, false, false,
    ]);
    expect(remapAccents(quarters, 'quarter', 4, 'half')).toEqual([true, true]);
    // Off-beat eighths have no quarter-note counterpart and are dropped.
    expect(remapAccents([false, true, true, false], 'eighth', 1, 'quarter')).toEqual([false]);
    // Triplet grid vs sixteenth grid share only the beat.
    expect(remapAccents(Array(12).fill(true), 'triplet', 4, 'sixteenth').filter(Boolean)).toHaveLength(4);
  });

  it('adds empty beats when the bar grows and drops them when it shrinks', () => {
    expect(remapAccents([true, true], 'quarter', 4, 'quarter')).toEqual([true, true, false, false]);
    expect(remapAccents([true, false, false, true], 'quarter', 2, 'quarter')).toEqual([true, false]);
  });
});

describe('Sequencer rhythm', () => {
  it('spaces quarter notes by the BPM and loops the bar', () => {
    const ticks = take(new Sequencer(settings(), 10), 5);
    expect(ticks.map((t) => t.time)).toEqual([10, 10.5, 11, 11.5, 12]);
    expect(ticks.map((t) => t.index)).toEqual([0, 1, 2, 3, 0]);
    expect(ticks.map((t) => t.bar)).toEqual([1, 1, 1, 1, 2]);
  });

  it('gives accent, beat and subdivision their own level', () => {
    const accents = [true, false, false, false, false, false, false, true];
    const ticks = take(new Sequencer(settings({ note: 'eighth', accents }), 0), 8);
    expect(ticks.map((t) => t.level)).toEqual([
      'accent', 'sub', 'beat', 'sub', 'beat', 'sub', 'beat', 'accent',
    ]);
    expect(ticks[1].time).toBeCloseTo(0.25);
  });

  it('keeps triplets exact over a long run', () => {
    const seq = new Sequencer(settings({ note: 'triplet' }), 0);
    const ticks = take(seq, 12 * 100 + 1);
    expect(ticks[ticks.length - 1].time).toBeCloseTo(200, 6);
  });

  it('plays half notes across two beats', () => {
    const ticks = take(new Sequencer(settings({ note: 'half' }), 0), 3);
    expect(ticks.map((t) => t.time)).toEqual([0, 1, 2]);
    expect(ticks.map((t) => t.index)).toEqual([0, 1, 0]);
  });

  it('picks up accent and BPM edits on the next tick', () => {
    const s = settings();
    const seq = new Sequencer(s, 0);
    seq.next();
    s.accents[1] = true;
    s.bpm = 60;
    const second = seq.next();
    expect(second.level).toBe('accent');
    const third = seq.next();
    expect(third.time - second.time).toBeCloseTo(1);
  });
});

describe('Sequencer count-in', () => {
  it('plays one bar of beats, then starts bar 1 on time', () => {
    const s = settings({ note: 'sixteenth', countInBars: 1 });
    const ticks = take(new Sequencer(s, 0), 5);
    expect(ticks.slice(0, 4).map((t) => t.level)).toEqual(['count-accent', 'count', 'count', 'count']);
    expect(ticks.slice(0, 4).map((t) => t.countIn?.beat)).toEqual([1, 2, 3, 4]);
    expect(ticks.slice(0, 4).map((t) => t.index)).toEqual([null, null, null, null]);
    expect(ticks[4]).toMatchObject({ time: 2, index: 0, bar: 1, level: 'accent', countIn: null });
  });

  it('accents the start of each bar across two bars', () => {
    const s = settings({ beats: 3, countInBars: 2 });
    const ticks = take(new Sequencer(s, 0), 7);
    expect(ticks.slice(0, 6).map((t) => t.level)).toEqual([
      'count-accent', 'count', 'count', 'count-accent', 'count', 'count',
    ]);
    expect(ticks[6].bar).toBe(1);
  });

  it('is skipped when off', () => {
    expect(new Sequencer(settings(), 0).next().index).toBe(0);
  });

  it('does not count toward auto tempo', () => {
    const s = settings({ beats: 2, countInBars: 1, auto: { enabled: true, every: 1, steps: [4] } });
    const ticks = take(new Sequencer(s, 0), 4);
    expect(ticks.map((t) => t.bpm)).toEqual([120, 120, 120, 120]);
    expect(s.bpm).toBe(120);
  });
});

describe('Sequencer auto tempo', () => {
  it('raises the BPM on the first beat after every N bars', () => {
    const s = settings({ auto: { enabled: true, every: 16, steps: [4] } });
    const ticks = take(new Sequencer(s, 0), 4 * 33);
    const starts = barStarts(ticks);
    expect(starts[15]).toMatchObject({ bar: 16, bpm: 120, bpmChanged: false, barsLeft: 1 });
    expect(starts[16]).toMatchObject({ bar: 17, bpm: 124, bpmChanged: true, barsLeft: 16 });
    expect(starts[31]).toMatchObject({ bar: 32, bpm: 124, bpmChanged: false });
    expect(starts[32]).toMatchObject({ bar: 33, bpm: 128, bpmChanged: true });
  });

  it('plays the last bar at the old tempo and the new bar at the new one', () => {
    const s = settings({ beats: 1, bpm: 60, auto: { enabled: true, every: 1, steps: [60] } });
    const ticks = take(new Sequencer(s, 0), 3);
    // 60 BPM → next beat 1s later, then 120 BPM → 0.5s.
    expect(ticks.map((t) => t.time)).toEqual([0, 1, 1.5]);
  });

  it('can slow down', () => {
    const s = settings({ beats: 1, auto: { enabled: true, every: 2, steps: [-2] } });
    expect(take(new Sequencer(s, 0), 5).map((t) => t.bpm)).toEqual([120, 120, 118, 118, 116]);
  });

  it('takes turns through several steps', () => {
    const s = settings({ beats: 1, auto: { enabled: true, every: 1, steps: [4, -2] } });
    const ticks = take(new Sequencer(s, 0), 5);
    expect(ticks.map((t) => t.bpm)).toEqual([120, 124, 122, 126, 124]);
    expect(ticks.map((t) => t.nextStep)).toEqual([4, -2, 4, -2, 4]);
  });

  it('stops at the tempo limits', () => {
    const s = settings({ beats: 1, bpm: 298, auto: { enabled: true, every: 1, steps: [4] } });
    const ticks = take(new Sequencer(s, 0), 3);
    expect(ticks.map((t) => t.bpm)).toEqual([298, 300, 300]);
    expect(ticks.map((t) => t.bpmChanged)).toEqual([false, true, false]);
  });

  it('does nothing when off', () => {
    const s = settings({ beats: 1, auto: { enabled: false, every: 1, steps: [4] } });
    const ticks = take(new Sequencer(s, 0), 3);
    expect(ticks.map((t) => t.bpm)).toEqual([120, 120, 120]);
    expect(ticks[0].barsLeft).toBeNull();
  });

  it('restarts the count when asked', () => {
    const s = settings({ beats: 1, auto: { enabled: true, every: 2, steps: [4] } });
    const seq = new Sequencer(s, 0);
    take(seq, 1);
    seq.restartAutoCount();
    expect(take(seq, 3).map((t) => t.bpm)).toEqual([120, 120, 124]);
  });
});

describe('Sequencer reshape', () => {
  it('stays on the pulse when going from quarters to eighths', () => {
    const s = settings();
    const seq = new Sequencer(s, 0);
    take(seq, 2); // next is beat 3, at 1.0s
    s.note = 'eighth';
    s.accents = remapAccents(s.accents, 'quarter', 4, 'eighth');
    seq.reshape('quarter');
    const [a, b] = take(seq, 2);
    expect(a).toMatchObject({ index: 4, time: 1 });
    expect(b).toMatchObject({ index: 5, time: 1.25 });
  });

  it('moves to the next shared beat when going from eighths to quarters', () => {
    const s = settings({ note: 'eighth' });
    const seq = new Sequencer(s, 0);
    take(seq, 3); // next is the "and" of beat 2, at 0.75s
    s.note = 'quarter';
    s.accents = remapAccents(s.accents, 'eighth', 4, 'quarter');
    seq.reshape('eighth');
    expect(seq.next()).toMatchObject({ index: 2, time: 1 });
  });

  it('starts a new bar when the bar shrinks past the current position', () => {
    const s = settings();
    const seq = new Sequencer(s, 0);
    take(seq, 3); // next is beat 4, at 1.5s
    s.beats = 2;
    s.accents = remapAccents(s.accents, 'quarter', 2, 'quarter');
    seq.reshape('quarter');
    expect(seq.next()).toMatchObject({ index: 0, bar: 2, time: 1.5 });
  });

  it('leaves the count-in alone', () => {
    const s = settings({ countInBars: 1 });
    const seq = new Sequencer(s, 0);
    take(seq, 1);
    s.note = 'eighth';
    seq.reshape('quarter');
    expect(seq.next()).toMatchObject({ level: 'count', time: 0.5 });
  });
});
