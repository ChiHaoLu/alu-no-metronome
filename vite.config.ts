import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves this from /alu-no-metronome/, not the domain root.
  // Relative paths keep the build working there and on a custom domain alike.
  base: './',
});
