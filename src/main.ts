import { noteIcon } from './icons';
import { Metronome } from './metronome';
import { NOTES, fits, isOnBeat, remapAccents, type NoteId } from './notes';
import { clampBpm, type Tick } from './sequencer';
import { MAX_BEATS, formatStep, load, parseSteps, save } from './store';

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

const bpmInput = el<HTMLInputElement>('bpm');
const bpmSlider = el<HTMLInputElement>('bpm-slider');
const status = el('status');
const grid = el('grid');
const notes = el('notes');
const volume = el<HTMLInputElement>('volume');
const beatsOut = el('beats');
const beatsDown = el<HTMLButtonElement>('beats-down');
const beatsUp = el<HTMLButtonElement>('beats-up');
const countIn = el('count-in');
const autoOn = el<HTMLInputElement>('auto-on');
const autoDetail = el('auto-detail');
const autoEvery = el<HTMLInputElement>('auto-every');
const autoSteps = el<HTMLInputElement>('auto-steps');
const play = el<HTMLButtonElement>('play');

const settings = load();
const metronome = new Metronome(settings, onTick);

const IDLE_HINT = '點方格設定重音';
let cells: HTMLInputElement[] = [];
let lit: HTMLInputElement | null = null;

/* Tempo */

function showBpm(): void {
  if (document.activeElement !== bpmInput) bpmInput.value = String(settings.bpm);
  bpmSlider.value = String(settings.bpm);
}

function setBpm(bpm: number): void {
  settings.bpm = clampBpm(bpm);
  showBpm();
  save(settings);
}

function commitBpmInput(): void {
  const typed = parseInt(bpmInput.value, 10);
  if (!Number.isNaN(typed)) settings.bpm = clampBpm(typed);
  bpmInput.value = String(settings.bpm);
  showBpm();
  save(settings);
}

/** Tap for one step, hold to keep going. */
function repeatOnHold(button: HTMLButtonElement, action: () => void): void {
  let delay = 0;
  let repeat = 0;
  const release = () => {
    clearTimeout(delay);
    clearInterval(repeat);
  };
  button.addEventListener('pointerdown', () => {
    action();
    delay = window.setTimeout(() => {
      repeat = window.setInterval(action, 60);
    }, 400);
  });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) {
    button.addEventListener(type, release);
  }
  // detail is 0 for keyboard activation, which fires no pointer events.
  button.addEventListener('click', (event) => {
    if (event.detail === 0) action();
  });
}

repeatOnHold(el('bpm-down'), () => setBpm(settings.bpm - 1));
repeatOnHold(el('bpm-up'), () => setBpm(settings.bpm + 1));
bpmSlider.addEventListener('input', () => setBpm(Number(bpmSlider.value)));
bpmInput.addEventListener('focus', () => bpmInput.select());
bpmInput.addEventListener('blur', commitBpmInput);
bpmInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') bpmInput.blur();
});

/* Volume */

volume.addEventListener('input', () => {
  settings.volume = Number(volume.value);
  metronome.applyVolume();
  save(settings);
});

/* Accent grid */

function renderGrid(): void {
  grid.replaceChildren();
  lit = null;
  let group: HTMLElement | null = null;
  let beat = 0;
  cells = settings.accents.map((accent, i) => {
    const onBeat = isOnBeat(i, settings.note);
    if (onBeat || !group) {
      group = document.createElement('div');
      group.className = 'group';
      grid.append(group);
      beat++;
    }
    const cell = document.createElement('input');
    cell.type = 'checkbox';
    cell.className = onBeat ? 'cell' : 'cell off-beat';
    cell.checked = accent;
    cell.dataset.index = String(i);
    cell.setAttribute('aria-label', onBeat ? `第 ${beat} 組重音` : `第 ${beat} 組第 ${i + 1} 音重音`);
    group.append(cell);
    return cell;
  });
}

grid.addEventListener('change', (event) => {
  const cell = event.target as HTMLInputElement;
  settings.accents[Number(cell.dataset.index)] = cell.checked;
  save(settings);
});

/* Bar structure: note value and beats per bar */

function renderNotes(): void {
  for (const button of notes.querySelectorAll('button')) {
    const id = button.dataset.note as NoteId;
    button.setAttribute('aria-pressed', String(id === settings.note));
    button.disabled = !fits(settings.beats, id);
  }
  beatsOut.textContent = String(settings.beats);
  beatsDown.disabled = settings.beats <= 1;
  beatsUp.disabled = settings.beats >= MAX_BEATS;
}

