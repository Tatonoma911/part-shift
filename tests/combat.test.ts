import { describe, expect, it } from 'vitest';
import { config, heroes, residentStats } from '../src/core/data';
import type { Unit } from '../src/core/state';
import { World } from '../src/core/world';
import { handWorld, residents, run } from './helpers';

type Internals = {
  reveal(x: number, y: number, o: number): void;
  hit(a: Unit, t: string): void;
  takePart(u: Unit, p: { id: string; tier: number }): void;
};
const internals = (w: World) => w as unknown as Internals;

/** Open field with the command center at (1,1) and `n` residents. */
function squad(rows: string[], n: number): World {
  const w = handWorld(rows);
  for (const c of w.s.cells) c.revealed = c.content === 'ground';
  w.apply({ type: 'placeCommand', x: 1, y: 1 });
  const first = residents(w)[0];
  w.s.units = w.s.units.filter((u) => u === first);
  for (let i = 1; i < n; i++) w.s.units.push({ ...first, id: w.s.nextId++, parts: {}, path: [] } as Unit);
  return w;
}

const foe = (w: World, over: Partial<Unit> = {}): Unit => {
  const u = {
    ...residents(w)[0],
    id: 999,
    kind: 'adaptant',
    owner: -1,
    tech: 'cryo',
    attackTech: 'cryo',
    base: { hp: 40, damage: 10, defense: 0, attackSeconds: 1, range: 1, speed: 0 },
    hp: 40,
    parts: {},
    ...over,
  } as Unit;
  w.s.units.push(u);
  return u;
};

