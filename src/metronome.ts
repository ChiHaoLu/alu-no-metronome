import type { NoteId } from './notes';
import { Sequencer, type Level, type Settings, type Tick } from './sequencer';
import TimerWorker from './timer.worker?worker';

/** How far ahead clicks are handed to the audio clock. */
const LOOKAHEAD = 0.12;
const START_DELAY = 0.08;

const VOICES: Record<Level, { freq: number; gain: number; decay: number }> = {
  accent: { freq: 1760, gain: 1, decay: 0.06 },
  beat: { freq: 1175, gain: 0.55, decay: 0.045 },
  sub: { freq: 880, gain: 0.22, decay: 0.03 },
  'count-accent': { freq: 659, gain: 0.9, decay: 0.07 },
  count: { freq: 494, gain: 0.7, decay: 0.06 },
};

interface NavigatorExtras {
  audioSession?: { type: string };
  wakeLock?: { request(type: 'screen'): Promise<WakeLock> };
}

interface WakeLock {
  release(): Promise<void>;
}

const nav = navigator as Navigator & NavigatorExtras;

/** Hearing is roughly logarithmic: squaring makes the slider feel even across its range. */
function outputGain(volume: number): number {
  return volume * volume;
}

/**
 * Plays the sequence with Web Audio: a worker wakes this up often, and each wake
 * books the next clicks on the audio clock. `onTick` fires on the animation frame
 * closest to when each click is heard.
 */
export class Metronome {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private seq: Sequencer | null = null;
  private worker: Worker | null = null;
  private pending: Tick[] = [];
  private frame = 0;
  private wakeLock: WakeLock | null = null;

  constructor(
    private readonly settings: Settings,
    private readonly onTick: (tick: Tick) => void,
  ) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.playing) {
        void this.ctx?.resume();
        void this.keepScreenOn();
      }
    });
  }

  get playing(): boolean {
    return this.seq !== null;
  }

  /** Must run inside a user gesture, or the browser keeps the audio suspended. */
  start(): void {
    if (this.playing) return;
    // Without this, iOS follows the ring/silent switch and the click goes mute.
    if (nav.audioSession) nav.audioSession.type = 'playback';

    this.ctx ??= new AudioContext({ latencyHint: 'interactive' });
    void this.ctx.resume();

    this.master = new GainNode(this.ctx, { gain: outputGain(this.settings.volume) });
    this.master.connect(this.ctx.destination);
    this.seq = new Sequencer(this.settings, this.ctx.currentTime + START_DELAY);

    this.worker ??= this.createWorker();
    this.worker.postMessage('start');
    this.schedule();
    this.frame = requestAnimationFrame(this.draw);
    void this.keepScreenOn();
  }

  stop(): void {
    if (!this.playing) return;
    this.worker?.postMessage('stop');
    cancelAnimationFrame(this.frame);
    // Dropping the output silences clicks already booked on the audio clock.
    this.master?.disconnect();
    this.master = null;
    this.seq = null;
    this.pending = [];
    void this.wakeLock?.release().catch(() => {});
    this.wakeLock = null;
  }

  /** Applies `settings.volume` to the click that is playing now, without a pop. */
  applyVolume(): void {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(outputGain(this.settings.volume), this.ctx.currentTime, 0.01);
  }

  reshape(oldNote: NoteId): void {
    this.seq?.reshape(oldNote);
  }

  restartAutoCount(): void {
    this.seq?.restartAutoCount();
  }

  private createWorker(): Worker {
    const worker = new TimerWorker();
    worker.onmessage = () => this.schedule();
    return worker;
  }

  private schedule(): void {
    const { ctx, seq } = this;
    if (!ctx || !seq) return;
    const now = ctx.currentTime;
    while (seq.nextTime < now + LOOKAHEAD) {
      const tick = seq.next();
      // After a stall, stay in time silently instead of bursting out the backlog.
      if (tick.time >= now) this.click(tick);
      this.pending.push(tick);
    }
  }

  private click({ time, level }: Tick): void {
    const { ctx, master } = this;
    if (!ctx || !master) return;
    const { freq, gain, decay } = VOICES[level];
    const osc = new OscillatorNode(ctx, { type: 'triangle', frequency: freq });
    const env = new GainNode(ctx, { gain: 0 });
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + decay);
    osc.connect(env).connect(master);
    osc.start(time);
    osc.stop(time + decay + 0.01);
    osc.onended = () => env.disconnect();
  }

  private draw = (): void => {
    const { ctx } = this;
    if (!ctx || !this.playing) return;
    const heard = ctx.currentTime - (ctx.outputLatency || 0);
    while (this.pending.length > 0 && this.pending[0].time <= heard) {
      this.onTick(this.pending.shift()!);
    }
    this.frame = requestAnimationFrame(this.draw);
  };

  private async keepScreenOn(): Promise<void> {
    try {
      this.wakeLock = (await nav.wakeLock?.request('screen')) ?? null;
    } catch {
      // Not allowed right now (e.g. low battery); the click still plays.
    }
  }
}
