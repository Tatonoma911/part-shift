import { describe, expect, it } from 'vitest';
import { mapgen } from '../src/core/data';
import { handWorld, run } from './helpers';

function started(rows = ['.......', '.......', '.......']) {
  const w = handWorld(rows);
  w.apply({ type: 'placeCommand', x: 0, y: 1 });
  return w;
}

describe('rubble is dug open and frees a person (MVP_RULES §22.13, mapgen.json rubble)', () => {
  it('a closed pile takes its durability to open, becomes open ground, and the person reaches the center for +1, +10 Energy, +25 score', () => {
    const w = started(['.......', '..r....', '.......']);
    w.apply({ type: 'queueDig', x: 2, y: 1, force: true });
    const opened: string[] = [];
    let score = 0;
    let arrivedAt = -1;
    const before = w.player(0).energy;
    for (let t = 0; t < 90; t += 0.05) {
      w.step(0.05);
      for (const e of w.drainEvents()) {
        if (e.type === 'rubble_opened') opened.push(e.type);
        if (e.type === 'civilian_rescued') {
          score += e.amount ?? 0;
          if (arrivedAt < 0) arrivedAt = t;
        }
      }
    }
    expect(opened).toHaveLength(1);
    expect(w.cell(2, 1).content).toBe('ground');
    expect(w.cell(2, 1).revealed).toBe(true);
    expect(w.s.runners ?? []).toHaveLength(0);
    expect(w.player(0).civilians).toBe(mapgen.rubble.rescue.onOpen.balance);
    expect(score).toBe(mapgen.rubble.rescue.onOpen.score);
    expect(w.player(0).stats.civiliansRescued).toBe(1);
    expect(w.player(0).energy - before).toBeGreaterThanOrEqual(mapgen.rubble.rescue.onOpen.energy);
    expect(arrivedAt).toBeGreaterThan(0);
  });

  it('a pile is not opened by a single step of digging: it needs its full durability', () => {
    const w = started(['.......', '..r....', '.......']);
    w.apply({ type: 'queueDig', x: 2, y: 1, force: true });
    run(w, 2);
    expect(w.cell(2, 1).content).toBe('rubble');
    expect(w.cell(2, 1).revealed).toBe(false);
  });
});
