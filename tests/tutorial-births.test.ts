import { describe, expect, it } from 'vitest';
import { createTutorialWorld } from '../src/core/levels';
import { run } from './helpers';

describe('tutorial hero births (MVP_RULES §22.21)', () => {
  it('starts with one hero, then one every 30 s, up to three', () => {
    const w = createTutorialWorld(1);
    const r = w.apply({ type: 'placeCommand', x: 4, y: 5 });
    expect(r.ok).toBe(true);
    const heroes = () => w.s.units.filter((u) => u.owner === 0 && u.kind === 'ally').length;
    expect(heroes()).toBe(1);
    run(w, 29);
    expect(heroes()).toBe(1);
    run(w, 2);
    expect(heroes()).toBe(2);
    run(w, 60);
    expect(heroes()).toBe(3);
    run(w, 200);
    expect(heroes()).toBe(3);
  });
});
