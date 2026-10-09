import type { RuleOverrides } from '../src/core/state';
import type { CellContent } from '../src/core/state';
import { World } from '../src/core/world';

/** A small hand-made field: '.' ground, '~' water, 'r' rubble, 'v' vein, 'c' cache, 's' survivor, 'n' nest, 'h' heavy nest, 'D' demon hatch. */
export function handWorld(rows: string[], seed = 1, rules?: RuleOverrides): World {
  const w = new World({ seed, width: rows[0].length, height: rows.length, rules });
  const map: Record<string, CellContent> = {
    '.': 'ground', '~': 'water', r: 'rubble', v: 'energy_vein', c: 'cache', s: 'survivor', n: 'nest', h: 'heavy_nest', D: 'demon_hatch',
  };
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const c = w.cell(x, y);
      c.content = map[ch];
      if (ch === 'r') c.stock = 30;
      if (ch === 'v') c.stock = 120;
      if (ch === 'n') c.tech = 'cryo';
      if (ch === 'h') c.tech = 'impact';
    }),
  );
  w.s.generated = true;
  return w;
}

export function run(w: World, seconds: number): void {
  for (let t = 0; t < seconds; t += 0.05) w.step(0.05);
}

export function residents(w: World, owner = 0) {
  return w.s.units.filter((u) => u.owner === owner && u.kind === 'resident');
}
