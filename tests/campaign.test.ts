import { describe, expect, it } from 'vitest';
import { getCampaignWorld } from '../src/game/campaign';

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

  it('shift 3 places its one lair', () => {
    expect(getCampaignWorld(3).lairTotal).toBe(1);
  });
});
