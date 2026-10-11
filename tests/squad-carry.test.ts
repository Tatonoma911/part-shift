import { beforeEach, describe, expect, it } from 'vitest';
import { World } from '../src/core/world';
import { getCampaignWorld } from '../src/game/campaign';
import { emptyMeta, offerHero, pickAllies, saveSquad, squadSlots } from '../src/game/meta/store';
import type { MetaSave } from '../src/game/meta/store';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

describe('the squad carries from shift to shift', () => {
  beforeEach(() => store.clear());

  it('a three-hero squad is kept whole, not cut to the one-slot ally table', () => {
    const m: MetaSave = emptyMeta();
    expect(squadSlots(m).slots).toBe(3);
    pickAllies(m, ['standard', 'patch', 'canopy']);
    expect(m.allyChoice).toEqual(['standard', 'patch', 'canopy']);
    expect(m.lastSquad).toEqual(['standard', 'patch', 'canopy']);
  });

  it('a hero returned on the unlock card joins the offered squad instead of replacing it', () => {
    const m: MetaSave = emptyMeta();
    saveSquad(m, ['standard', 'patch', 'canopy']);
    offerHero(m, 'lineman');
    expect(m.lastSquad).toEqual(['standard', 'patch', 'canopy']);
    expect(m.allyChoice).toEqual(['standard', 'patch', 'canopy']);
  });

  it('a hero joins the offered squad only while there is a free slot', () => {
    const m: MetaSave = emptyMeta();
    saveSquad(m, ['standard', 'patch']);
    offerHero(m, 'canopy');
    expect(m.lastSquad).toEqual(['standard', 'patch', 'canopy']);
  });

  it('a hero an infected roll took this shift is benched, and comes back on the next squad screen', () => {
    const m: MetaSave = emptyMeta();
    saveSquad(m, ['standard', 'patch', 'canopy']);
    saveSquad(m, ['standard', 'canopy'], ['patch']);
    expect(m.allyChoice).toEqual(['standard', 'canopy']);
    expect(m.lastSquad).toEqual(['standard', 'canopy', 'patch']);
  });

  it('a benched hero does not block a returned hero when a slot is free (QA-057)', () => {
    const m: MetaSave = emptyMeta();
    saveSquad(m, ['standard', 'canopy'], ['patch']);
    offerHero(m, 'lineman');
    expect(m.allyChoice).toEqual(['standard', 'canopy', 'lineman']);
    expect(m.lastSquad).toEqual(['standard', 'canopy', 'patch', 'lineman']);
  });

  it('shift 2 starts with every hero of the chosen squad on the board', () => {
    const o = getCampaignWorld(2);
    const w = new World({
      seed: 11,
      width: o.width,
      height: o.height,
      difficulty: o.difficulty,
      rules: { allies: ['standard', 'patch', 'canopy'], raids: o.raids, cellElements: o.cellElements },
    });
    w.apply({ type: 'placeCommand', x: Math.floor(o.width / 2), y: Math.floor(o.height / 2) });
    // The command births the first heroes at once; the rest come on their birth timers.
    for (let i = 0; i < 60 * 20; i++) w.tick(0.05);
    const onBoard = new Set(w.s.units.filter((u) => u.owner === 0 && u.kind === 'ally' && u.hp > 0).map((u) => u.hero));
    expect([...onBoard].sort()).toEqual(['canopy', 'patch', 'standard']);
  });
});
