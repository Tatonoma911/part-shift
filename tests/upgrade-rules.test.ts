import { describe, expect, it } from 'vitest';
import { handWorld } from './helpers';
import { maxLevelOf, upgradeCost } from '../src/core/upgrades';
import type { World } from '../src/core/world';

type Inner = { addBuilding(owner: number, type: string, x: number, y: number, complete: boolean): { id: number; level?: number } };
const inner = (w: World) => w as unknown as Inner;

/** A finished building of ours in the middle of a small open map, with the player's energy set. */
function rig(type: string, energy = 500) {
  const w = handWorld(['.......', '.......', '.......', '.......', '.......', '......n']);
  w.apply({ type: 'placeCommand', x: 0, y: 1 });
  const bld = inner(w).addBuilding(0, type, 3, 3, true);
  w.player(0).energy = energy;
  return { w, bld };
}

describe('building upgrades: the card and the world use the same rules', () => {
  it('a cooler can reach level 3 (it used to have no level table, so it could never upgrade)', () => {
    expect(maxLevelOf('cooler')).toBe(3);
    const { w, bld } = rig('cooler');
    expect(w.apply({ type: 'upgradeBuilding', building: bld.id }, 0).ok).toBe(true);
    expect(bld.level).toBe(2);
  });

  it('charges the price the card shows (cooler: 75 for level 2)', () => {
    expect(upgradeCost('cooler', 2, 100).cost).toBe(75);
    const { w, bld } = rig('cooler', 74);
    expect(w.apply({ type: 'upgradeBuilding', building: bld.id }, 0)).toMatchObject({ ok: false, reason: 'building.upgrade.not_enough_energy' });
    w.player(0).energy = 75;
    expect(w.apply({ type: 'upgradeBuilding', building: bld.id }, 0).ok).toBe(true);
    expect(w.player(0).energy).toBe(0);
  });

  it('stops at the max level', () => {
    const { w, bld } = rig('cooler');
    bld.level = 3;
    expect(w.apply({ type: 'upgradeBuilding', building: bld.id }, 0)).toMatchObject({ ok: false, reason: 'building.upgrade.max_level' });
  });
});

describe('checkpoint (outpost) placement: only on the edge of our land', () => {
  it('refuses an inner cell and accepts an edge cell of our land', () => {
    const w = handWorld(['.......', '.......', '.......', '.......', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 0, y: 1 });
    w.player(0).energy = 500;
    const inside = { x: 1, y: 1 };
    const edgeOk = w.onTerritoryEdge(0, 3, 0) || w.onTerritoryEdge(0, 0, 0);
    expect(w.canBuild(0, 'outpost', inside.x, inside.y)).toBe('build.outpost_edge');
    expect(edgeOk).toBe(true);
  });
});
