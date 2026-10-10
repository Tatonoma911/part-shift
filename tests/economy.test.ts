import { describe, expect, it } from 'vitest';
import { config, mapgen } from '../src/core/data';
import { handWorld, residents, run } from './helpers';

describe('digging', () => {
  it('a resident walks to a queued frontier cell, digs 9 s, and the energy orb flies home', () => {
    const w = handWorld(['.....n.', '.......', '.......']);
    w.apply({ type: 'placeCommand', x: 0, y: 1 });
    // Start opens x 0..1; queue x=2 row 1.
    expect(w.apply({ type: 'queueDig', x: 2, y: 1 }).ok).toBe(true);
    w.s.units = w.s.units.slice(0, 1);
    const e0 = w.player(0).energy;
    run(w, config.dig.digSeconds - 1);
    expect(w.cell(2, 1).revealed).toBe(false);
    run(w, 3);
    expect(w.cell(2, 1).revealed).toBe(true);
    run(w, 2);
    expect(w.player(0).energy).toBeGreaterThan(e0);
  });

  it('several residents on one cell dig faster together: 9 / (1 + 0.75 × (n − 1))', () => {
    const w = handWorld(['.....n.', '.......', '.......']);
    w.apply({ type: 'placeCommand', x: 0, y: 1 });
    const first = w.s.units[0];
    w.s.units = [first, { ...first, id: 900, path: [], task: { type: 'idle' } }, { ...first, id: 901, path: [], task: { type: 'idle' } }];
    w.apply({ type: 'queueDig', x: 2, y: 1 });
    run(w, 1);
    expect(w.s.units.filter((u) => u.task.type === 'dig').length).toBe(3);
    // Three diggers: 9 / 2.5 = 3.6 s of digging after the walk.
    run(w, 4.5);
    expect(w.cell(2, 1).revealed).toBe(true);
  });

  it('with the tutorial rule on, a quiet cell opens its covered neighbors and keeps no open block queued', () => {
    const w = handWorld(['.......', '.......', '......n'], 1, { config: { 'dig.autoQueueZeroNeighbors': true } });
    w.apply({ type: 'placeCommand', x: 0, y: 0 });
    expect(w.cell(1, 1).revealed).toBe(true);
    expect(w.player(0).autoQueue.every((k) => !w.cell(...(k.split(',').map(Number) as [number, number])).revealed)).toBe(true);
  });

  it('marked cells cannot be queued and are left by the auto queue', () => {
    const w = handWorld(['.......', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 0, y: 0 });
    w.apply({ type: 'toggleMark', x: 2, y: 0 });
    expect(w.isQueued(0, 2, 0)).toBe(false);
    expect(w.apply({ type: 'queueDig', x: 2, y: 0 }).ok).toBe(false);
  });

  it('clues count three channels over 8 neighbors and drop when a find is taken', () => {
    const w = handWorld(['n.c', '...', 'sD.']);
    expect(w.clues(1, 1)).toEqual({ threat: 1, demon: 1, finds: 2 });
    w.cell(2, 0).resolved = true;
    expect(w.clues(1, 1).finds).toBe(1);
  });

  it('cache gives energy at once, survivor adds a resident and a permanent place', () => {
    const w = handWorld(['..cs...', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 0, y: 1 });
    const e0 = w.player(0).energy;
    w.apply({ type: 'queueDig', x: 2, y: 0 });
    run(w, 12);
    expect(w.player(0).energy).toBeGreaterThanOrEqual(e0 + 60);
    w.apply({ type: 'queueDig', x: 3, y: 0 });
    run(w, 25);
    expect(w.player(0).capBonus).toBe(1);
    expect(w.residentCap(0)).toBe(config.population.cap + 1);
    expect(residents(w).length).toBeGreaterThanOrEqual(3);
  });

  it('rubble is cleared for energy when the player marks it', () => {
    const w = handWorld(['.r.....', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 0, y: 1 });
    expect(w.cell(1, 0).revealed).toBe(true);
    const e0 = w.player(0).energy;
    expect(w.apply({ type: 'queueDig', x: 1, y: 0 }).ok).toBe(true);
    run(w, mapgen.rubble.workSeconds + 4);
    expect(w.cell(1, 0).content).toBe('ground');
    expect(w.player(0).energy).toBeGreaterThanOrEqual(e0 + 30);
  });
});

