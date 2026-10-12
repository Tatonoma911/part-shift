import { describe, expect, it } from 'vitest';
import { mapgen } from '../src/core/data';
import { handWorld, run } from './helpers';

/** A hand-made field with the pile at (2,1) sealed the way mapgen places it. */
function started(rows = ['.......', '..r....', '.......']) {
  const w = handWorld(rows);
  Object.assign(w.cell(2, 1), { stock: undefined, rubble: true });
  w.apply({ type: 'placeCommand', x: 0, y: 1 });
  return w;
}

describe('rubble is two layers: the hex layer first, then the sealed pile (MVP_RULES §22.13)', () => {
  it('the hex layer opens at normal dig time and leaves a sealed pile that a second dig opens', () => {
    const w = started(['.......', '..r....', '.......']);
    w.apply({ type: 'queueDig', x: 2, y: 1, force: true });
    run(w, 20);
    expect(w.cell(2, 1).revealed).toBe(true);
    expect(w.cell(2, 1).content).toBe('rubble');
    expect(w.cell(2, 1).rubble).toBe(true);
    expect(w.s.runners ?? []).toHaveLength(0);

    expect(w.apply({ type: 'queueDig', x: 2, y: 1 }).ok).toBe(true);
    const opened: string[] = [];
    let score = 0;
    const before = w.player(0).energy;
    for (let t = 0; t < 90; t += 0.05) {
      w.step(0.05);
      for (const e of w.drainEvents()) {
        if (e.type === 'rubble_opened') opened.push(e.type);
        if (e.type === 'civilian_rescued') score += e.amount ?? 0;
      }
    }
    expect(opened).toHaveLength(1);
    expect(w.cell(2, 1).content).toBe('ground');
    expect(w.cell(2, 1).rubble).toBeUndefined();
    expect(w.player(0).civilians).toBe(mapgen.rubble.rescue.onOpen.balance);
    expect(score).toBe(mapgen.rubble.rescue.onOpen.score);
    expect(w.player(0).stats.civiliansRescued).toBe(1);
    expect(w.player(0).energy - before).toBeGreaterThanOrEqual(mapgen.rubble.rescue.onOpen.energy);
  });

  it('a sealed pile is not walkable and is not queued a second time while still closed', () => {
    const w = started(['.......', '..r....', '.......']);
    w.apply({ type: 'queueDig', x: 2, y: 1, force: true });
    run(w, 20);
    expect(w.apply({ type: 'queueDig', x: 2, y: 1 }).ok).toBe(true);
    expect(w.apply({ type: 'queueDig', x: 2, y: 1 }).ok).toBe(false);
  });
});
