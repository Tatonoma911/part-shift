import { describe, expect, it } from 'vitest';
import type { Unit } from '../src/core/state';
import { handWorld, run } from './helpers';

describe('crystals stay queued, a new dig order comes first', () => {
  it('a harvester drops the crystals for the new dig order', () => {
    const w = handWorld(['.v...', '.....']);
    for (const c of w.s.cells) c.revealed = true;
    w.cell(4, 1).revealed = false;
    w.cell(1, 0).stock = 120;
    w.apply({ type: 'placeCommand', x: 0, y: 1 });
    w.player(0).energy = 1000;
    w.apply({ type: 'queueDig', x: 1, y: 0 });
    const u = { id: 700, owner: 0, kind: 'ally', hero: 'kiln', x: 1, y: 0, hp: 100, base: { hp: 100, damage: 5, defense: 0, speed: 1 }, path: [], task: { type: 'harvest', x: 1, y: 0, progress: 0 }, parts: {}, attackCooldown: 0, repathTimer: 0 } as unknown as Unit;
    w.s.units.length = 0;
    w.s.units.push(u);
    w.apply({ type: 'queueDig', x: 4, y: 1, force: true });
    run(w, 0.2);
    expect(u.task.type).toBe('dig');
    expect(w.player(0).queue).toContain('1,0');
  });
});
