import { Board } from './board';
import type { Command } from './commands';
import { findPath, type Point } from './pathfind';
import { createRng, type Rng } from './rng';
import type { BoardConfig, Cell, GameEvent, SimConfig } from './types';

export type WorkerState = 'idle' | 'walking' | 'digging';

export interface Worker {
  id: number;
  /** Position in cell units (cell centers are integers). */
  x: number;
  y: number;
  state: WorkerState;
  path: Point[];
  target: Point | null;
  /** Seconds of digging done on the current target. */
  progress: number;
}

const key = (x: number, y: number) => `${x},${y}`;

/**
 * One run: the board, the energy bank, residents digging the queue.
 * Pure and deterministic; the renderer calls tick() every frame and reads state.
 */
export class World {
  readonly board: Board;
  readonly workers: Worker[] = [];
  /** Cells the player asked to dig, in the order they were queued. */
  readonly queue = new Map<string, Point>();
  energy = 0;
  time = 0;
  private readonly rng: Rng;
  private events: GameEvent[] = [];

  constructor(boardConfig: BoardConfig, readonly sim: SimConfig, seed: number) {
    this.board = new Board(boardConfig);
    this.rng = createRng(seed);
  }

  get started(): boolean {
    return this.board.core !== null;
  }

  /** Single entry point for player actions; returns false when the command was rejected. */
  apply(cmd: Command): boolean {
    switch (cmd.type) {
      case 'placeCore':
        if (this.started || !this.board.inBounds(cmd.x, cmd.y)) return false;
        this.placeCore(cmd.x, cmd.y);
        return true;
      case 'queueDig':
        return this.queueDig(cmd.x, cmd.y);
      case 'cancelDig':
        if (!this.isQueued(cmd.x, cmd.y)) return false;
        this.cancelDig(cmd.x, cmd.y);
        return true;
      case 'toggleMark':
        if (!this.started || !this.board.inBounds(cmd.x, cmd.y)) return false;
        this.toggleMark(cmd.x, cmd.y);
        return true;
    }
  }

  placeCore(x: number, y: number): void {
    const { opened } = this.board.placeCore(x, y, this.rng);
    this.onOpened(opened);
    for (let i = 0; i < this.sim.startWorkers; i++) {
      this.workers.push({ id: i, x, y, state: 'idle', path: [], target: null, progress: 0 });
    }
  }

  /** Queue a covered cell for digging. Cells beyond the frontier wait until they become reachable. */
  queueDig(x: number, y: number): boolean {
    if (!this.started || !this.board.inBounds(x, y)) return false;
    const c = this.board.get(x, y);
    if (c.revealed || c.marked) return false;
    this.queue.set(key(x, y), { x, y });
    return true;
  }

  cancelDig(x: number, y: number): void {
    this.queue.delete(key(x, y));
  }

  isQueued(x: number, y: number): boolean {
    return this.queue.has(key(x, y));
  }

  toggleMark(x: number, y: number): void {
    this.board.toggleMark(x, y);
    if (this.board.get(x, y).marked) this.cancelDig(x, y);
  }

  /** Returns and clears the events produced since the last call. */
  drainEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  tick(dt: number): void {
    if (!this.started) return;
    this.time += dt;
    for (const w of this.workers) this.stepWorker(w, dt);
  }

  private stepWorker(w: Worker, dt: number): void {
    if (w.target && !this.queue.has(key(w.target.x, w.target.y))) {
      // Target was cancelled or opened by a cascade: drop it.
      this.release(w);
    }
    if (w.state === 'idle') this.assign(w);
    if (w.state === 'walking') this.walk(w, dt);
    if (w.state === 'digging') this.dig(w, dt);
  }

  private release(w: Worker): void {
    w.target = null;
    w.path = [];
    w.progress = 0;
    w.state = 'idle';
    w.x = Math.round(w.x);
    w.y = Math.round(w.y);
  }

  private assign(w: Worker): void {
    const taken = new Set(this.workers.filter((o) => o !== w && o.target).map((o) => key(o.target!.x, o.target!.y)));
    const b = this.board;
    const start = { x: Math.round(w.x), y: Math.round(w.y) };
    // Nearest standing spot next to a queued frontier cell that nobody else is digging.
    const found: { cell: Point | null } = { cell: null };
    const path = findPath(b.width, b.height, start, (x, y) => b.isWalkable(x, y), (x, y) => {
      for (const n of b.neighbors(x, y)) {
        const k = key(n.x, n.y);
        if (this.queue.has(k) && !taken.has(k) && !n.revealed) {
          found.cell = { x: n.x, y: n.y };
          return true;
        }
      }
      return false;
    });
    if (!path || !found.cell) return;
    w.target = found.cell;
    w.path = path.slice(1);
    w.progress = 0;
    w.state = w.path.length > 0 ? 'walking' : 'digging';
  }

  private walk(w: Worker, dt: number): void {
    let budget = this.sim.walkSpeed * dt;
    while (budget > 0 && w.path.length > 0) {
      const next = w.path[0];
      const dx = next.x - w.x;
      const dy = next.y - w.y;
      const d = Math.hypot(dx, dy);
      if (d <= budget) {
        w.x = next.x;
        w.y = next.y;
        budget -= d;
        w.path.shift();
      } else {
        w.x += (dx / d) * budget;
        w.y += (dy / d) * budget;
        budget = 0;
      }
    }
    if (w.path.length === 0) w.state = 'digging';
  }

  private dig(w: Worker, dt: number): void {
    w.progress += dt;
    if (w.progress < this.sim.digSeconds || !w.target) return;
    const { x, y } = w.target;
    this.queue.delete(key(x, y));
    this.release(w);
    this.onOpened(this.board.reveal(x, y).opened);
  }

  private onOpened(opened: Cell[]): void {
    if (opened.length === 0) return;
    this.events.push({ type: 'revealed', cells: opened.map((c) => ({ x: c.x, y: c.y })) });
    for (const c of opened) {
      this.queue.delete(key(c.x, c.y));
      if (c.core) continue;
      this.addEnergy(c.x, c.y, this.sim.energyPerCell);
      if (c.site === 'cache') {
        this.board.resolve(c.x, c.y);
        this.addEnergy(c.x, c.y, this.sim.energyPerCache);
        this.events.push({ type: 'cacheFound', x: c.x, y: c.y });
      } else if (c.site !== 'none') {
        this.events.push({ type: 'threatAwakened', x: c.x, y: c.y, site: c.site });
      }
    }
  }

  private addEnergy(x: number, y: number, amount: number): void {
    if (amount <= 0) return;
    this.energy += amount;
    this.events.push({ type: 'energy', x, y, amount });
  }
}
