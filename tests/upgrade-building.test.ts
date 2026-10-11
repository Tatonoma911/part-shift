import { describe, expect, it } from 'vitest';
import { buildings as buildingDefs, upgradeRules } from '../src/core/data';
import { handWorld } from './helpers';
import type { World } from '../src/core/world';

type Inner = {
  addBuilding(owner: number, type: string, x: number, y: number, complete: boolean): { id: number; hp: number };
};
const inner = (w: World) => w as unknown as Inner;

/** A finished reactor at (2,0); the player has energy. */
function world() {
  const w = handWorld(['.......', '.......', '......n']);
  w.apply({ type: 'placeCommand', x: 0, y: 1 });
  const bld = inner(w).addBuilding(0, 'reactor', 2, 0, true);
  w.s.players[0].energy = 1000;
  return { w, bld };
}

const run = (w: World, seconds: number) => {
  for (let t = 0; t < seconds; t += 0.05) w.step(0.05);
};

describe('building upgrade (buildings.json upgrades)', () => {
  it('charges the level-2 price, the building works on while upgrading, then takes level 2', () => {
    const { w, bld } = world();
    const rule = upgradeRules.perBuilding.reactor.levels!['2'];
    const before = w.s.players[0].energy;
    expect(w.apply({ type: 'upgradeBuilding', building: bld.id }).ok).toBe(true);
    const cost = rule.cost ?? Math.round(buildingDefs.reactor.cost * upgradeRules.defaultCostFactorByLevel['2']);
    expect(w.s.players[0].energy).toBe(before - cost);
    const b = w.s.buildings.find((x) => x.id === bld.id)!;
    expect(b.upgradeLeft).toBeGreaterThan(0);
    expect(b.level ?? 1).toBe(1);
    expect(w.apply({ type: 'upgradeBuilding', building: bld.id }).ok).toBe(false);
    run(w, (rule.seconds ?? buildingDefs.reactor.buildSeconds) + 1);
    expect(b.level).toBe(2);
    expect(b.upgradeLeft).toBeUndefined();
  });

  it('refuses without the energy, and an upgrade to level 3 needs a level-2 Command Center', () => {
    const { w, bld } = world();
    w.s.players[0].energy = 0;
    expect(w.apply({ type: 'upgradeBuilding', building: bld.id }).ok).toBe(false);
    const b = w.s.buildings.find((x) => x.id === bld.id)!;
    b.level = 2;
    w.s.players[0].energy = 1000;
    expect(w.apply({ type: 'upgradeBuilding', building: bld.id })).toEqual({ ok: false, reason: 'building.upgrade.needs_command_2' });
  });
});
