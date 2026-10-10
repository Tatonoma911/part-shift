/**
 * Boards without guessing (design/MVP_RULES.md §15.2, difficulty.json noGuess):
 * the scanner's own solver, started from the command centers, must be able to
 * open the whole field by digging proven-safe cells and "opening" proven-danger
 * cells (the player does that when ready to fight). Finds need not be guessed:
 * they are harmless, and deduce() only reasons about nests, lairs, mines and the hatch.
 */
import { deduce } from './assist';
import { cellAt, neighbors, parseKey } from './grid';
import type { CellContent, GameState } from './state';

const FINDS = new Set<CellContent>(['cache', 'survivor', 'blueprint', 'armor_crate', 'lore_record', 'bonus_capsule', 'medkit']);

/** True when the solver opens every cell of a freshly generated field. Does not change `s`. */
export function solvable(s: GameState, commands: { x: number; y: number }[]): boolean {
  // Only the fields deduce() reads: content, revealed, resolved.
  const sim = { ...s, cells: s.cells.map((c) => ({ content: c.content, revealed: c.revealed, resolved: c.resolved })) } as GameState;
  for (const { x, y } of commands) {
    cellAt(sim, x, y).revealed = true;
    for (const n of neighbors(sim, x, y)) n.cell.revealed = true;
  }
  for (;;) {
    const known = deduce(sim);
    let progress = false;
    for (const key of known.keys()) {
      const { x, y } = parseKey(key);
      const c = cellAt(sim, x, y);
      if (c.revealed) continue;
      c.revealed = true;
      // Finds open as soon as they are dug; they show clues like plain land.
      if (FINDS.has(c.content)) c.resolved = true;
      progress = true;
    }
    if (!progress) break;
  }
  return sim.cells.every((c) => c.revealed);
}
