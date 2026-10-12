/**
 * How many columns the stage grid uses, so tiles are as big as the screen and the number of people allow.
 * A phone with two people stacks them tall. A desktop with two people puts them side by side, large. Crowds grow
 * toward a square. Pure, so it can be tested.
 */
export function stageColumns(count: number, width: number): number {
  if (count <= 1) return 1;
  const phone = width < 640;
  const maxByWidth = Math.max(1, Math.floor(width / 150));
  let cols: number;
  if (count === 2) cols = phone ? 1 : 2;
  else if (count <= 4) cols = 2;
  else if (count <= 6) cols = phone ? 2 : 3;
  else cols = Math.ceil(Math.sqrt(count));
  return Math.max(1, Math.min(cols, maxByWidth, phone ? 3 : 6));
}

/** Rows follow from the columns, and the grid divides the height between them. */
export function stageRows(count: number, columns: number): number {
  return Math.max(1, Math.ceil(count / columns));
}
