/**
 * Field generation for «Срочный вызов» (design/data/mapgen.json, MVP_RULES §3.2).
 * Runs after the command center(s) are placed, so the start is always safe.
 */
import { heroList, heroRules, mapgen, sites as siteDefs, type Tech } from './data';
import { cellAt, cheb, inBounds, N8 } from './grid';
import { rand, randIntOf } from './rng';
import type { CellContent, GameState } from './state';

interface Options {
  /** Command center positions (one per player). */
  commands: { x: number; y: number }[];
  /** Nest count override (multiplayer: nestsPerPlayer × players). */
  nests?: number;
  /** Multiplayer: caches, survivors, veins and rubble × this, so each player gets the same share. */
  countScale?: number;
}

const SITE_KINDS: CellContent[] = ['nest', 'heavy_nest', 'hero_lair', 'boss_hatch', 'cache', 'survivor', 'blueprint', 'armor_crate', 'lore_record', 'mine', 'bonus_capsule', 'medkit'];

export function generateField(s: GameState, opts: Options): void {
  const { commands } = opts;
  const minCmdDist = (x: number, y: number) => Math.min(...commands.map((c) => cheb(c.x, c.y, x, y)));
  const all: { x: number; y: number }[] = [];
  for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) all.push({ x, y });
  const isFree = (p: { x: number; y: number }) => cellAt(s, p.x, p.y).content === 'ground' && minCmdDist(p.x, p.y) > mapgen.safeRadius;
  const pick = (pool: { x: number; y: number }[]) => (pool.length ? pool.splice(randIntOf(s, pool.length), 1)[0] : null);
  const set = (p: { x: number; y: number } | null, content: CellContent) => {
    if (p) cellAt(s, p.x, p.y).content = content;
    return p;
  };
  const nestTech = (): Tech => {
    const pool = siteDefs.nest.techPool!;
    return pool[randIntOf(s, pool.length)];
  };

  placeWater(s, commands, minCmdDist);

  // Heroes: one lair per tier (heroes.json lairsPerMapByTier), never the call target itself
  // (chosen when the match was created, so the menu can name it).
  const boss = s.boss.hero;
  const lairHeroes: { id: string; tier: number }[] = [];
  for (const [tier, n] of Object.entries(heroRules.lairsPerMapByTier)) {
    const pool = heroList.filter((h) => h.tier === Number(tier) && h.id !== boss && !h.allyOnly);
    for (let i = 0; i < n && pool.length; i++) lairHeroes.push({ id: pool.splice(randIntOf(s, pool.length), 1)[0].id, tier: Number(tier) });
  }

  // Call target: as far as the rules ask, never next to another site.
  let far = all.filter((p) => isFree(p) && minCmdDist(p.x, p.y) >= mapgen.bossMinDistance);
  if (far.length === 0) {
    const best = Math.max(...all.filter(isFree).map((p) => minCmdDist(p.x, p.y)));
    far = all.filter((p) => isFree(p) && minCmdDist(p.x, p.y) === best);
  }
  const hatch = set(pick(far), 'boss_hatch')!;
  cellAt(s, hatch.x, hatch.y).hero = boss;
  const nearHatch = (p: { x: number; y: number }) => cheb(p.x, p.y, hatch.x, hatch.y) <= 1;
  const free = () => all.filter((p) => isFree(p) && !nearHatch(p));

  for (const l of lairHeroes) {
    let pool = free().filter((p) => minCmdDist(p.x, p.y) >= mapgen.heroLairMinDistance);
    if (pool.length === 0) pool = free();
    const p = set(pick(pool), 'hero_lair');
    if (p) Object.assign(cellAt(s, p.x, p.y), { hero: l.id, heroTier: l.tier });
  }

  // One starter nest 3–4 cells from each command center.
  const { minDistance, maxDistance } = mapgen.starterNest;
  let nestsLeft = opts.nests ?? mapgen.counts.nest;
  for (const c of commands) {
    const ring = free().filter((p) => {
      const d = cheb(c.x, c.y, p.x, p.y);
      return d >= minDistance && d <= maxDistance;
    });
    const p = set(pick(ring), 'nest');
    if (p) {
      cellAt(s, p.x, p.y).tech = nestTech();
      nestsLeft--;
    }
  }
  for (let i = 0; i < nestsLeft; i++) {
    const heavy = rand(s) < mapgen.counts.heavyNestChance;
    const p = set(pick(free()), heavy ? 'heavy_nest' : 'nest');
    if (p) cellAt(s, p.x, p.y).tech = heavy ? siteDefs.heavy_nest.tech : nestTech();
  }
  const k = opts.countScale ?? 1;
  const mc = mapgen.counts as Record<string, number | { chance: number; max: number }>;
  const counts = { cache: (mc.cache as number) * k, survivor: (mc.survivor as number) * k, energy_vein: (mc.energy_vein as number) * k, rubble: (mc.rubble as number) * k };
  for (let i = 0; i < counts.cache; i++) set(pick(free()), 'cache');
  for (let i = 0; i < counts.survivor; i++) set(pick(free()), 'survivor');
  const blueprintCount = (mc.blueprint as number | undefined) ?? 0;
  for (let i = 0; i < blueprintCount * k; i++) set(pick(free()), 'blueprint');
  const armorCount = (mc.armor_crate as number | undefined) ?? 0;
  for (let i = 0; i < armorCount * k; i++) set(pick(free()), 'armor_crate');
  const loreRule = mc.lore_record as { chance: number; max: number } | undefined;
  if (loreRule && rand(s) < loreRule.chance) set(pick(free()), 'lore_record');
  // Mines (hazards.json): an element each, counted on the «Опасно» channel like nests.
  const MINE_TECH: Tech[] = ['thermo', 'cryo', 'volt', 'toxin', 'impact'];
  for (let i = 0; i < ((mc.mine as number | undefined) ?? 0) * k; i++) {
    const p = set(pick(free()), 'mine');
    if (p) cellAt(s, p.x, p.y).tech = MINE_TECH[randIntOf(s, MINE_TECH.length)];
  }
  for (let i = 0; i < ((mc.bonus_capsule as number | undefined) ?? 0) * k; i++) set(pick(free()), 'bonus_capsule');
  for (let i = 0; i < ((mc.medkit as number | undefined) ?? 0) * k; i++) set(pick(free()), 'medkit');
  for (let i = 0; i < counts.energy_vein; i++) {
    const p = set(pick(free()), 'energy_vein');
    if (p) cellAt(s, p.x, p.y).stock = mapgen.energyVein.energy;
  }
  // Rubble may sit in the safe area too, but never on the command centers.
  const rubblePool = () => all.filter((p) => cellAt(s, p.x, p.y).content === 'ground' && minCmdDist(p.x, p.y) > 1 && !nearHatch(p));
  for (let i = 0; i < counts.rubble; i++) {
    const p = set(pick(rubblePool()), 'rubble');
    if (p) cellAt(s, p.x, p.y).stock = mapgen.rubble.energy;
  }
  s.generated = true;
}

