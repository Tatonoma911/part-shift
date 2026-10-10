import { describe, expect, it } from 'vitest';
import { hazards } from '../src/core/data';
import type { GameEvent, World } from '../src/core/world';
import { handWorld, run as runFor } from './helpers';

/** Steps the world and collects every event it emitted. */
function run(w: World, seconds: number, out: GameEvent[] = []): GameEvent[] {
  for (let t = 0; t < seconds; t += 0.05) {
    w.step(0.05);
    out.push(...w.drainEvents());
  }
  return out;
}

/** A world with one site of `content` at (2,1), next to the command center at (0,1). */
function siteWorld(content: 'mine' | 'bonus_capsule' | 'medkit') {
  const w = handWorld(['.......', '.......', '......n']);
  w.apply({ type: 'placeCommand', x: 0, y: 1 });
  const c = w.cell(2, 1);
  c.content = content;
  if (content === 'mine') c.tech = 'thermo';
  w.apply({ type: 'queueDig', x: 2, y: 1, force: true });
  return w;
}

describe('hazards (hazards.json)', () => {
  it('a dug mine arms, blows after the fuse, hurts heroes around it and sets its element status', () => {
    const w = siteWorld('mine');
    const log = run(w, 20);
    const events = log.map((e) => e.type);
    expect(events).toContain('mine_armed');
    expect(events).toContain('mine_blast');
    expect(w.cell(2, 1).resolved).toBe(true);
    expect(w.cell(2, 1).fuse).toBeUndefined();
    expect(hazards.mine.unmarkedDig.status.thermo).toBe('burn');
  });

  it('a mine dug under an «Опасно» mark is defused for Energy instead of blowing', () => {
    const w = handWorld(['.......', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 0, y: 1 });
    const c = w.cell(2, 1);
    c.content = 'mine';
    c.tech = 'volt';
    w.apply({ type: 'toggleMark', x: 2, y: 1 });
    expect(w.apply({ type: 'queueDig', x: 2, y: 1 }).ok).toBe(false);
    expect(w.apply({ type: 'queueDig', x: 2, y: 1, force: true }).ok).toBe(true);
    const events = run(w, 20).map((e) => e.type);
    expect(events).toContain('mine_defused');
    expect(events).not.toContain('mine_blast');
    expect(c.resolved).toBe(true);
  });

  it('a bonus capsule gives exactly one bonus', () => {
    const w = siteWorld('bonus_capsule');
    const opened = run(w, 20).filter((e) => e.type === 'bonus_opened').map((e) => e.text ?? '');
    expect(opened.length).toBe(1);
    expect(Object.keys(hazards.bonusCapsule.pool)).toContain(opened[0]);
    expect(w.cell(2, 1).bonus).toBe(opened[0]);
  });

  it('a medkit has two charges, one per tap, and a tap during a heal is refused', () => {
    const w = siteWorld('medkit');
    run(w, 20);
    expect(w.apply({ type: 'useMedkit', x: 2, y: 1 }).ok).toBe(true);
    expect(w.apply({ type: 'useMedkit', x: 2, y: 1 }).ok).toBe(false);
    run(w, hazards.medkit.seconds + 1);
    expect(w.apply({ type: 'useMedkit', x: 2, y: 1 }).ok).toBe(true);
    run(w, hazards.medkit.seconds + 1);
    expect(w.apply({ type: 'useMedkit', x: 2, y: 1 }).ok).toBe(false);
    expect(w.cell(2, 1).resolved).toBe(true);
  });

  it('an opened medkit heals wounded heroes next to it and then runs dry', () => {
    const w = siteWorld('medkit');
    const log = run(w, 20);
    const events = log.map((e) => e.type);
    expect(events).toContain('medkit_open');
    const u = w.s.units.find((x) => x.kind === 'ally' || x.kind === 'resident')!;
    u.x = 2;
    u.y = 1;
    u.path = [];
    u.task = { type: 'idle' };
    u.hp = 1;
    expect(w.apply({ type: 'useMedkit', x: 2, y: 1 }).ok).toBe(true);
    run(w, 1, log);
    expect(u.hp).toBeGreaterThan(1);
    run(w, hazards.medkit.seconds + 1, log);
    expect(log.map((e) => e.type)).toContain('medkit_empty');
  });
});

