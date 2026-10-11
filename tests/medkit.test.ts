import { describe, expect, it } from 'vitest';
import type { Unit } from '../src/core/state';
import { heroMedkits } from '../src/core/data';
import { handWorld, run } from './helpers';

function started(w: ReturnType<typeof handWorld>): void {
  for (const c of w.s.cells) c.revealed = c.content === 'ground';
  w.apply({ type: 'placeCommand', x: 0, y: 0 });
}

function withAlly(w: ReturnType<typeof handWorld>, hp?: number): Unit {
  const u = { id: 500 + w.s.units.length, owner: 0, kind: 'ally', hero: 'kiln', x: 2, y: 2, hp: 0, base: { hp: 100, damage: 5, defense: 0, speed: 1 }, path: [], task: { type: 'idle' }, parts: {}, attackCooldown: 0, repathTimer: 0 } as unknown as Unit;
  u.hp = hp ?? w.maxHp(u);
  w.s.units.push(u);
  return u;
}

function withMedcenter(w: ReturnType<typeof handWorld>, owner = 0): void {
  w.s.buildings.push({ id: 900 + w.s.buildings.length, type: 'medcenter', owner, x: 1, y: 1, hp: 250, built: 1, complete: true } as never);
}

describe('hero medkits (MVP_RULES §22.19)', () => {
  it('no Medcenter, no medkits', () => {
    const w = handWorld(['.......', '.......']);
    started(w);
    withAlly(w);
    run(w, heroMedkits.chargeSeconds * 3);
    expect(w.s.units.some((x) => x.medkit)).toBe(false);
    expect(w.player(0).medkits ?? 0).toBe(0);
  });

  it('a Medcenter stocks a charge over time and a hero takes one (one slot)', () => {
    const w = handWorld(['.......', '.......']);
    started(w);
    withMedcenter(w);
    withAlly(w);
    run(w, heroMedkits.chargeSeconds + 1);
    const carriers = w.s.units.filter((x) => x.owner === 0 && x.kind === 'ally' && x.medkit);
    expect(carriers.length).toBe(1);
    expect(w.player(0).medkits).toBe(0);
  });

  it('eats the medkit below 25 % HP and heals to full', () => {
    const w = handWorld(['.......', '.......']);
    started(w);
    withMedcenter(w);
    withAlly(w);
    run(w, heroMedkits.chargeSeconds + 1);
    const carrier = w.s.units.find((x) => x.owner === 0 && x.kind === 'ally' && x.medkit) as Unit;
    carrier.hp = w.maxHp(carrier) * 0.2;
    run(w, 0.1);
    expect(carrier.hp).toBe(w.maxHp(carrier));
    expect(carrier.medkit).toBe(false);
    expect(w.drainEvents().some((e) => e.type === 'medkit_carried_use')).toBe(true);
  });

  it('keeps the medkit above 25 % HP', () => {
    const w = handWorld(['.......', '.......']);
    started(w);
    withMedcenter(w);
    withAlly(w);
    run(w, heroMedkits.chargeSeconds + 1);
    const carrier = w.s.units.find((x) => x.owner === 0 && x.kind === 'ally' && x.medkit) as Unit;
    carrier.hp = w.maxHp(carrier) * 0.5;
    run(w, 0.1);
    expect(carrier.medkit).toBe(true);
  });
});
