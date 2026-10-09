import { beforeEach, describe, expect, it } from 'vitest';
import { RunTally } from '../src/game/meta/record';
import { heroProgress, HEROES, loadMeta } from '../src/game/meta/store';
import { World } from '../src/core/world';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

describe('meta progress (design/META.md)', () => {
  beforeEach(() => store.clear());

  it('a lost run still counts: stats, score, seen heroes and hero defeats land in the save', () => {
    const w = new World({ seed: 3 });
    w.apply({ type: 'placeCommand', x: 6, y: 8 });
    const p = w.player(0);
    p.stats.energy = 400;
    p.stats.nests = 2;
    const tally = new RunTally(0);
    tally.onEvent({ type: 'hero_spawn', text: 'kiln', x: 0, y: 0 });
    tally.onEvent({ type: 'hero_defeated', text: 'kiln', x: 0, y: 0 });
    tally.onEvent({ type: 'dig_done', x: 0, y: 0, owner: 0 });
    tally.onEvent({ type: 'dig_done', x: 0, y: 0, owner: 1 });
    const { view } = tally.commit(w, 'lose');
    const m = loadMeta();
    expect(m.stats.runs_played).toBe(1);
    expect(m.stats.runs_won).toBeUndefined();
    expect(m.stats.tiles_dug).toBe(1);
    expect(m.stats['hero_defeats.kiln']).toBe(1);
    expect(m.seenHeroes).toContain('kiln');
    expect(m.stats.total_score).toBe(view.total);
    expect(view.total).toBeGreaterThan(0);
    expect(view.scoreBefore).toBe(0);
  });

  it('a hero comes back once its condition is met, and only once', () => {
    const kiln = HEROES.find((h) => h.unlock.type === 'defeat_hero')!;
    const w = new World({ seed: 3 });
    w.apply({ type: 'placeCommand', x: 6, y: 8 });
    const need = heroProgress(loadMeta(), kiln).need;
    const tally = new RunTally(0);
    for (let i = 0; i < need; i++) tally.onEvent({ type: 'hero_defeated', text: kiln.unlock.hero, x: 0, y: 0 });
    const first = tally.commit(w, 'win');
    expect(first.unlocked).toContain(kiln.id);
    expect(loadMeta().unlocked).toContain(kiln.id);
    const again = new RunTally(0).commit(w, 'win');
    expect(again.unlocked).not.toContain(kiln.id);
  });
});
