import { isOnBeat, noteBeats, ticksPerBar, type NoteId } from './notes';

export const MIN_BPM = 20;
export const MAX_BPM = 300;

export function clampBpm(bpm: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

export interface AutoTempo {
  enabled: boolean;
  /** Change tempo after this many bars. */
  every: number;
  /** Applied in turn, so [4, -2] means up 4, down 2, up 4, ... */
  steps: number[];
}

export interface Settings {
  bpm: number;
  beats: number;
  note: NoteId;
  accents: boolean[];
  countInBars: number;
  auto: AutoTempo;
  /** 0 to 1, as the slider shows it. */
  volume: number;
}

export type Level = 'accent' | 'beat' | 'sub' | 'count-accent' | 'count';

export interface Tick {
  time: number;
  level: Level;
  /** Position in the accent grid; null during the count-in. */
  index: number | null;
  /** 1-based bar number; 0 during the count-in. */
  bar: number;
  bpm: number;
  /** True on the tick where auto tempo changed the BPM. */
  bpmChanged: boolean;
  countIn: { beat: number; total: number } | null;
  /** Bars until the next auto tempo change, including this one. */
  barsLeft: number | null;
  nextStep: number | null;
}

/**
 * Produces the click sequence one tick at a time, with no audio or DOM, so
 * the timing can be tested exactly. Reads `settings` live: BPM and accent edits
 * take effect on the next tick. Auto tempo writes back to `settings.bpm`.
 */
export class Sequencer {
  private tick = 0;
  private bar = 1;
  private barsSinceChange = 0;
  private stepIndex = 0;
  private countInDone = 0;
  private readonly countInTotal: number;
  private readonly countInBeatsPerBar: number;
  nextTime: number;

  constructor(
    private readonly settings: Settings,
    startTime: number,
  ) {
    this.nextTime = startTime;
    this.countInBeatsPerBar = settings.beats;
    this.countInTotal = settings.countInBars * settings.beats;
  }

  next(): Tick {
    return this.countInDone < this.countInTotal ? this.nextCountIn() : this.nextMain();
  }

  private nextCountIn(): Tick {
    const s = this.settings;
    const beat = this.countInDone % this.countInBeatsPerBar;
    const tick: Tick = {
      time: this.nextTime,
      level: beat === 0 ? 'count-accent' : 'count',
      index: null,
      bar: 0,
      bpm: s.bpm,
      bpmChanged: false,
      countIn: { beat: beat + 1, total: this.countInBeatsPerBar },
      barsLeft: null,
      nextStep: null,
    };
    this.countInDone++;
    this.nextTime += 60 / s.bpm;
    return tick;
  }

  private nextMain(): Tick {
    const s = this.settings;
    const bpmChanged = this.tick === 0 && this.applyAutoTempo();
    const onBeat = isOnBeat(this.tick, s.note);
    const auto = s.auto.enabled && s.auto.steps.length > 0;

    const tick: Tick = {
      time: this.nextTime,
      level: s.accents[this.tick] ? 'accent' : onBeat ? 'beat' : 'sub',
      index: this.tick,
      bar: this.bar,
      bpm: s.bpm,
      bpmChanged,
      countIn: null,
      barsLeft: auto ? Math.max(1, s.auto.every - this.barsSinceChange) : null,
      nextStep: auto ? s.auto.steps[this.stepIndex % s.auto.steps.length] : null,
    };

    this.nextTime += (60 / s.bpm) * noteBeats(s.note);
    this.tick++;
    if (this.tick >= ticksPerBar(s.beats, s.note)) {
      this.tick = 0;
      this.bar++;
      this.barsSinceChange++;
    }
    return tick;
  }

  private applyAutoTempo(): boolean {
    const { auto, bpm } = this.settings;
    if (!auto.enabled || auto.steps.length === 0) return false;
    if (this.barsSinceChange < auto.every) return false;
    this.barsSinceChange = 0;
    const step = auto.steps[this.stepIndex % auto.steps.length];
    this.stepIndex = (this.stepIndex + 1) % auto.steps.length;
    this.settings.bpm = clampBpm(bpm + step);
    return this.settings.bpm !== bpm;
  }

  /** Call after turning auto tempo on or editing it, so the count starts from here. */
  restartAutoCount(): void {
    this.barsSinceChange = 0;
    this.stepIndex = 0;
  }

  /**
   * Call after `settings.beats` or `settings.note` changed mid-bar. Moves to the
   * next position of the new grid without shifting the pulse.
   */
  reshape(oldNote: NoteId): void {
    if (this.countInDone < this.countInTotal || this.tick === 0) return;
    const s = this.settings;
    const position = this.tick * noteBeats(oldNote);
    const step = noteBeats(s.note);
    let tick = Math.ceil(position / step - 1e-9);
    const shift = Math.max(0, tick * step - position);
    if (tick >= ticksPerBar(s.beats, s.note)) {
      tick = 0;
      this.bar++;
      this.barsSinceChange++;
    }
    this.tick = tick;
    this.nextTime += shift * (60 / s.bpm);
  }
}
