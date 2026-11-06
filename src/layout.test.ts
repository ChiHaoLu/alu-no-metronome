import { describe, expect, it } from 'vitest';
import { columnsFor } from './layout';

describe('columnsFor', () => {
  it('uses one row when everything fits', () => {
    expect(columnsFor(4, 7)).toBe(4);
    expect(columnsFor(7, 7)).toBe(7);
  });

  it('splits into equal rows instead of leaving a stray group', () => {
    expect(columnsFor(4, 3)).toBe(2);
    expect(columnsFor(6, 4)).toBe(3);
    expect(columnsFor(8, 7)).toBe(4);
    expect(columnsFor(16, 7)).toBe(4);
  });

  it('stacks a short bar that cannot split evenly', () => {
    expect(columnsFor(3, 2)).toBe(1);
    expect(columnsFor(2, 1)).toBe(1);
  });

  it('keeps rows close in length when no equal split exists', () => {
    expect(columnsFor(5, 4)).toBe(3);
    expect(columnsFor(7, 3)).toBe(3);
    expect(columnsFor(5, 2)).toBe(2);
  });

  it('copes with a screen too narrow for even one group', () => {
    expect(columnsFor(4, 0)).toBe(1);
  });
});
