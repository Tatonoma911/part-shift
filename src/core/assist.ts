/**
 * The HeroOut scanner (design/ONBOARDING.md §1.3): marks covered cells whose
 * contents follow logically from the opened clue numbers. It never guesses.
 * Channels are solved separately, as the design asks: a cell is "safe" when it
 * provably holds neither a nest nor the hatch, "threat"/"demon" when it provably holds one.
 */
import { cellAt, cellKey, neighbors } from './grid';
import type { Cell, ClueChannel, GameState } from './state';

export type Knowledge = 'safe' | 'threat' | 'demon';

const CHANNEL_OF: Partial<Record<Cell['content'], ClueChannel>> = {
  nest: 'threat',
  heavy_nest: 'threat',
  hero_lair: 'threat',
  boss_hatch: 'demon',
  cache: 'finds',
  survivor: 'finds',
  blueprint: 'finds',
  armor_crate: 'finds',
  lore_record: 'finds',
  mine: 'threat',
  bonus_capsule: 'finds',
  medkit: 'finds',
};

/** Revealed cells that show clue numbers (plain land, or a site already dealt with). */
function showsClues(c: Cell): boolean {
  return c.revealed && (c.content === 'ground' || c.content === 'rubble' || c.content === 'energy_vein' || c.resolved);
}

interface Constraint {
  cells: Set<number>;
  count: number;
}

/** Cell indexes proven to hold (true) or not hold (false) a site of this channel. */
function solveChannel(s: GameState, channel: ClueChannel): Map<number, boolean> {
  const known = new Map<number, boolean>();
  let constraints: Constraint[] = [];
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      const c = cellAt(s, x, y);
      if (!showsClues(c)) continue;
      // The clue on this cell, minus sites of this channel that are already visible.
      let count = 0;
      const cells = new Set<number>();
      for (const n of neighbors(s, x, y)) {
        const counts = CHANNEL_OF[n.cell.content] === channel && !n.cell.resolved;
        if (n.cell.revealed) continue;
        cells.add(n.y * s.width + n.x);
        if (counts) count++;
      }
      if (cells.size > 0) constraints.push({ cells, count });
    }
  }

  for (let changed = true; changed; ) {
    changed = false;
    // Fold what is known into every constraint.
    constraints = constraints
      .map(({ cells, count }) => {
        const rest = new Set<number>();
        for (const i of cells) {
          const k = known.get(i);
          if (k === undefined) rest.add(i);
          else if (k) count--;
        }
        return { cells: rest, count };
      })
      .filter((c) => c.cells.size > 0);
    const learn = (cells: Iterable<number>, value: boolean) => {
      for (const i of cells) {
        if (!known.has(i)) {
          known.set(i, value);
          changed = true;
        }
      }
    };
    for (const c of constraints) {
      if (c.count === 0) learn(c.cells, false);
      else if (c.count === c.cells.size) learn(c.cells, true);
    }
    if (changed) continue;
    // Subset rule: A ⊆ B ⇒ B \ A holds countB − countA.
    for (const a of constraints) {
      for (const b of constraints) {
        if (a === b || a.cells.size >= b.cells.size) continue;
        let subset = true;
        for (const i of a.cells) if (!b.cells.has(i)) subset = false;
        if (!subset) continue;
        const diff = [...b.cells].filter((i) => !a.cells.has(i));
        const k = b.count - a.count;
        if (k === 0) learn(diff, false);
        else if (k === diff.length) learn(diff, true);
      }
    }
  }
  return known;
}

/** Proven knowledge about covered cells, keyed "x,y". */
export function deduce(s: GameState): Map<string, Knowledge> {
  const threat = solveChannel(s, 'threat');
  const demon = solveChannel(s, 'demon');
  const out = new Map<string, Knowledge>();
  const key = (i: number) => cellKey(i % s.width, Math.floor(i / s.width));
  for (const [i, has] of demon) if (has) out.set(key(i), 'demon');
  for (const [i, has] of threat) if (has) out.set(key(i), 'threat');
  for (const [i, has] of threat) if (!has && demon.get(i) === false && !out.has(key(i))) out.set(key(i), 'safe');
  return out;
}