/** Private hooks the blast tests drive directly (no fuse, no wandering). */
type Inner = {
  mineBlast(x: number, y: number, c: unknown): void;
  addBuilding(owner: number, type: string, x: number, y: number, complete: boolean): { id: number; hp: number };
};
const inner = (w: World) => w as unknown as Inner;

/** Command at (0,1), a mine at (3,1) (tech `tech`), our first hero moved next to it at (2,1). */
function blastWorld(tech: 'impact' | 'thermo' = 'impact', difficulty?: string) {
  const w = handWorld(['.......', '.......', '......n']);
  if (difficulty) w.s.difficulty = difficulty;
  w.apply({ type: 'placeCommand', x: 0, y: 1 });
  const c = w.cell(3, 1);
  c.content = 'mine';
  c.tech = tech;
  const u = w.s.units.find((x) => x.kind === 'ally' || x.kind === 'resident')!;
  Object.assign(u, { x: 2, y: 1, path: [], task: { type: 'idle' } });
  u.hp = w.maxHp(u);
  return { w, c, u };
}

describe('mines v0.2 (MVP_RULES §5.2, hazards.json mine.unmarkedDig)', () => {
  const m = hazards.mine.unmarkedDig;

  it('a hero in the blast loses the difficulty share of max HP and is concussed', () => {
    for (const [diff, share] of [['intern', 0.25], ['shift', 0.35], ['rush', 0.45]] as const) {
      const { w, c, u } = blastWorld('impact', diff);
      expect(m.heroDamageMaxHpFraction[diff === 'rush' ? 'crunch' : diff]).toBe(share);
      u.parts = {}; // a torn trophy would change max HP
      u.hp = w.maxHp(u);
      const max = w.maxHp(u);
      const speed = w.stats(u).speed;
      const attack = w.stats(u).attackSeconds;
      inner(w).mineBlast(3, 1, c);
      expect(u.hp).toBeCloseTo(Math.max(1, max * (1 - share)), 5);
      expect(u.concussed).toBe(m.concussion.seconds);
      expect(w.stats(u).speed).toBeCloseTo(speed * m.concussion.moveSpeedFactor, 5);
      expect(w.stats(u).attackSeconds).toBeCloseTo(attack / m.concussion.attackSpeedFactor, 5);
    }
  });

  it('the blast alone never knocks anyone out: at least 1 HP stays', () => {
    const { w, c, u } = blastWorld();
    u.hp = 3;
    inner(w).mineBlast(3, 1, c);
    expect(u.hp).toBe(m.leavesMinHp);
    expect(w.s.units).toContain(u);
  });

  it('the concussion wears off after 20 s', () => {
    const { w, c, u } = blastWorld();
    inner(w).mineBlast(3, 1, c);
    runFor(w, m.concussion.seconds + 0.5);
    expect(u.concussed).toBeUndefined();
  });

  it('tears off a limb about a quarter of the time (seeded RNG)', () => {
    let torn = 0;
    const N = 200;
    for (let seed = 1; seed <= N; seed++) {
      const { w, c, u } = blastWorld();
      w.s.rng = seed * 7919;
      u.parts = { arm_left: { id: 'thermo_arm', tier: 1 } };
      inner(w).mineBlast(3, 1, c);
      if (!u.parts.arm_left) torn++;
      expect(u.hp).toBeGreaterThanOrEqual(1);
    }
    expect(m.tearLimbChance).toBe(0.25);
    expect(torn / N).toBeGreaterThan(0.12);
    expect(torn / N).toBeLessThan(0.38);
  });

  it('buildings in the radius lose 40 % of max HP; the threat clock jumps 15 s and the tempo resets', () => {
    const { w, c } = blastWorld();
    const b = inner(w).addBuilding(0, 'home', 2, 2, true);
    const before = b.hp;
    const cmd = w.s.buildings.find((x) => x.type === 'command')!;
    const cmdHp = cmd.hp;
    w.s.tempo = { points: 30, level: 1, stagnant: false, lastProgress: 0 };
    const t0 = w.threatTime;
    inner(w).mineBlast(3, 1, c);
    expect(b.hp).toBeCloseTo(before * (1 - m.buildingDamageMaxHpFraction), 5);
    expect(cmd.hp).toBe(cmdHp); // three cells away
    expect(w.threatTime - t0).toBe(m.threatBump!.threatSeconds);
    expect(w.s.tempo.points).toBe(0);
  });
});
