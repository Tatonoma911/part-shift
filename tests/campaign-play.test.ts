import { describe, expect, it } from 'vitest';
import { World } from '../src/core/world';
import { getCampaignWorld } from '../src/game/campaign';

// Plays shift 1 the way GameScene builds it: the same campaign counts and factors.
// A command is placed, digs are queued over the map, and every living nest gets an
// attack order (the same tap the player makes). Time runs until the world reports an outcome.
describe('shift 1 played for real', () => {
  it('ends in victory by destroying nests, with the stats earned during play', () => {
    const o = getCampaignWorld(1);
    const w = new World({
      seed: 7,
      width: o.width,
      height: o.height,
      difficulty: o.difficulty,
      rules: {
        counts: { nests: o.nestCount, mine: o.mineCount, bossHatch: o.bossHatchCount, lairTotal: o.lairTotal, bonusCapsule: o.bonusCapsuleCount, medkit: o.medkitCount, survivor: o.survivorCount },
        raids: o.raids,
        difficulty: o.factors,
        cellElements: o.cellElements,
      },
    });
    expect(w.apply({ type: 'placeCommand', x: Math.floor(o.width / 2), y: Math.floor(o.height / 2) }).ok).toBe(true);
    const p = w.s.players[0];
    for (let y = 0; y < o.height; y++) for (let x = 0; x < o.width; x++) w.apply({ type: 'queueDig', x, y, force: true }, p.id);
    for (let i = 0; i < 20 * 900 && w.s.outcome === 'playing'; i++) {
      if (i % 40 === 0) {
        for (const s of w.s.sites) if ((s.kind === 'nest' || s.kind === 'heavy_nest') && !s.destroyed) w.apply({ type: 'attack', target: `s:${s.x},${s.y}` }, p.id);
      }
      w.tick(0.05);
    }
    const nestsDown = w.s.sites.filter((s) => (s.kind === 'nest' || s.kind === 'heavy_nest') && s.destroyed).length;
    const nestsAll = w.s.sites.filter((s) => (s.kind === 'nest' || s.kind === 'heavy_nest')).length;
    expect(w.s.outcome).toBe('victory');
    expect(nestsDown).toBe(nestsAll);
    expect(w.s.time).toBeGreaterThan(0);
    expect(p.stats.nests).toBe(nestsDown);
  }, 120000);
});
