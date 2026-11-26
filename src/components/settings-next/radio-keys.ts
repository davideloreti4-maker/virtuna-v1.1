/**
 * The arrow keys of a radio group (Appearance's chips, the plans of See plans): where the focus goes
 * from the radio at `index`, round the ends; null for any other key. One radio of a group is a Tab
 * stop (the checked one); the arrows reach the others.
 */
export function arrowTarget(key: string, index: number, count: number): number | null {
  if (key === "ArrowRight" || key === "ArrowDown") return (index + 1) % count;
  if (key === "ArrowLeft" || key === "ArrowUp") return (index - 1 + count) % count;
  return null;
}
