import { describe, expect, it } from 'vitest';
import { buildings as buildingDefs } from '../src/core/data';
import { handWorld } from './helpers';
import type { Unit } from '../src/core/state';
import type { World } from '../src/core/world';

type Inner = {
  newUnit(kind: string, owner: number, x: number, y: number, base: object): Unit;
  addBuilding(owner: number, type: string, x: number, y: number, complete: boolean): { id: number; hp: number };
};
const inner = (w: World) => w as unknown as Inner;

/** Command at (0,1); an own hero at (2,1) and an enemy at (5,1). */
function fieldWorld() {
  const w = handWorld(['.......', '.......', '......n']);
  w.apply({ type: 'placeCommand', x: 0, y: 1 });
  const hero = w.s.units.find((x) => x.kind === 'ally' || x.kind === 'resident') as Unit;
  Object.assign(hero, { x: 2, y: 1, path: [], task: { type: 'idle' } });
  const enemy = inner(w).newUnit('adaptant', -1, 5, 1, { hp: 20, damage: 4, defense: 0, attackSeconds: 1, range: 1, speed: 1 });
  w.s.units.push(enemy);
  return { w, hero, enemy };
}

describe('second-row buildings (buildings.json)', () => {
  it('an outpost adds its defense to our heroes in range only', () => {
    const { w, hero } = fieldWorld();
    const base = w.stats(hero).defense;
    const outpost = inner(w).addBuilding(0, 'outpost', 2, 2, true);
    expect(outpost.hp).toBeGreaterThan(0);
    expect(w.stats(hero).defense).toBe(base + buildingDefs.outpost.heroAura!.defenseAdd);
    Object.assign(hero, { x: 9, y: 1 });
    expect(w.stats(hero).defense).toBe(base);
  });

  it('a jammer slows and dulls enemies in range, not heroes', () => {
    const { w, hero, enemy } = fieldWorld();
    const aura = buildingDefs.jammer.aura!;
    const speed = w.stats(enemy).speed;
    const attack = w.stats(enemy).attackSeconds;
    const heroSpeed = w.stats(hero).speed;
    inner(w).addBuilding(0, 'jammer', 4, 1, true);
    expect(w.stats(enemy).speed).toBeCloseTo(speed * aura.moveSpeedFactor!, 5);
    expect(w.stats(enemy).attackSeconds).toBeCloseTo(attack / aura.attackSpeedFactor!, 5);
    expect(w.stats(hero).speed).toBe(heroSpeed);
  });

  it('an unfinished jammer does nothing', () => {
    const { w, enemy } = fieldWorld();
    const speed = w.stats(enemy).speed;
    inner(w).addBuilding(0, 'jammer', 4, 1, false);
    expect(w.stats(enemy).speed).toBe(speed);
  });

  it('a repair building restores HP to our buildings in range over time', () => {
    const w = handWorld(['.......', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 0, y: 1 });
    const cmd = w.s.buildings.find((x) => x.type === 'command')!;
    cmd.hp = 10;
    inner(w).addBuilding(0, 'repair', 1, 2, true);
    for (let t = 0; t < 2; t += 0.05) w.step(0.05);
    expect(cmd.hp).toBeGreaterThan(10);
    expect(cmd.hp).toBeLessThanOrEqual(buildingDefs.command.hp);
  });

  it('each finished relay adds one to the hero cap, at most +2 over the difficulty cap', () => {
    const w = handWorld(['.......', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 0, y: 1 });
    const base = w.residentCap(0);
    inner(w).addBuilding(0, 'relay', 2, 0, true);
    expect(w.residentCap(0)).toBe(base + buildingDefs.relay.heroCapAdd!);
    inner(w).addBuilding(0, 'relay', 4, 0, true);
    expect(w.residentCap(0)).toBe(base + 2);
    inner(w).addBuilding(0, 'relay', 5, 0, false);
    expect(w.residentCap(0)).toBe(base + 2);
  });

  it('a hero that stays next to a medcenter for 60 s regrows one lost limb', () => {
    const w = handWorld(['.......', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 0, y: 1 });
    const hero = w.s.units.find((x) => x.kind === 'ally') as Unit;
    Object.assign(hero, { x: 2, y: 1, path: [], task: { type: 'idle' } });
    hero.lostLimbs = ['arm'];
    hero.base = { ...hero.base, damage: Math.round(hero.base.damage * 0.8) };
    inner(w).addBuilding(0, 'medcenter', 2, 0, true);
    const seconds = buildingDefs.medcenter.regrowLimbSeconds!;
    expect(seconds).toBe(60);
    for (let t = 0; t < seconds - 1; t += 0.05) w.step(0.05);
    expect(hero.lostLimbs).toEqual(['arm']);
    for (let t = 0; t < 2; t += 0.05) w.step(0.05);
    expect(hero.lostLimbs).toBeUndefined();
  });
});
