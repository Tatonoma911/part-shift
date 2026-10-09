import { describe, expect, it } from 'vitest';
import { config, defenderStats } from '../src/core/data';
import type { Unit } from '../src/core/state';
import { World } from '../src/core/world';
import { handWorld, run } from './helpers';

/** Open field with a school and `n` defenders next to the command center. */
function armed(rows: string[], n: number): World {
  const w = handWorld(rows);
  for (const c of w.s.cells) c.revealed = c.content === 'ground';
  w.apply({ type: 'placeCommand', x: 1, y: 1 });
  // Promote directly: same result as a finished school course.
  const u = w.s.units.find((x) => x.kind === 'resident')!;
  Object.assign(u, { kind: 'defender', base: { ...defenderStats }, hp: defenderStats.hp, home: undefined });
  for (let i = 1; i < n; i++) w.s.units.push({ ...u, id: w.s.nextId++, parts: {}, path: [] } as Unit);
  return w;
}

describe('nests and combat', () => {
  it('opening a nest releases 3 adaptants that wear a part of the nest tech', () => {
    const w = handWorld(['.......', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 0, y: 0 });
    w.cell(6, 2).revealed = false;
    // Dig it by hand.
    (w as unknown as { reveal(x: number, y: number, o: number): void }).reveal(6, 2, 0);
    const foes = w.s.units.filter((u) => u.owner < 0);
    expect(foes).toHaveLength(3);
    for (const f of foes) {
      const part = Object.values(f.parts)[0]!;
      expect(['cryo_arm', 'runner_leg']).toContain(part.id);
      expect(part.tier).toBe(1);
    }
  });

  it('damage = max(1, damage − defense)', () => {
    const w = armed(['.......', '.......', '.......'], 1);
    const d = w.s.units.find((u) => u.kind === 'defender')!;
    const foe = { ...d, id: 999, kind: 'adaptant', owner: -1, base: { hp: 40, damage: 10, defense: 50, attackSeconds: 1, range: 1, speed: 0 }, hp: 40, parts: {} } as Unit;
    w.s.units.push(foe);
    (w as unknown as { hit(a: Unit, t: string): void }).hit(d, 'u:999');
    expect(foe.hp).toBe(39);
  });

  it('defenders guard the base, kill adaptants and take their parts', () => {
    const w = armed(['.........', '.........', '.........', '.........', '........n'], 5);
    (w as unknown as { reveal(x: number, y: number, o: number): void }).reveal(8, 4, 0);
    let attached = 0;
    for (let t = 0; t < 120 && !w.s.sites[0].destroyed; t += 0.05) {
      w.step(0.05);
      attached += w.drainEvents().filter((e) => e.type === 'part_attached').length;
      if (t > 10 && !w.player(0).order) w.apply({ type: 'attack', target: 's:8,4' });
    }
    expect(w.s.units.filter((u) => u.kind === 'defender').length).toBeGreaterThan(0);
    expect(w.s.sites[0].destroyed).toBe(true);
    expect(w.player(0).stats.nests).toBe(1);
    expect(attached).toBeGreaterThan(0);
  });

  it('a part goes to a free slot, then replaces only a weaker one, else is recycled', () => {
    const w = armed(['.......', '.......', '.......'], 1);
    const d = w.s.units.find((u) => u.kind === 'defender')!;
    const take = (id: string, tier: number) => (w as unknown as { takePart(u: Unit, p: { id: string; tier: number }): void }).takePart(d, { id, tier });
    take('thermo_arm', 1);
    take('cryo_arm', 1);
    expect(Object.keys(d.parts).sort()).toEqual(['arm_left', 'arm_right']);
    take('volt_arm', 1); // not strictly better: recycled
    expect(w.s.orbs.at(-1)?.amount).toBe(config.economy.partRecycleEnergyPerTier);
    take('volt_arm', 2);
    expect(Object.values(d.parts).map((p) => p!.id)).toContain('volt_arm');
    expect(w.stats(d).damage).toBe(8 + 2 + 4); // base + cryo t1 + volt t2 (replaced thermo t1)
    take('runner_leg', 1);
    expect(w.stats(d).hp).toBe(48 + 10);
  });

  it('enemies get stronger with the threat level', () => {
    const w = handWorld(['.......', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 0, y: 0 });
    w.s.time = config.threat.secondsPerLevel * 6;
    (w as unknown as { reveal(x: number, y: number, o: number): void }).reveal(6, 2, 0);
    const f = w.s.units.find((u) => u.owner < 0)!;
    expect(f.base.hp).toBeCloseTo(40 * 1.6);
    expect(Object.values(f.parts)[0]!.tier).toBe(3);
  });
});

describe('Demon and the end of the run', () => {
  it('wakes by itself at 15:00 after a warning, and killing it then cooling the ground wins', () => {
    const w = armed(['..............', '..............', '..............', '.............D'], 1);
    w.s.time = config.demon.selfWakeSeconds - config.demon.warningSeconds - 0.01;
    w.step(0.05);
    expect(w.drainEvents().some((e) => e.type === 'demon_warning')).toBe(true);
    w.s.time = config.demon.selfWakeSeconds;
    w.step(0.05);
    const demon = w.s.units.find((u) => u.kind === 'demon')!;
    expect(demon).toBeTruthy();
    expect(Object.values(demon.parts)[0]!.id).toBe('drill_tail');
    demon.hp = 1;
    const d = w.s.units.find((u) => u.kind === 'defender')!;
    (w as unknown as { hit(a: Unit, t: string): void }).hit(d, `u:${demon.id}`);
    w.cell(5, 2).hot = 1;
    w.step(0.05);
    expect(w.s.outcome).toBe('playing'); // ground still hot
    run(w, 1.2);
    expect(w.s.outcome).toBe('victory');
    expect(Object.values(d.parts).map((p) => p!.id)).toContain('drill_tail');
  });

  it('losing the command center is a defeat', () => {
    const w = handWorld(['.......', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 0, y: 0 });
    w.building(w.player(0).command)!.hp = 0;
    w.step(0.05);
    expect(w.s.outcome).toBe('defeat');
  });

  it('the steam blast winds up, then burns a line of ground', () => {
    const w = armed(['..........', '..........', '..........', '.........D'], 1);
    w.s.time = config.demon.selfWakeSeconds;
    w.step(0.05);
    const demon = w.s.units.find((u) => u.kind === 'demon')!;
    demon.x = 4;
    demon.y = 1;
    let windup = false;
    let blast = false;
    for (let i = 0; i < 60; i++) {
      w.step(0.05);
      const ev = w.drainEvents();
      windup ||= ev.some((e) => e.type === 'demon_windup');
      blast ||= ev.some((e) => e.type === 'demon_blast');
    }
    expect(windup && blast).toBe(true);
  });
});

describe('save and determinism', () => {
  it('state survives a JSON round trip and replays identically', () => {
    const a = new World({ seed: 9 });
    a.apply({ type: 'placeCommand', x: 6, y: 8 });
    for (let x = 0; x < 14; x++) a.apply({ type: 'queueDig', x, y: 6 });
    run(a, 30);
    const b = new World({ state: JSON.parse(JSON.stringify(a.s)) });
    run(a, 60);
    run(b, 60);
    expect(JSON.stringify(b.s)).toBe(JSON.stringify(a.s));
  });
});