describe('population and buildings', () => {
  it('starts with two residents and adds one every spawnSeconds up to the cap', () => {
    const w = handWorld(['.......', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 0, y: 0 });
    expect(residents(w)).toHaveLength(config.population.initialResidents);
    run(w, config.population.spawnSeconds + 0.5);
    expect(residents(w)).toHaveLength(config.population.initialResidents + 1);
    run(w, config.population.spawnSeconds * 20);
    expect(residents(w)).toHaveLength(config.population.cap);
  });

  it('builds a home: pays, a resident builds it, then new residents appear at it near the digging', () => {
    const w = handWorld(['..........', '..........', '..........', '..........', '.........n']);
    for (const c of w.s.cells) c.revealed = c.content === 'ground';
    w.apply({ type: 'placeCommand', x: 1, y: 1 });
    expect(w.apply({ type: 'build', building: 'home', x: 3, y: 3 }).ok).toBe(true);
    expect(w.player(0).energy).toBe(w.cfg.economy.startEnergy - 40);
    run(w, 9);
    const home = w.s.buildings.find((b) => b.type === 'home')!;
    expect(home.complete).toBe(true);
    w.cell(9, 3).revealed = false;
    w.apply({ type: 'queueDig', x: 9, y: 3 });
    w.drainEvents();
    const ev: { type: string; x?: number }[] = [];
    for (let t = 0; t < config.population.spawnSeconds + 1; t += 0.05) {
      w.step(0.05);
      ev.push(...w.drainEvents());
    }
    expect(ev.find((e) => e.type === 'ally_join' || e.type === 'resident_born')?.x).toBe(3);
  });

  it('refuses with a reason: no energy, outside territory, occupied, not opened', () => {
    const w = handWorld(['..........', '..........', '..........', '..........', '.........n']);
    w.apply({ type: 'placeCommand', x: 1, y: 1 });
    w.player(0).energy = 50;
    expect(w.apply({ type: 'build', building: 'school', x: 2, y: 2 })).toEqual({ ok: false, reason: 'build.not_enough_energy' });
    expect(w.apply({ type: 'build', building: 'home', x: 1, y: 1 })).toEqual({ ok: false, reason: 'build.cell_occupied' });
    expect(w.apply({ type: 'build', building: 'home', x: 8, y: 1 })).toEqual({ ok: false, reason: 'build.invalid_cell' });
    w.apply({ type: 'build', building: 'home', x: 2, y: 2 });
    w.player(0).energy = 999;
    expect(w.apply({ type: 'build', building: 'home', x: 2, y: 2 })).toEqual({ ok: false, reason: 'build.cell_occupied' });
  });

  it('a reactor makes energy by itself, twice as fast next to a cooler', () => {
    const make = (cooler: boolean) => {
      const w = handWorld(['.......', '.......', '.......', '......n']);
      for (const c of w.s.cells) c.revealed = c.content === 'ground'; // nothing to dig: only the reactor pays
      w.apply({ type: 'placeCommand', x: 1, y: 1 });
      w.player(0).energy = 1000;
      w.apply({ type: 'build', building: 'reactor', x: 0, y: 0 });
      if (cooler) w.apply({ type: 'build', building: 'cooler', x: 0, y: 1 });
      run(w, 30); // build both
      const e = w.player(0).energy;
      run(w, 30);
      return w.player(0).energy - e;
    };
    const plain = make(false);
    const cooled = make(true);
    expect(plain).toBeGreaterThanOrEqual(9); // 1 per 3 s
    expect(plain).toBeLessThanOrEqual(11);
    expect(cooled).toBeGreaterThanOrEqual(19); // 1 per 1.5 s
  });

  it('each school raises the training level of every resident', () => {
    const w = handWorld(['.......', '.......', '.......', '......n']);
    for (const c of w.s.cells) c.revealed = c.content === 'ground';
    w.apply({ type: 'placeCommand', x: 1, y: 1 });
    const r = residents(w)[0];
    const hp0 = w.stats(r).hp;
    w.player(0).energy = 1000;
    w.apply({ type: 'build', building: 'school', x: 2, y: 2 });
    run(w, 14);
    expect(w.trainingLevel(0)).toBe(1);
    expect(w.stats(r).hp).toBe(hp0 + config.school.perLevel.hp);
    expect(w.stats(r).damage).toBe(6 + config.school.perLevel.damage);
  });
});

describe('free play digging', () => {
  it('nothing is queued for the player by default (no pre-selected cells)', () => {
    const w = handWorld(['.......', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 0, y: 0 });
    expect(w.player(0).autoQueue.length).toBe(0);
  });
});
