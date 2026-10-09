import { describe, expect, it } from 'vitest';
import { World } from '../src/core/world';
import type { BoardConfig, SimConfig } from '../src/core/types';

const boardConfig: BoardConfig = {
  width: 9,
  height: 9,
  sites: { nest: 0, depot: 0, cache: 0, demon: 0 },
  safeRadius: 1,
  demonMinDistance: 3,
};
const sim: SimConfig = { startWorkers: 1, digSeconds: 1, walkSpeed: 2, energyPerCell: 5, energyPerCache: 40 };

function run(world: World, seconds: number, step = 0.05) {
  for (let t = 0; t < seconds; t += step) world.tick(step);
}

/** A world whose sites we place by hand after the command center is down. */
function handWorld(setup: (w: World) => void) {
  // Board with no random sites; we fill some cells covered on purpose.
  const w = new World({ ...boardConfig, width: 9, height: 1 }, sim, 1);
  setup(w);
  return w;
}

describe('World', () => {
  it('opens the start area and gives energy for it', () => {
    const w = new World({ ...boardConfig, sites: { nest: 3, depot: 0, cache: 0, demon: 0 } }, sim, 7);
    w.placeCore(4, 4);
    const opened = w.board.cells.filter((c) => c.revealed).length;
    expect(opened).toBeGreaterThanOrEqual(9);
    expect(w.energy).toBe((opened - 1) * 5); // the command center cell itself pays nothing
  });

  it('a worker walks to a queued frontier cell, digs it, and earns energy', () => {
    const w = handWorld((world) => {
      world.board.get(5, 0).site = 'nest'; // stops the start cascade at x=4
    });
    w.placeCore(0, 0);
    expect(w.board.get(4, 0).revealed).toBe(true);
    expect(w.board.get(5, 0).revealed).toBe(false);
    const before = w.energy;
    expect(w.queueDig(5, 0)).toBe(true);
    run(w, 1);
    expect(w.board.get(5, 0).revealed).toBe(false); // still walking / digging
    run(w, 3);
    expect(w.board.get(5, 0).revealed).toBe(true);
    expect(w.energy).toBeGreaterThan(before);
    const events = w.drainEvents();
    expect(events.some((e) => e.type === 'threatAwakened')).toBe(true);
  });

  it('claims a cache: bonus energy and the hint goes down', () => {
    const w = handWorld((world) => {
      world.board.get(5, 0).site = 'cache';
      world.board.get(7, 0).site = 'nest';
    });
    w.placeCore(0, 0);
    expect(w.board.hints(4, 0).cache).toBe(1);
    w.queueDig(5, 0);
    run(w, 5);
    expect(w.board.get(5, 0).resolved).toBe(true);
    expect(w.board.hints(4, 0).cache).toBe(0);
    expect(w.drainEvents().some((e) => e.type === 'cacheFound')).toBe(true);
  });

  it('cells queued beyond the frontier get dug once they become reachable', () => {
    const w = handWorld((world) => {
      world.board.get(5, 0).site = 'cache';
      world.board.get(7, 0).site = 'nest';
    });
    w.placeCore(0, 0);
    w.queueDig(6, 0); // not frontier yet
    w.queueDig(5, 0);
    run(w, 10);
    expect(w.board.get(6, 0).revealed).toBe(true);
  });

  it('workers never walk through an awakened threat', () => {
    const w = handWorld((world) => {
      world.board.get(5, 0).site = 'nest';
      world.board.get(7, 0).site = 'nest';
    });
    w.placeCore(0, 0);
    w.queueDig(5, 0);
    run(w, 5);
    expect(w.board.isWalkable(5, 0)).toBe(false);
    w.queueDig(6, 0);
    run(w, 10);
    expect(w.board.get(6, 0).revealed).toBe(false); // the only way there is through the nest
  });

  it('marked cells cannot be queued', () => {
    const w = new World({ ...boardConfig, sites: { nest: 6, depot: 0, cache: 0, demon: 0 } }, sim, 3);
    w.placeCore(4, 4);
    const covered = w.board.cells.find((c) => !c.revealed)!;
    w.toggleMark(covered.x, covered.y);
    expect(w.queueDig(covered.x, covered.y)).toBe(false);
  });
});

describe('Commands', () => {
  it('apply() drives the same actions and rejects invalid ones', () => {
    const w = new World({ ...boardConfig, sites: { nest: 6, depot: 0, cache: 0, demon: 0 } }, sim, 5);
    expect(w.apply({ type: 'queueDig', x: 0, y: 0 })).toBe(false); // nothing placed yet
    expect(w.apply({ type: 'placeCore', x: 4, y: 4 })).toBe(true);
    expect(w.apply({ type: 'placeCore', x: 1, y: 1 })).toBe(false);
    const covered = w.board.cells.find((c) => !c.revealed)!;
    expect(w.apply({ type: 'queueDig', x: covered.x, y: covered.y })).toBe(true);
    expect(w.apply({ type: 'cancelDig', x: covered.x, y: covered.y })).toBe(true);
    expect(w.isQueued(covered.x, covered.y)).toBe(false);
    expect(w.apply({ type: 'toggleMark', x: covered.x, y: covered.y })).toBe(true);
    expect(w.board.get(covered.x, covered.y).marked).toBe(true);
  });
});
