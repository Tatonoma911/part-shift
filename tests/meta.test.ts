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

describe('cache bonuses (boons.json, META.md §8)', () => {
  const caches = (rules = {}) => {
    const w = new World({ seed: 5, rules: { boonPool: ['energy_cache', 'reactor_overclock', 'sharp_shovels', 'reinforcements', 'field_training', 'armor_plates'], ...rules } });
    w.apply({ type: 'placeCommand', x: 6, y: 8 });
    const at = w.s.cells.findIndex((c) => c.content === 'cache' && !c.revealed);
    return { w, x: at % w.s.width, y: Math.floor(at / w.s.width) };
  };
  const open = (w: World, x: number, y: number) => (w as unknown as { reveal(x: number, y: number, o: number): void }).reveal(x, y, 0);

  it('an opened cache pays 20 Energy and offers three different cards; picking one applies it', () => {
    const { w, x, y } = caches();
    const before = w.player(0).energy;
    open(w, x, y);
    const p = w.player(0);
    expect(p.energy - before).toBe(20);
    expect(p.boonOffer?.ids).toHaveLength(3);
    expect(new Set(p.boonOffer!.ids).size).toBe(3);
    expect(w.apply({ type: 'pickBoon', id: 'not_offered' }).ok).toBe(false);
    const id = p.boonOffer!.ids[0];
    expect(w.apply({ type: 'pickBoon', id }).ok).toBe(true);
    expect(p.boons?.[id]).toBe(1);
    expect(p.boonOffer).toBeUndefined();
  });

  it('effects: Заначка pays 120, Бронежилеты add defense, Подкрепление adds residents and places', () => {
    const { w } = caches();
    const p = w.player(0);
    const grant = (id: string) => {
      p.boonOffer = { ids: [id], at: 0 };
      expect(w.apply({ type: 'pickBoon', id }).ok).toBe(true);
    };
    const e0 = p.energy;
    grant('energy_cache');
    expect(p.energy - e0).toBe(120);
    const r = w.s.units.find((u) => u.kind === 'resident')!;
    const d0 = w.stats(r).defense;
    grant('armor_plates');
    expect(w.stats(r).defense - d0).toBe(2);
    const n0 = w.s.units.filter((u) => u.kind === 'resident').length;
    const cap0 = w.residentCap(0);
    grant('reinforcements');
    expect(w.s.units.filter((u) => u.kind === 'resident').length - n0).toBe(2);
    expect(w.residentCap(0) - cap0).toBe(2);
  });

  it('without a pool (tutorial, old saves) a cache only pays Energy', () => {
    const w = new World({ seed: 5 });
    w.apply({ type: 'placeCommand', x: 6, y: 8 });
    const at = w.s.cells.findIndex((c) => c.content === 'cache' && !c.revealed);
    open(w, at % w.s.width, Math.floor(at / w.s.width));
    expect(w.player(0).boonOffer).toBeUndefined();
  });
});
