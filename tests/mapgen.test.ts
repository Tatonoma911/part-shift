import { describe, expect, it } from 'vitest';
import { config, mapgen } from '../src/core/data';
import { cheb } from '../src/core/grid';
import { World } from '../src/core/world';

function generated(seed: number, x = 7, y = 9) {
  const w = new World({ seed });
  w.apply({ type: 'placeCommand', x, y });
  return w;
}

const count = (w: World, content: string) => w.s.cells.filter((c) => c.content === content).length;
const pos = (w: World, i: number) => ({ x: i % w.s.width, y: Math.floor(i / w.s.width) });

describe('field generation (mapgen.json)', () => {
  it('uses the designer board size and site counts', () => {
    const w = generated(1);
    expect([w.s.width, w.s.height]).toEqual([14, 18]);
    expect(count(w, 'nest') + count(w, 'heavy_nest')).toBe(mapgen.counts.nest);
    expect(count(w, 'demon_hatch')).toBe(1);
    expect(count(w, 'cache')).toBe(mapgen.counts.cache);
    expect(count(w, 'survivor')).toBe(mapgen.counts.survivor);
    expect(count(w, 'energy_vein')).toBe(mapgen.counts.energy_vein);
    expect(count(w, 'rubble')).toBe(mapgen.counts.rubble);
  });

  it('keeps the rules for 100 seeds: safe radius, starter nest, demon distance, nothing next to the hatch', () => {
    for (let seed = 0; seed < 100; seed++) {
      const cx = seed % 14;
      const cy = (seed * 7) % 18;
      const w = generated(seed, cx, cy);
      const sites = w.s.cells.map((c, i) => ({ c, ...pos(w, i) })).filter(({ c }) => ['nest', 'heavy_nest', 'demon_hatch', 'cache', 'survivor'].includes(c.content));
      for (const { x, y } of sites) expect(cheb(x, y, cx, cy)).toBeGreaterThan(mapgen.safeRadius);
      const starter = sites.filter(({ c, x, y }) => c.content === 'nest' && cheb(x, y, cx, cy) >= 3 && cheb(x, y, cx, cy) <= 4);
      expect(starter.length).toBeGreaterThanOrEqual(1);
      const hatch = sites.find(({ c }) => c.content === 'demon_hatch')!;
      const farthest = Math.max(...w.s.cells.map((_, i) => cheb(pos(w, i).x, pos(w, i).y, cx, cy)));
      expect(cheb(hatch.x, hatch.y, cx, cy)).toBeGreaterThanOrEqual(Math.min(mapgen.demonMinDistance, farthest - 2));
      for (const o of sites) if (o !== hatch) expect(cheb(o.x, o.y, hatch.x, hatch.y)).toBeGreaterThan(1);
      for (const { c } of sites) expect(c.content).not.toBe('water');
      for (const c of w.s.cells) if (['nest', 'heavy_nest'].includes(c.content)) expect(c.tech).toBeTruthy();
    }
  });

  it('is deterministic for a seed', () => {
    expect(generated(42).s.cells).toEqual(generated(42).s.cells);
  });

  it('opens the 3×3 start and gives the first resident at once', () => {
    const w = generated(3);
    expect(w.s.cells.filter((c) => c.revealed).length).toBeGreaterThanOrEqual(9);
    expect(w.s.units.filter((u) => u.kind === 'resident')).toHaveLength(1);
    expect(w.player(0).energy).toBe(config.economy.startEnergy);
  });
});
