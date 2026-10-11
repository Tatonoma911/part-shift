import { describe, expect, it } from 'vitest';
import type { Unit } from '../src/core/state';
import { hazards } from '../src/core/data';
import { handWorld, run } from './helpers';

function setup(rows: string[]) {
  const w = handWorld(rows);
  for (const c of w.s.cells) c.revealed = true;
  w.apply({ type: 'placeCommand', x: 0, y: 0 });
  return w;
}

function medkitAt(w: ReturnType<typeof handWorld>, x: number, y: number): void {
  const c = w.cell(x, y);
  c.content = 'medkit';
  c.stock = hazards.medkit.count;
}

function ally(w: ReturnType<typeof handWorld>, x: number, y: number, hp?: number): Unit {
  const u = { id: 800 + w.s.units.length, owner: 0, kind: 'ally', hero: 'kiln', x, y, hp: 100, base: { hp: 100, damage: 5, defense: 0, speed: 1 }, path: [], task: { type: 'idle' }, parts: {}, attackCooldown: 0, repathTimer: 0 } as unknown as Unit;
  u.hp = hp ?? w.maxHp(u);
  w.s.units.push(u);
  return u;
}

describe('field medkits: take, pick up, eat (MVP_RULES §22.19)', () => {
  it('«Взять» moves one charge into the Medcenter stock and leaves the medkit on the field', () => {
    const w = setup(['.......', '.......']);
    medkitAt(w, 4, 1);
    const r = w.apply({ type: 'takeMedkit', x: 4, y: 1 });
    expect(r.ok).toBe(true);
    expect(w.cell(4, 1).stock).toBe(hazards.medkit.count - 1);
    expect(w.cell(4, 1).content).toBe('medkit');
    expect(w.player(0).medkits).toBe(1);
  });

  it('a hero who walks over a medkit picks a charge up and keeps it in the slot', () => {
    const w = setup(['.......', '.......']);
    medkitAt(w, 3, 1);
    const u = ally(w, 3, 1);
    run(w, 0.1);
    expect(u.medkit).toBe(true);
    expect(w.cell(3, 1).stock).toBe(hazards.medkit.count - 1);
    expect(w.cell(3, 1).content).toBe('medkit');
  });

  it('a wounded hero runs to the nearest field medkit and eats it there', () => {
    const w = setup(['.........', '.........']);
    medkitAt(w, 7, 1);
    const u = ally(w, 1, 1, 10);
    run(w, 8); // walks there and eats it while the medkit is still healing
    expect(w.cell(7, 1).heal).toBeDefined();
    expect(w.cell(7, 1).stock).toBe(hazards.medkit.count - 1);
    expect(u.hp).toBeGreaterThan(10);
  });
});
