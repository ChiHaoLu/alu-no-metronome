/**
 * How many beat groups to put on each row of the accent grid, given how many
 * fit. Prefers equal rows, so 4 groups that fit 3 across become 2 × 2, not 3 + 1.
 */
export function columnsFor(groups: number, fit: number): number {
  const most = Math.max(1, fit);
  if (groups <= most) return groups;
  for (let cols = most; cols >= 2; cols--) {
    if (groups % cols === 0) return cols;
  }
  // No equal split exists: stack a short bar, and keep rows close in length otherwise.
  if (groups <= 3) return 1;
  return Math.ceil(groups / Math.ceil(groups / most));
}
