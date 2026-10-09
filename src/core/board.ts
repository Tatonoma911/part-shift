import { randInt, type Rng } from './rng';
import type { BoardConfig, Cell, Hints, SiteKind } from './types';

const NEIGHBORS_8: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

export interface RevealResult {
  /** Every cell opened by this call, including the zero cascade. */
  opened: Cell[];
}

/**
 * Pure board state: covered cells, hidden sites and the four hint channels.
 * Sites are generated only when the command center is placed, so the
 * starting area is always safe (like the first click in Minesweeper).
 */
export class Board {
  readonly width: number;
  readonly height: number;
  readonly cells: Cell[];
  core: { x: number; y: number } | null = null;

  constructor(readonly config: BoardConfig) {
    this.width = config.width;
    this.height = config.height;
    this.cells = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.cells.push({ x, y, site: 'none', revealed: false, resolved: false, marked: false, core: false });
      }
    }
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  get(x: number, y: number): Cell {
    if (!this.inBounds(x, y)) throw new Error(`cell out of bounds: ${x},${y}`);
    return this.cells[y * this.width + x];
  }

  neighbors(x: number, y: number): Cell[] {
    const out: Cell[] = [];
    for (const [dx, dy] of NEIGHBORS_8) {
      if (this.inBounds(x + dx, y + dy)) out.push(this.get(x + dx, y + dy));
    }
    return out;
  }

  /** Places the command center, buries the sites, and opens the starting area. */
  placeCore(x: number, y: number, rng: Rng): RevealResult {
    if (this.core) throw new Error('command center already placed');
    this.core = { x, y };
    this.get(x, y).core = true;
    this.generateSites(rng);
    const opened: Cell[] = [];
    for (const c of [this.get(x, y), ...this.neighbors(x, y)]) opened.push(...this.reveal(c.x, c.y).opened);
    return { opened };
  }

  private generateSites(rng: Rng): void {
    const { sites, safeRadius, demonMinDistance } = this.config;
    const core = this.core!;
    const dist = (c: Cell) => Math.max(Math.abs(c.x - core.x), Math.abs(c.y - core.y));
    const free = this.cells.filter((c) => dist(c) > safeRadius);
    const take = (pool: Cell[], kind: SiteKind, n: number) => {
      for (let i = 0; i < n && pool.length > 0; i++) {
        const cell = pool.splice(randInt(rng, pool.length), 1)[0];
        cell.site = kind;
        free.splice(free.indexOf(cell), 1);
      }
    };
    // Demon first: it needs the far ring; fall back to any free cell on tiny boards.
    const far = free.filter((c) => dist(c) >= demonMinDistance);
    take(far.length > 0 ? far : [...free], 'demon', sites.demon);
    take([...free], 'nest', sites.nest);
    take([...free], 'depot', sites.depot);
    take([...free], 'cache', sites.cache);
  }

  /** Unresolved sites in the 8 neighbors, per channel. */
  hints(x: number, y: number): Hints {
    const h: Hints = { nest: 0, depot: 0, cache: 0, demon: 0 };
    for (const n of this.neighbors(x, y)) {
      if (n.site !== 'none' && !n.resolved) h[n.site]++;
    }
    return h;
  }

  isQuiet(x: number, y: number): boolean {
    const h = this.hints(x, y);
    return h.nest + h.depot + h.cache + h.demon === 0;
  }

  /** A covered cell touching opened land: the only cells workers can dig. */
  isFrontier(x: number, y: number): boolean {
    const c = this.get(x, y);
    return !c.revealed && this.neighbors(x, y).some((n) => n.revealed);
  }

  /**
   * Opens a cell. A quiet empty cell opens its neighbors too (instant cascade);
   * cells marked by the player are never opened by the cascade.
   */
  reveal(x: number, y: number): RevealResult {
    const opened: Cell[] = [];
    const stack: Cell[] = [this.get(x, y)];
    while (stack.length > 0) {
      const c = stack.pop()!;
      if (c.revealed) continue;
      c.revealed = true;
      c.marked = false;
      opened.push(c);
      if (c.site === 'none' && this.isQuiet(c.x, c.y)) {
        for (const n of this.neighbors(c.x, c.y)) if (!n.revealed && !n.marked) stack.push(n);
      }
    }
    return { opened };
  }

  /** Claims a cache or destroys a threat; neighboring hints drop by one. */
  resolve(x: number, y: number): void {
    this.get(x, y).resolved = true;
  }

  /** Walkable for workers: opened land without an active threat. */
  isWalkable(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    const c = this.get(x, y);
    return c.revealed && (c.site === 'none' || c.site === 'cache' || c.resolved);
  }

  toggleMark(x: number, y: number): void {
    const c = this.get(x, y);
    if (!c.revealed) c.marked = !c.marked;
  }
}
