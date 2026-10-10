import { createTutorialWorld, tutorial, type TutorialStep } from '../core/levels';
import type { GameEvent, World } from '../core/world';

const DONE_KEY = 'partshift.tutorialDone.v1';

export function tutorialDone(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === '1';
  } catch {
    return true;
  }
}

export function markTutorialDone(): void {
  try {
    localStorage.setItem(DONE_KEY, '1');
  } catch {
    /* ignore */
  }
}

/**
 * Walks the player through "First Shift" (design/data/tutorial_map.json):
 * one text per step, the next one only after its `until` condition.
 */
export class TutorialGuide {
  readonly world: World;
  private readonly steps = tutorial.steps as TutorialStep[];
  private index = 0;
  private stepStartedAt = 0;
  private flags = new Set<string>();
  private queued = 0;
  finished = false;

  constructor() {
    this.world = createTutorialWorld();
  }

  get stepIndex(): number {
    return this.index;
  }

  get stepCount(): number {
    return this.steps.length;
  }

  get step(): TutorialStep | null {
    return this.finished ? null : this.steps[this.index];
  }

  /** The scene reports player actions the world does not record. */
  notify(what: 'clue_touched' | 'queued'): void {
    if (what === 'queued') this.queued++;
    else this.flags.add(what);
  }

  onEvent(e: GameEvent): void {
    if (e.type === 'nest_open') this.flags.add('nest_opened');
    if (e.type === 'part_attached') this.flags.add('part_attached');
    if (e.type === 'cache_open') this.flags.add('cache_opened');
  }

  /** Returns true when the step changed. */
  update(): boolean {
    const step = this.step;
    if (!step) return false;
    const w = this.world;
    const elapsed = w.s.time - this.stepStartedAt;
    const done = this.met(step.until) || (step.autoAdvanceSeconds !== undefined && elapsed >= step.autoAdvanceSeconds);
    // Don't move on to a step that points at something not on the board yet
    // (step 4 "tap the number" before any threat number is open: QA-008).
    const next = this.steps[this.index + 1];
    // A next step whose goal is already met (the cache opened early by a zero cascade) is ready too,
    // otherwise the tutorial waits forever for a cell that no longer exists.
    const nextReady = !next?.focus || this.cellsFor(next).length > 0 || this.met(next.until);
    if (done && nextReady && elapsed >= (step.minSeconds ?? 0)) {
      this.index++;
      this.stepStartedAt = w.s.time;
      this.flags.delete('clue_touched');
      if (this.index >= this.steps.length) {
        this.finished = true;
        markTutorialDone();
      }
      return true;
    }
    return false;
  }

  private met(until: string): boolean {
    const w = this.world;
    const [name, arg] = until.split(':');
    switch (name) {
      case 'command_placed':
        return w.started;
      case 'cells_queued':
        return this.queued >= Number(arg);
      case 'first_zero_cascade_done':
        return w.s.time - this.stepStartedAt > 2 && w.player(0).autoQueue.length === 0;
      case 'clue_touched':
        return this.flags.has('clue_touched');
      case 'assist_mark_shown':
        return [...w.visibleKnowledge(0).values()].some((k) => (arg === 'danger' ? k === 'threat' || k === 'demon' : k === arg));
      case 'residents':
        return w.s.units.filter((u) => u.owner === 0 && u.kind === 'resident').length >= Number(arg);
      case 'building_built':
        // rules v0.4 tutorial_map: step 6 builds a Microreactor instead of training defenders
        return w.s.buildings.some((b) => b.owner === 0 && b.complete && b.type === arg);
      case 'fight_won':
        // «Герой победил» only once the nest's adaptants are all down (FEEL_AUDIT F-05).
        return this.flags.has('nest_opened') && !w.s.units.some((u) => u.owner === -1 && u.hp > 0);
      default:
        return this.flags.has(name);
    }
  }

  /** Cells to pulse for the current step. */
  focusCells(): { x: number; y: number }[] {
    return this.step ? this.cellsFor(this.step) : [];
  }

  private cellsFor(step: TutorialStep): { x: number; y: number }[] {
    if (step.highlight) return step.highlight.map(([x, y]) => ({ x, y }));
    const w = this.world;
    const all: { x: number; y: number }[] = [];
    for (let y = 0; y < w.s.height; y++) for (let x = 0; x < w.s.width; x++) all.push({ x, y });
    const clue = (p: { x: number; y: number }) => {
      const c = w.cell(p.x, p.y);
      return c.revealed && c.content === 'ground' && c.building === undefined && w.clues(p.x, p.y).threat > 0;
    };
    switch (step.focus) {
      case 'first_threat_clue': {
        // Step 4 says "only one closed neighbor": prefer such a number while the field is still mostly closed.
        const closed = (p: { x: number; y: number }) => all.filter((q) => Math.max(Math.abs(q.x - p.x), Math.abs(q.y - p.y)) === 1 && !w.cell(q.x, q.y).revealed).length;
        const clues = all.filter(clue);
        const one = clues.find((p) => closed(p) === 1);
        return one ? [one] : clues.slice(0, 1);
      }
      case 'overlapping_threat_clues':
        return all.filter(clue);
      case 'nest_cell':
        return all.filter((p) => w.cell(p.x, p.y).content === 'nest' && !w.cell(p.x, p.y).resolved);
      case 'cache_cell':
        return all.filter((p) => w.cell(p.x, p.y).content === 'cache' && !w.cell(p.x, p.y).resolved);
      default:
        return [];
    }
  }
}
