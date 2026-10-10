import { describe, expect, it } from 'vitest';
import { getCampaignWorld } from '../src/game/campaign';
import { World } from '../src/core/world';

function zonedCells(n: number): number {
  const o = getCampaignWorld(n);
  const w = new World({ seed: 7, difficulty: o.difficulty, width: o.width, height: o.height, rules: { cellElements: o.cellElements } });
  w.apply({ type: 'placeCommand', x: Math.floor(o.width / 2), y: Math.floor(o.height / 2) });
  return w.s.cells.filter((c) => c.element).length;
}

describe('campaign shift settings', () => {
  it('shift 1 has no raids and no lairs', () => {
    const o = getCampaignWorld(1);
    expect(o.raids.enabled).toBe(false);
    expect(o.lairTotal).toBe(0);
  });

  it('shift 2 raids on its own timer and still has no lairs', () => {
    const o = getCampaignWorld(2);
    expect(o.raids).toMatchObject({ enabled: true, firstAfterSeconds: 180, everySeconds: 90 });
    expect(o.lairTotal).toBe(0);
  });

  it('shift 1 uses its own enemy and start-energy factors', () => {
    expect(getCampaignWorld(1).factors).toMatchObject({ enemyHpFactor: 0.6, enemyDamageFactor: 0.6, startEnergy: 150 });
  });

  it('elemental zones follow the shift flag', () => {
    expect(zonedCells(1)).toBe(0);
    expect(zonedCells(3)).toBe(0);
    expect(zonedCells(5)).toBeGreaterThan(0);
  });

  it('shift 3 places its one lair', () => {
    expect(getCampaignWorld(3).lairTotal).toBe(1);
  });
});
