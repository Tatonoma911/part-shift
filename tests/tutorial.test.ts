import { describe, expect, it } from 'vitest';
import { createTutorialWorld, tutorial } from '../src/core/levels';
import { run } from './helpers';

describe('First Shift tutorial map', () => {
  it('builds an open field with its overrides; sites follow the chosen center', () => {
    const w = createTutorialWorld();
    expect([w.s.width, w.s.height]).toEqual([8, 10]);
    expect(w.cfg.dig.digSeconds).toBe(3);
    expect(w.player(0).energy).toBe(300);
    expect(w.apply({ type: 'placeCommand', x: 3, y: 8 }).ok).toBe(true);
    expect(w.cell(2, 3).content).toBe('nest');
    expect(w.cell(2, 3).tech).toBe('cryo');
    expect(w.cell(6, 2).content).toBe('cache');
    expect(w.cell(0, 6).content).toBe('rubble');
  });

  it('accepts the center anywhere and mirrors offsets that fall off the board', () => {
    const w = createTutorialWorld();
    expect(tutorial.commandPlacement.anyCell).toBe(true);
    expect(w.apply({ type: 'placeCommand', x: 1, y: 1 }).ok).toBe(true);
    // nest (-1,-5) → (0,6) after mirroring y; cache (+3,-6) → (4,7)
    expect(w.cell(0, 6).content).toBe('nest');
    expect(w.cell(4, 7).content).toBe('cache');
  });

  it('has no threat growth, no call target and an unbreakable center; the nest releases only 2 adaptants with arms', () => {
    const w = createTutorialWorld();
    w.apply({ type: 'placeCommand', x: 3, y: 8 });
    w.s.time = 2000;
    expect(w.threatLevel).toBe(0);
    expect(w.cell(2, 3).content).toBe('nest');
    for (const c of w.s.cells) if (c.content !== 'nest') c.revealed = true;
    w.cell(2, 3).revealed = false;
    w.apply({ type: 'queueDig', x: 2, y: 3, force: true });
    run(w, 60);
    expect(w.s.units.some((u) => u.kind === 'hero')).toBe(false);
    expect(w.s.sites[0].spawned).toBe(2);
    expect(w.building(w.player(0).command)!.hp).toBeGreaterThan(0);
  });
});
