import { describe, expect, it } from 'vitest';
import { config, mapgen } from '../src/core/data';
import { handWorld, residents, run } from './helpers';

describe('digging', () => {
  it('a resident walks to a queued frontier cell, digs 9 s, and the energy orb flies home', () => {
    const w = handWorld(['.....n.', '.......', '.......']);
    w.apply({ type: 'placeCommand', x: 0, y: 1 });
    // Start opens x 0..1; queue x=2 row 1.
    expect(w.apply({ type: 'queueDig', x: 2, y: 1 }).ok).toBe(true);
    const e0 = w.player(0).energy;
    run(w, config.dig.digSeconds - 1);
    expect(w.cell(2, 1).revealed).toBe(false);
    run(w, 3);
    expect(w.cell(2, 1).revealed).toBe(true);
    run(w, 2);
    expect(w.player(0).energy).toBeGreaterThan(e0);
  });

  it('a quiet cell auto-queues its covered neighbors; the player queue goes first', () => {
    const w = handWorld(['.......', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 0, y: 0 });
    expect(w.player(0).autoQueue.length).toBeGreaterThan(0);
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

  it('cache gives energy at once, survivor adds a resident and a permanent slot', () => {
    const w = handWorld(['..cs...', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 0, y: 1 });
    const e0 = w.player(0).energy;
    w.apply({ type: 'queueDig', x: 2, y: 0 });
    run(w, 12);
    expect(w.player(0).energy).toBeGreaterThanOrEqual(e0 + 60);
    w.apply({ type: 'queueDig', x: 3, y: 0 });
    run(w, 25);
    const cmd = w.building(w.player(0).command)!;
    expect(cmd.slots.length).toBe(3);
    expect(residents(w).length).toBeGreaterThanOrEqual(2);
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
  it('the command center fills its second slot after 20 s', () => {
    const w = handWorld(['.......', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 0, y: 0 });
    expect(residents(w)).toHaveLength(1);
    run(w, config.population.spawnSeconds + 0.5);
    expect(residents(w)).toHaveLength(2);
  });

  it('builds a home: pays, a resident builds it, then it births a resident', () => {
    const w = handWorld(['.......', '.......', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 1, y: 1 });
    expect(w.apply({ type: 'build', building: 'home', x: 2, y: 2 }).ok).toBe(true);
    expect(w.player(0).energy).toBe(10);
    run(w, 8);
    const home = w.s.buildings.find((b) => b.type === 'home')!;
    expect(home.complete).toBe(true);
    run(w, config.population.spawnSeconds + 1);
    expect(residents(w).some((r) => r.home === home.id)).toBe(true);
  });

  it('refuses with a reason: no energy, outside territory, occupied, not opened', () => {
    const w = handWorld(['..........', '..........', '..........', '..........', '.........n']);
    w.apply({ type: 'placeCommand', x: 1, y: 1 });
    expect(w.apply({ type: 'build', building: 'school', x: 2, y: 2 })).toEqual({ ok: false, reason: 'build.not_enough_energy' });
    expect(w.apply({ type: 'build', building: 'home', x: 1, y: 1 })).toEqual({ ok: false, reason: 'build.cell_occupied' });
    expect(w.apply({ type: 'build', building: 'home', x: 8, y: 1 })).toEqual({ ok: false, reason: 'build.invalid_cell' });
    w.apply({ type: 'build', building: 'home', x: 2, y: 2 });
    w.player(0).energy = 999;
    expect(w.apply({ type: 'build', building: 'home', x: 2, y: 2 })).toEqual({ ok: false, reason: 'build.cell_occupied' });
  });

  it('a reactor with an operator makes energy, twice as fast next to a cooler', () => {
    const make = (cooler: boolean) => {
      const w = handWorld(['.......', '.......', '.......', '......n']);
      for (const c of w.s.cells) c.revealed = c.content === 'ground'; // nothing to dig: only the reactor pays
      w.apply({ type: 'placeCommand', x: 1, y: 1 });
      w.player(0).energy = 1000;
      w.apply({ type: 'build', building: 'reactor', x: 0, y: 0 });
      if (cooler) w.apply({ type: 'build', building: 'cooler', x: 0, y: 1 });
      run(w, 40); // build both, operator walks in
      const e = w.player(0).energy;
      run(w, 20);
      return w.player(0).energy - e;
    };
    const plain = make(false);
    const cooled = make(true);
    expect(plain).toBeGreaterThanOrEqual(3); // 1 per 5 s
    expect(plain).toBeLessThanOrEqual(5);
    expect(cooled).toBeGreaterThanOrEqual(7); // 1 per 2.5 s
  });

  it('a school trains a free resident into a defender for 10 energy and frees the dwelling slot', () => {
    const w = handWorld(['.......', '.......', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 1, y: 1 });
    w.player(0).energy = 110;
    w.apply({ type: 'build', building: 'school', x: 2, y: 2 });
    run(w, 12);
    expect(w.defenderCapacity(0)).toBe(5);
    run(w, config.defenders.trainSeconds + 3);
    const d = w.s.units.find((u) => u.kind === 'defender')!;
    expect(d).toBeTruthy();
    expect(d.hp).toBe(48);
    expect(w.player(0).energy).toBe(0);
    const cmd = w.building(w.player(0).command)!;
    expect(cmd.slots.some((s) => s.unit === null)).toBe(true);
  });
});
