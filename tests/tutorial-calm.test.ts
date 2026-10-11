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
    (g as unknown as { index: number }).index = 7; // step 7: open the nest (the card step 6b sits before it)
    g.onEvent({ type: 'nest_open' } as never);
    const foe = w.s.units[0];
    const owner = foe.owner;
    foe.owner = -1; // stands in for an adaptant still fighting
    foe.hp = 10;
    w.s.time += 10;
    expect(g.update()).toBe(false);
    foe.hp = 0;
    expect(g.update()).toBe(true);
    expect(g.stepIndex).toBe(8);
    foe.owner = owner;
  });
});

describe('First Shift never blocks the win (coordinator relay 2026-10-11)', () => {
  it('clearing every nest wins the tutorial match even with its steps unfinished', () => {
    const w = createTutorialWorld();
    w.apply({ type: 'placeCommand', x: 3, y: 8 });
    for (const c of w.s.cells) if (c.content === 'nest') c.resolved = true;
    run(w, 1);
    expect(w.s.outcome).toBe('victory');
  });

  it('skipping every step and winning the board ends the match; the guide never gates it', () => {
    const g = new TutorialGuide();
    const w = g.world;
    w.apply({ type: 'placeCommand', x: 3, y: 8 });
    for (const c of w.s.cells) if (c.content === 'nest') c.resolved = true;
    run(w, 1);
    expect(w.s.outcome).toBe('victory');
    expect(g.finished).toBe(false);
  });
});
