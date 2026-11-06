import { describe, expect, it } from 'vitest';
import { sanitize } from './store';

describe('saved volume', () => {
  it('defaults to full for settings saved before volume existed', () => {
    expect(sanitize({ bpm: 90 })).toMatchObject({ bpm: 90, volume: 1 });
  });

  it('keeps a valid level, including silence', () => {
    expect(sanitize({ volume: 0.4 }).volume).toBe(0.4);
    expect(sanitize({ volume: 0 }).volume).toBe(0);
  });

  it('rejects anything outside the slider range', () => {
    expect(sanitize({ volume: 3 }).volume).toBe(1);
    expect(sanitize({ volume: -1 }).volume).toBe(0);
    expect(sanitize({ volume: NaN }).volume).toBe(1);
    expect(sanitize({ volume: 'loud' as unknown as number }).volume).toBe(1);
  });
});