describe('nests and combat', () => {
  it('opening a nest releases 3 adaptants that wear a part of the nest tech', () => {
    const w = handWorld(['.......', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 0, y: 0 });
    internals(w).reveal(6, 2, 0);
    const foes = w.s.units.filter((u) => u.owner < 0);
    expect(foes).toHaveLength(3);
    for (const f of foes) {
      const part = Object.values(f.parts)[0]!;
      expect(['cryo_arm', 'runner_leg']).toContain(part.id);
      expect(part.tier).toBe(1);
      expect(f.tech).toBe('cryo');
    }
  });

  it('damage = max(1, damage × element − defense)', () => {
    const w = squad(['.......', '.......', '.......'], 1);
    const r = residents(w)[0];
    const f = foe(w, { base: { hp: 40, damage: 10, defense: 50, attackSeconds: 1, range: 1, speed: 0 } });
    internals(w).hit(r, 'u:999');
    expect(f.hp).toBe(39);
  });

  it('the right element hurts more: a volt arm against a cryo adaptant hits ×1.5', () => {
    const w = squad(['.......', '.......', '.......'], 1);
    const r = residents(w)[0];
    r.parts.arm_right = { id: 'volt_arm', tier: 1 };
    const f = foe(w, { hp: 100, base: { hp: 100, damage: 10, defense: 0, attackSeconds: 1, range: 1, speed: 0 } });
    expect(w.attackOf(r, f).tech).toBe('volt');
    internals(w).hit(r, 'u:999');
    expect(f.hp).toBeCloseTo(100 - (residentStats.damage + 2) * 1.5);
  });

  it('residents dig and fight: they guard the base, kill adaptants and take their parts', () => {
    const w = squad(['.........', '.........', '.........', '.........', '........n'], 8);
    internals(w).reveal(8, 4, 0);
    let attached = 0;
    for (let t = 0; t < 150 && !w.s.sites[0].destroyed; t += 0.05) {
      w.step(0.05);
      attached += w.drainEvents().filter((e) => e.type === 'part_attached').length;
      if (t > 10 && !w.player(0).order) w.apply({ type: 'attack', target: 's:8,4' });
    }
    expect(residents(w).length).toBeGreaterThan(0);
    expect(w.s.sites[0].destroyed).toBe(true);
    expect(w.player(0).stats.nests).toBe(1);
    expect(attached).toBeGreaterThan(0);
  });

  it('without an order residents pick open nests near the base', () => {
    const w = squad(['.......', '.......', '.......', '...n...'], 1);
    const r = residents(w)[0];
    internals(w).reveal(3, 3, 0);
    for (const f of w.s.units.filter((u) => u.owner < 0)) f.hp = 0;
    w.s.units = w.s.units.filter((u) => u.hp > 0);
    run(w, 0.2);
    expect(r.target).toBe('s:3,3');
  });

  it('tapping the same target again keeps the order; a tap on open ground lifts it', () => {
    const w = squad(['.......', '.......', '......n'], 1);
    internals(w).reveal(6, 2, 0);
    expect(w.apply({ type: 'attack', target: 's:6,2' }).ok).toBe(true);
    expect(w.player(0).order).toBe('s:6,2');
    w.apply({ type: 'attack', target: 's:6,2' });
    expect(w.player(0).order).toBe('s:6,2');
    w.apply({ type: 'cancelOrder' });
    expect(w.player(0).order).toBeNull();
  });

  it('an ordered enemy out on unopened ground: residents go as close as they can and hit it', () => {
    const w = squad(['........', '........', '........', '........'], 3);
    // Columns 5..7 are still closed; the foe stands at (6,1) and doesn't move.
    for (const c of w.s.cells) c.revealed = true;
    for (let y = 0; y < 4; y++) for (let x = 5; x < 8; x++) w.cell(x, y).revealed = false;
    const f = foe(w, { x: 5, y: 1, base: { hp: 400, damage: 0, defense: 0, attackSeconds: 9, range: 1, speed: 0 }, hp: 400 });
    expect(w.apply({ type: 'attack', target: `u:${f.id}` }).ok).toBe(true);
    run(w, 8);
    expect(f.hp).toBeLessThan(400);
  });

  it('tapping an opened hero lair orders the attack on its hero', () => {
    const w = squad(['.......', '.......', '......L'], 1);
    internals(w).reveal(6, 2, 0);
    const kiln = w.s.units.find((u) => u.hero === 'kiln')!;
    expect(w.apply({ type: 'attack', target: 's:6,2' }).ok).toBe(true);
    expect(w.player(0).order).toBe(`u:${kiln.id}`);
  });

  it('a part goes to a free slot, then replaces only a weaker one, else is recycled', () => {
    const w = squad(['.......', '.......', '.......'], 1);
    const r = residents(w)[0];
    const take = (id: string, tier: number) => internals(w).takePart(r, { id, tier });
    take('thermo_arm', 1);
    take('cryo_arm', 1);
    expect(Object.keys(r.parts).sort()).toEqual(['arm_left', 'arm_right']);
    take('volt_arm', 1); // not strictly better: recycled
    expect(w.s.orbs.at(-1)?.amount).toBe(config.economy.partRecycleEnergyPerTier);
    take('volt_arm', 2);
    expect(Object.values(r.parts).map((p) => p!.id)).toContain('volt_arm');
    take('runner_leg', 1);
    expect(w.stats(r).hp).toBe(residentStats.hp + 10);
  });

  it('a part protects from its own element', () => {
    const w = squad(['.......', '.......', '.......'], 1);
    const r = residents(w)[0];
    expect(w.resistOf(r, 'thermo')).toBe(1);
    r.parts.arm_right = { id: 'thermo_arm', tier: 3 };
    expect(w.resistOf(r, 'thermo')).toBeCloseTo(0.64);
  });

  it('three cryo hits in a row freeze the target', () => {
    const w = squad(['.......', '.......', '.......'], 1);
    const r = residents(w)[0];
    r.parts.arm_right = { id: 'cryo_arm', tier: 1 };
    const f = foe(w, { tech: 'thermo', hp: 500, base: { hp: 500, damage: 10, defense: 0, attackSeconds: 1, range: 1, speed: 0 } });
    for (let i = 0; i < 3; i++) internals(w).hit(r, 'u:999');
    expect(f.stun).toBeGreaterThan(0);
  });

  it('enemies get stronger with the threat level', () => {
    const w = handWorld(['.......', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 0, y: 0 });
    w.s.time = w.cfg.threat.secondsPerLevel * 6;
    internals(w).reveal(6, 2, 0);
    const f = w.s.units.find((u) => u.owner < 0)!;
    expect(f.base.hp).toBeCloseTo(40 * 1.6 * w.difficulty.enemyHpFactor);
    expect(Object.values(f.parts)[0]!.tier).toBe(3);
  });
});

