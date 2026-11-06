// Runs the scheduler's heartbeat off the main thread, because browsers throttle
// main-thread timers in background tabs, which would make the click stutter.
let id: ReturnType<typeof setInterval> | undefined;

self.onmessage = (event: MessageEvent<'start' | 'stop'>) => {
  clearInterval(id);
  if (event.data === 'start') {
    id = setInterval(() => self.postMessage('tick'), 25);
  }
};
