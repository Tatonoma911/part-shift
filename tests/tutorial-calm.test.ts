import { describe, expect, it } from 'vitest';
import { createTutorialWorld } from '../src/core/levels';
import { run } from './helpers';
import { TutorialGuide } from '../src/game/Tutorial';

describe('First Shift stays calm (FEEL_AUDIT F-05)', () => {
  it('has no raid timer and no «Темп», so the cascade wave stays one block deep', () => {
    const w = createTutorialWorld();
    w.apply({ type: 'placeCommand', x: 3, y: 8 });
    run(w, 30);
    expect(w.s.raid?.nextIn).toBe(Infinity);
    expect(w.s.raid?.canCallEarly).toBe(false);
    expect(w.s.tempo?.points ?? 0).toBe(0);
  });

  it('says «Герой победил» only after the last adaptant is down', () => {
    const g = new TutorialGuide();
    const w = g.world;
    w.apply({ type: 'placeCommand', x: 3, y: 8 });
    (g as unknown as { index: number }).index = 6; // step 7: open the nest
    g.onEvent({ type: 'nest_open' } as never);
    const foe = w.s.units[0];
    const owner = foe.owner;
    foe.owner = -1; // stands in for an adaptant still fighting
    foe.hp = 10;
    w.s.time += 10;
    expect(g.update()).toBe(false);
    foe.hp = 0;
    expect(g.update()).toBe(true);
    expect(g.stepIndex).toBe(7);
    foe.owner = owner;
  });
});

describe('First Shift keeps its last steps (FEEL_AUDIT F-15)', () => {
  it('a cleared nest does not end the tutorial match, so steps 8–9 still reach the player', () => {
    const w = createTutorialWorld();
    w.apply({ type: 'placeCommand', x: 3, y: 8 });
    for (const c of w.s.cells) if (c.content === 'nest') c.resolved = true;
    run(w, 1);
    expect(w.s.outcome).toBe('playing');
    expect(w.s.cells.some((c) => c.content === 'nest')).toBe(true);
  });
});
