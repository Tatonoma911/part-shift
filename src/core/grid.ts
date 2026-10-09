import type { Cell, GameState } from './state';

export const N8: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

export const cellKey = (x: number, y: number) => `${x},${y}`;
export function parseKey(k: string): { x: number; y: number } {
  const [x, y] = k.split(',').map(Number);
  return { x, y };
}

export function inBounds(s: GameState, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < s.width && y < s.height;
}

export function cellAt(s: GameState, x: number, y: number): Cell {
  return s.cells[y * s.width + x];
}

export function neighbors(s: GameState, x: number, y: number): { x: number; y: number; cell: Cell }[] {
  const out = [];
  for (const [dx, dy] of N8) {
    const nx = x + dx;
    const ny = y + dy;
    if (inBounds(s, nx, ny)) out.push({ x: nx, y: ny, cell: cellAt(s, nx, ny) });
  }
  return out;
}

/** Chebyshev distance: the "radius" used by every rule in the design tables. */
export const cheb = (ax: number, ay: number, bx: number, by: number) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

/** Sites that are still standing block movement; water always does. */
export function isSolid(c: Cell): boolean {
  if (c.content === 'water') return true;
  if ((c.content === 'nest' || c.content === 'heavy_nest') && !c.resolved) return true;
  // A hero lair is a hole in the ground until it opens; then the hero has left it.
  if ((c.content === 'hero_lair' || c.content === 'boss_hatch') && !c.revealed) return true;
  return false;
}

/** Player units walk only on opened land. */
export function walkableForPlayer(s: GameState, x: number, y: number): boolean {
  if (!inBounds(s, x, y)) return false;
  const c = cellAt(s, x, y);
  return c.revealed && !isSolid(c);
}

/** Enemies walk anywhere except water and standing sites; flyers (Seraph) cross water. */
export function walkableForEnemy(s: GameState, x: number, y: number, flying = false): boolean {
  if (!inBounds(s, x, y)) return false;
  const c = cellAt(s, x, y);
  if (flying && c.content === 'water') return true;
  return !isSolid(c);
}