function setStructure(beats: number, note: NoteId): void {
  const oldNote = settings.note;
  const newNote = fits(beats, note) ? note : 'quarter';
  settings.accents = remapAccents(settings.accents, oldNote, beats, newNote);
  settings.beats = beats;
  settings.note = newNote;
  metronome.reshape(oldNote);
  renderNotes();
  renderGrid();
  save(settings);
}

for (const { id, label } of NOTES) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.note = id;
  button.title = label;
  button.setAttribute('aria-label', label);
  button.innerHTML = noteIcon(id);
  button.addEventListener('click', () => setStructure(settings.beats, id));
  notes.append(button);
}

beatsDown.addEventListener('click', () => {
  if (settings.beats > 1) setStructure(settings.beats - 1, settings.note);
});
beatsUp.addEventListener('click', () => {
  if (settings.beats < MAX_BEATS) setStructure(settings.beats + 1, settings.note);
});

/* Count-in */

function renderCountIn(): void {
  for (const button of countIn.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.bars) === settings.countInBars));
  }
}

countIn.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest('button');
  if (!button) return;
  settings.countInBars = Number(button.dataset.bars);
  renderCountIn();
  save(settings);
});

/* Auto tempo */

function renderAuto(): void {
  autoOn.checked = settings.auto.enabled;
  autoDetail.hidden = !settings.auto.enabled;
  autoEvery.value = String(settings.auto.every);
  autoSteps.value = settings.auto.steps.map(formatStep).join(' ');
}

autoOn.addEventListener('change', () => {
  settings.auto.enabled = autoOn.checked;
  metronome.restartAutoCount();
  renderAuto();
  save(settings);
});

autoEvery.addEventListener('change', () => {
  const every = parseInt(autoEvery.value, 10);
  if (every >= 1) settings.auto.every = Math.min(999, every);
  metronome.restartAutoCount();
  renderAuto();
  save(settings);
});

autoSteps.addEventListener('change', () => {
  const steps = parseSteps(autoSteps.value);
  if (steps.length > 0) settings.auto.steps = steps;
  metronome.restartAutoCount();
  renderAuto();
  save(settings);
});

/* Playback */

function onTick(tick: Tick): void {
  lit?.classList.remove('now');
  lit = tick.index === null ? null : (cells[tick.index] ?? null);
  lit?.classList.add('now');

  if (tick.bpmChanged) {
    showBpm();
    save(settings);
  }

  if (tick.countIn) {
    status.classList.add('counting');
    status.textContent = `預備 ${tick.countIn.beat} / ${tick.countIn.total}`;
    return;
  }
  status.classList.remove('counting');
  const upcoming =
    tick.barsLeft !== null && tick.nextStep !== null
      ? ` · 再 ${tick.barsLeft} 小節 ${formatStep(tick.nextStep)}`
      : '';
  status.textContent = `第 ${tick.bar} 小節${upcoming}`;
}

function togglePlay(): void {
  if (metronome.playing) {
    metronome.stop();
    lit?.classList.remove('now');
    lit = null;
    status.classList.remove('counting');
    status.textContent = IDLE_HINT;
    showBpm();
  } else {
    metronome.start();
  }
  play.textContent = metronome.playing ? '停止' : '開始';
  play.classList.toggle('playing', metronome.playing);
}

play.addEventListener('click', togglePlay);

// A control reached with Tab keeps Space, so accents stay usable without a mouse.
// After a click on one, Space goes back to start/stop. :focus-visible can't tell
// these apart: it starts matching as soon as any key is pressed.
let tabbing = false;
document.addEventListener('pointerdown', () => {
  tabbing = false;
});

document.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement;
  const typing = target.matches('input[type="text"], input[type="number"]');
  if (event.key === 'Tab') tabbing = true;
  if (event.code === 'Space') {
    if (typing || (tabbing && target !== document.body)) return;
    event.preventDefault();
    if (!event.repeat) togglePlay();
  } else if (!typing && target !== bpmSlider && target !== volume) {
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault();
      setBpm(settings.bpm + 1);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault();
      setBpm(settings.bpm - 1);
    }
  }
});

/* First paint */

status.textContent = IDLE_HINT;
showBpm();
volume.value = String(settings.volume);
renderNotes();
renderGrid();
renderCountIn();
renderAuto();
