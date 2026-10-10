import { describe, expect, it } from 'vitest';
import { buildings, civilianRules, controlEvents } from '../src/core/data';
import type { Unit } from '../src/core/state';
import type { World } from '../src/core/world';
import { handWorld, run } from './helpers';

/** Private hooks the balance tests drive directly. */
type Inner = {
  earn(p: unknown, amount: number): void;
  hit(attacker: Unit, target: string): void;
  addBuilding(owner: number, type: string, x: number, y: number, complete: boolean): { id: number; hp: number; type: string };
  newUnit(kind: string, owner: number, x: number, y: number, base: unknown): Unit;
};
const inner = (w: World) => w as unknown as Inner;

function started(rows = ['.......', '.......', '.......']) {
  const w = handWorld(rows);
  w.apply({ type: 'placeCommand', x: 0, y: 1 });
  return w;
}

describe('townsfolk on the balance (MVP_RULES §4.4 v0.2, enemies.json civilian.balance)', () => {
  it('an opened survivor site sends 3–6 townsfolk to the balance: +25 score, +5 Energy and +1 each', () => {
    const w = started(['.......', '..s....', '.......']);
    w.apply({ type: 'queueDig', x: 2, y: 1, force: true });
    const before = w.player(0).energy;
    const events: string[] = [];
    let score = 0;
    for (let t = 0; t < 20; t += 0.05) {
      w.step(0.05);
      for (const e of w.drainEvents()) {
        events.push(e.type);
        if (e.type === 'civilian_rescued') score += e.amount ?? 0;
      }
    }
    const n = w.player(0).civilians ?? 0;
    expect(n).toBeGreaterThanOrEqual(3);
    expect(n).toBeLessThanOrEqual(6);
    expect(events.filter((e) => e === 'civilian_rescued').length).toBe(n);
    expect(score).toBe(n * civilianRules.onReachCommand.score);
    expect(w.player(0).stats.civiliansRescued).toBe(n);
    // +5 each, every one after the first already sped up by the ones before it.
    let energy = 0;
    for (let i = 0; i < n; i++) energy += 5 * (1 + 0.04 * i);
    expect(w.player(0).energy - before).toBeGreaterThanOrEqual(energy - 1e-6);
  });

  it('Energy income × (1 + 0.04 × min(townsfolk, 10 + 5 per Приют))', () => {
    const w = started();
    const p = w.player(0);
    expect(w.civilianIncomeFactor(0)).toBe(1);
    p.civilians = 5;
    expect(w.civilianIncomeFactor(0)).toBeCloseTo(1.2, 9);
    p.civilians = 25;
    expect(w.civilianIncomeFactor(0)).toBeCloseTo(1.4, 9); // cap 10
    if (buildings.civ_shelter) {
      inner(w).addBuilding(0, 'civ_shelter', 1, 2, true);
    } else {
      // buildings.json without civ_shelter yet: the cap only counts the building type.
      w.s.buildings.push({ id: 999, type: 'civ_shelter', owner: 0, x: 1, y: 2, hp: 100, built: 1, complete: true, produceTimer: 0, healTimer: 0 });
    }
    expect(w.civilianBonusCap(0)).toBe(15);
    expect(w.civilianIncomeFactor(0)).toBeCloseTo(1.6, 9);
    p.civilians = 12;
    expect(w.civilianIncomeFactor(0)).toBeCloseTo(1.48, 9);
    // earn() applies it; spending does not.
    const e0 = p.energy;
    inner(w).earn(p, 100);
    expect(p.energy - e0).toBeCloseTo(148, 9);
    p.energy = 500;
    expect(w.apply({ type: 'build', building: 'home', x: 1, y: 0 }).ok).toBe(true);
    expect(p.energy).toBe(500 - buildings.home.cost);
  });

  it('a building destroyed by the enemy costs one townsperson; nothing below zero', () => {
    const w = started();
    const p = w.player(0);
    p.civilians = 2;
    const b = inner(w).addBuilding(0, 'home', 2, 2, true);
    const foe = inner(w).newUnit('adaptant', -1, 3, 2, { hp: 50, damage: 999, defense: 0, attackSeconds: 1, speed: 1 });
    b.hp = 1;
    inner(w).hit(foe, `b:${b.id}`);
    expect(p.civilians).toBe(2 - civilianRules.balance.loseOnBuildingDestroyed);
    inner(w).hit(foe, `b:${b.id}`); // already down: no second loss
    expect(p.civilians).toBe(1);
    p.civilians = 0;
    const b2 = inner(w).addBuilding(0, 'home', 1, 2, true);
    b2.hp = 1;
    inner(w).hit(foe, `b:${b2.id}`);
    expect(p.civilians).toBe(0);
  });

  it('the command center: −1 townsperson per 20 % of HP lost below half', () => {
    const w = started();
    const p = w.player(0);
    const cmd = w.s.buildings.find((b) => b.type === 'command')!;
    const max = buildings.command.hp;
    p.civilians = 5;
    cmd.hp = max * 0.45;
    run(w, 0.05);
    expect(p.civilians).toBe(5);
    cmd.hp = max * 0.29;
    run(w, 0.05);
    expect(p.civilians).toBe(4);
    cmd.hp = max * 0.09;
    run(w, 0.05);
    expect(p.civilians).toBe(3);
    // Healed and hit again: the same steps are not charged twice.
    cmd.hp = max;
    run(w, 0.05);
    cmd.hp = max * 0.29;
    run(w, 0.05);
    expect(p.civilians).toBe(3);
  });

  it('Контроль\'s buyback needs townsfolk on the balance and sells them off it', () => {
    const ev = controlEvents.buyback;
    expect(ev.requires?.civiliansOnBalance).toBe(3);
    expect(ev.a?.civiliansFromBalance).toBe(3);
    const w = started();
    const p = w.player(0);
    p.civilians = 2;
    expect(w.callAvailable('buyback', 0)).toBe(false);
    w.s.controlCall = { id: 'buyback' };
    expect(w.apply({ type: 'answerCall', choice: 'a' }).ok).toBe(false);
    expect(p.civilians).toBe(2);
    p.civilians = 4;
    expect(w.callAvailable('buyback', 0)).toBe(true);
    const e0 = p.energy;
    expect(w.apply({ type: 'answerCall', choice: 'a' }).ok).toBe(true);
    expect(p.civilians).toBe(1);
    expect(p.energy - e0).toBe(Number(ev.a?.energy)); // a sale, not income: no balance bonus
    expect(w.s.controlCall).toBeNull();
  });
});