/** Water blobs; retried until every dry cell is reachable from the first command center. */
function placeWater(s: GameState, commands: { x: number; y: number }[], minCmdDist: (x: number, y: number) => number): void {
  const target = Math.round(s.width * s.height * mapgen.water.fraction);
  const [minBlob, maxBlob] = mapgen.water.blobs;
  for (let attempt = 0; attempt < 20; attempt++) {
    for (const c of s.cells) if (c.content === 'water') c.content = 'ground';
    let placed = 0;
    let guard = 0;
    while (placed < target && guard++ < 500) {
      const size = minBlob + randIntOf(s, maxBlob - minBlob + 1);
      let x = randIntOf(s, s.width);
      let y = randIntOf(s, s.height);
      for (let i = 0; i < size && placed < target; i++) {
        if (inBounds(s, x, y) && minCmdDist(x, y) > mapgen.safeRadius && cellAt(s, x, y).content === 'ground') {
          cellAt(s, x, y).content = 'water';
          placed++;
        }
        const [dx, dy] = N8[randIntOf(s, 8)];
        x += dx;
        y += dy;
      }
    }
    if (allDryReachable(s, commands[0])) return;
  }
  for (const c of s.cells) if (c.content === 'water') c.content = 'ground';
}

function allDryReachable(s: GameState, from: { x: number; y: number }): boolean {
  const seen = new Uint8Array(s.width * s.height);
  const stack = [from];
  seen[from.y * s.width + from.x] = 1;
  let count = 1;
  while (stack.length) {
    const p = stack.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = p.x + dx;
      const ny = p.y + dy;
      if (!inBounds(s, nx, ny) || seen[ny * s.width + nx] || cellAt(s, nx, ny).content === 'water') continue;
      seen[ny * s.width + nx] = 1;
      count++;
      stack.push({ x: nx, y: ny });
    }
  }
  return count === s.cells.filter((c) => c.content !== 'water').length;
}

export function isSiteContent(c: CellContent): boolean {
  return SITE_KINDS.includes(c);
}
