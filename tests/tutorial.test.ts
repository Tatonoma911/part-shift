import { describe, expect, it } from 'vitest';
import { createTutorialWorld, tutorial } from '../src/core/levels';
import { run } from './helpers';

describe('First Shift tutorial map', () => {
  it('builds the hand-made field with its overrides', () => {
    const w = createTutorialWorld();
    expect([w.s.width, w.s.height]).toEqual([8, 10]);
    expect(w.cell(2, 3).content).toBe('nest');
    expect(w.cell(2, 3).tech).toBe('cryo');
    expect(w.cell(6, 2).content).toBe('cache');
    expect(w.cfg.dig.digSeconds).toBe(3);
    expect(w.player(0).energy).toBe(300);
  });

  it('only accepts the command center on its fixed cell', () => {
    const w = createTutorialWorld();
    expect(w.apply({ type: 'placeCommand', x: 0, y: 0 }).ok).toBe(false);
    const { x, y } = tutorial.commandFixed;
    expect(w.apply({ type: 'placeCommand', x, y }).ok).toBe(true);
  });

  it('has no threat growth, no Demon and an unbreakable center; the nest releases only 2 adaptants with arms', () => {
    const w = createTutorialWorld();
    w.apply({ type: 'placeCommand', x: 3, y: 8 });
    w.s.time = 2000;
    expect(w.threatLevel).toBe(0);
    for (const c of w.s.cells) if (c.content !== 'nest') c.revealed = true;
    w.cell(2, 3).revealed = false;
    w.apply({ type: 'queueDig', x: 2, y: 3, force: true });
    run(w, 60);
    expect(w.s.units.some((u) => u.kind === 'demon')).toBe(false);
    expect(w.s.sites[0].spawned).toBe(2);
    expect(w.building(w.player(0).command)!.hp).toBeGreaterThan(0);
  });
});