describe('heroes and the call target', () => {
  it('an opened lair releases its hero; beating it gives two hero parts and energy', () => {
    const w = squad(['..........', '..........', '..........', '.........L'], 3);
    internals(w).reveal(9, 3, 0);
    const kiln = w.s.units.find((u) => u.kind === 'hero')!;
    expect(kiln.hero).toBe('kiln');
    const [a, b] = residents(w);
    kiln.hp = 50;
    kiln.dealt = { [b.id]: 40 };
    const e0 = w.player(0).energy;
    a.base = { ...a.base, damage: 200 };
    internals(w).hit(a, `u:${kiln.id}`);
    expect(Object.values(a.parts).map((p) => p!.id)).toContain('kiln_arm');
    expect(Object.values(b.parts).map((p) => p!.id)).toContain('kiln_leg');
    expect(w.player(0).energy).toBe(e0 + heroes.kiln.enemy.reward);
    expect(w.cell(9, 3).resolved).toBe(true);
    expect(w.player(0).stats.heroes).toContain('kiln');
  });

  it('Standard comes as three copies with a third of the HP each', () => {
    const w = squad(['..........', '..........', '..........', '.........L'], 1);
    Object.assign(w.cell(9, 3), { hero: 'standard', heroTier: 1 });
    internals(w).reveal(9, 3, 0);
    const copies = w.s.units.filter((u) => u.hero === 'standard');
    expect(copies).toHaveLength(3);
    expect(copies[0].base.hp).toBeCloseTo((heroes.standard.enemy.hp / 3) * w.difficulty.enemyHpFactor);
  });

  it('unopened lairs open by themselves at their threat level', () => {
    const w = squad(['..........', '..........', '..........', '.........L'], 1);
    w.s.time = 4 * w.cfg.threat.secondsPerLevel - 0.01;
    w.step(0.05);
    expect(w.s.units.some((u) => u.hero === 'kiln')).toBe(false);
    w.s.time = w.difficulty.lairSelfOpenThreatLevels[2] * w.cfg.threat.secondsPerLevel;
    w.step(0.05);
    expect(w.s.units.some((u) => u.hero === 'kiln')).toBe(true);
  });

  it('the call target wakes by itself after a warning, and beating it then cooling the ground wins', () => {
    const w = squad(['..............', '..............', '..............', '.............D'], 1);
    w.s.time = w.cfg.boss.selfWakeSeconds - w.cfg.boss.warningSeconds - 0.01;
    w.step(0.05);
    expect(w.drainEvents().some((e) => e.type === 'boss_warning')).toBe(true);
    w.s.time = w.cfg.boss.selfWakeSeconds;
    w.step(0.05);
    const demon = w.s.units.find((u) => u.hero === 'demon')!;
    expect(demon).toBeTruthy();
    expect(demon.base.hp).toBeCloseTo(heroes.demon.enemy.hp * (1 + 0.1 * w.threatLevel) * w.difficulty.callTargetHpFactor * w.difficulty.enemyHpFactor);
    demon.hp = 1;
    const r = residents(w)[0];
    internals(w).hit(r, `u:${demon.id}`);
    expect(w.s.boss.dead).toBe(true);
    w.cell(5, 2).hot = 1;
    w.step(0.05);
    expect(w.s.outcome).toBe('playing'); // ground still hot
    run(w, 1.2);
    expect(w.s.outcome).toBe('victory');
    expect(Object.values(r.parts).map((p) => p!.id)).toEqual(expect.arrayContaining(['demon_arm', 'drill_tail']));
  });

  it('losing the command center is a defeat', () => {
    const w = handWorld(['.......', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 0, y: 0 });
    w.building(w.player(0).command)!.hp = 0;
    w.step(0.05);
    expect(w.s.outcome).toBe('defeat');
  });

  it("the Demon's steam blast winds up, then burns a line of ground", () => {
    const w = squad(['..........', '..........', '..........', '.........D'], 1);
    w.s.time = w.cfg.boss.selfWakeSeconds;
    w.step(0.05);
    const demon = w.s.units.find((u) => u.hero === 'demon')!;
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
