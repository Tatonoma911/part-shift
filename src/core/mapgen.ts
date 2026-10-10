/**
 * Field generation for «Срочный вызов» (design/data/mapgen.json, MVP_RULES §3.2).
 * Runs after the command center(s) are placed, so the start is always safe.
 */
import { byDifficulty, hazards, heroList, heroRules, mapgen, sites as siteDefs, TECHS, type Tech } from './data';
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
  /** Mine / survivor-site count override (campaign shifts, quick mode), before countScale and the co-op factor. */
  mines?: number;
  survivors?: number;
  /** 0 = never place boss_hatch (shifts without callTarget feature). Undefined = place 1. */
  bossHatch?: number;
  /** Cap on total hero lairs (campaign overrides heroes.json lairsPerMapByTier); undefined = use defaults. */
  lairTotal?: number;
  /** bonus_capsule count override; undefined = hazards.json default. */
  bonusCapsule?: number;
  /** medkit count override; undefined = hazards.json default. */
  medkit?: number;
  /** false: no elemental zones (campaign shifts without features.cellElements). */
  cellElements?: boolean;
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

  // Heroes: one lair per tier (heroes.json lairsPerMapByTier), never the call target itself.
  // lairTotal caps the total count (campaign shifts that have features.lairs=false → 0).
  const boss = s.boss.hero;
  const lairHeroes: { id: string; tier: number }[] = [];
  for (const [tier, n] of Object.entries(heroRules.lairsPerMapByTier)) {
    const pool = heroList.filter((h) => h.tier === Number(tier) && h.id !== boss && !h.allyOnly);
    for (let i = 0; i < n && pool.length; i++) lairHeroes.push({ id: pool.splice(randIntOf(s, pool.length), 1)[0].id, tier: Number(tier) });
  }
  if (opts.lairTotal !== undefined) lairHeroes.splice(opts.lairTotal);

  // Call target: as far as the rules ask, never next to another site.
  // bossHatch=0 → skip placement (shifts without callTarget feature).
  let far = all.filter((p) => isFree(p) && minCmdDist(p.x, p.y) >= mapgen.bossMinDistance);
  if (far.length === 0) {
    const best = Math.max(...all.filter(isFree).map((p) => minCmdDist(p.x, p.y)));
    far = all.filter((p) => isFree(p) && minCmdDist(p.x, p.y) === best);
  }
  let hatchPos: { x: number; y: number } | null = null;
  if ((opts.bossHatch ?? 1) > 0) {
    hatchPos = set(pick(far), 'boss_hatch');
    if (hatchPos) cellAt(s, hatchPos.x, hatchPos.y).hero = boss;
  }
  const nearHatch = (p: { x: number; y: number }) => hatchPos ? cheb(p.x, p.y, hatchPos.x, hatchPos.y) <= 1 : false;
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
  const mc = mapgen.counts as unknown as Record<string, number | { chance: number; max: number }>;
  const counts = { cache: (mc.cache as number) * k, survivor: (opts.survivors ?? (mc.survivor as number)) * k, energy_vein: (mc.energy_vein as number) * k, rubble: (mc.rubble as number) * k };
  for (let i = 0; i < counts.cache; i++) set(pick(free()), 'cache');
  for (let i = 0; i < counts.survivor; i++) set(pick(free()), 'survivor');
  const blueprintCount = (mc.blueprint as number | undefined) ?? 0;
  for (let i = 0; i < blueprintCount * k; i++) set(pick(free()), 'blueprint');
  const armorCount = (mc.armor_crate as number | undefined) ?? 0;
  for (let i = 0; i < armorCount * k; i++) set(pick(free()), 'armor_crate');
  const loreRule = mc.lore_record as { chance: number; max: number } | undefined;
  if (loreRule && rand(s) < loreRule.chance) set(pick(free()), 'lore_record');
  // Mines (hazards.json, MVP_RULES §5.2): counted on the «Опасно» channel like nests, never inside the safe radius.
  // v0.2: Стажёр 8, Смена 14, Аврал 20 (quick mode and campaign shifts pass `mines`).
  const mines = (opts.mines ?? byDifficulty(hazards.mine.countByDifficulty, s.difficulty) ?? 0) * (k > 1 ? hazards.mine.coopFactor : 1);
  for (let i = 0; i < mines; i++) {
    const p = set(pick(free()), 'mine');
    // Any element until cell zones (mapgen.cellElements) exist; then the zone's element.
    if (p) cellAt(s, p.x, p.y).tech = TECHS[randIntOf(s, TECHS.length)];
  }
  const capsuleCount = opts.bonusCapsule ?? hazards.bonusCapsule.count;
  const medkitCount = opts.medkit ?? hazards.medkit.count;
  for (let i = 0; i < capsuleCount * k; i++) set(pick(free()), 'bonus_capsule');
  for (let i = 0; i < medkitCount * k; i++) set(pick(free()), 'medkit');
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

  // Elemental zones: Voronoi partition of non-water cells outside the safe radius (mapgen.cellElements).
  if (opts.cellElements !== false) assignCellZones(s, commands, minCmdDist);
  // Nests and mines inside a zone inherit that zone's element.
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      const c = cellAt(s, x, y);
      if (c.element && (c.content === 'nest' || c.content === 'heavy_nest' || c.content === 'mine')) {
        c.tech = c.element;
      }
    }
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

/**
 * Voronoi elemental zones on non-water cells outside the safe radius (mapgen.cellElements).
 * Seeds are random; one smoothing pass merges isolated cells with their majority neighbour.
 */
function assignCellZones(s: GameState, _commands: { x: number; y: number }[], minCmdDist: (x: number, y: number) => number): void {
  const zoneCfg = (mapgen as unknown as { cellElements: { zones: { count: [number, number] }; elements: Tech[]; maxSameElementZones: number; safeRadiusNeutral: boolean } }).cellElements;
  if (!zoneCfg) return;

  const [minCount, maxCount] = zoneCfg.zones.count;
  const count = minCount + randIntOf(s, maxCount - minCount + 1);
  const techs = zoneCfg.elements as Tech[];
  const maxSame = zoneCfg.maxSameElementZones;

  // Collect eligible seed positions outside safe radius, not water
  const eligible: { x: number; y: number }[] = [];
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      if (cellAt(s, x, y).content !== 'water' && minCmdDist(x, y) > mapgen.safeRadius) eligible.push({ x, y });
    }
  }

  // Pick seeds; cap same-element count at maxSame
  const seeds: { x: number; y: number; tech: Tech }[] = [];
  const techCounts: Record<string, number> = {};
  const pool = [...eligible];
  for (let i = 0; i < count && pool.length; i++) {
    const pos = pool.splice(randIntOf(s, pool.length), 1)[0];
    // Find a tech not yet at the cap; fall back to any if exhausted
    let tech = techs[randIntOf(s, techs.length)];
    for (let attempt = 0; attempt < techs.length * 2; attempt++) {
      if ((techCounts[tech] ?? 0) < maxSame) break;
      tech = techs[randIntOf(s, techs.length)];
    }
    techCounts[tech] = (techCounts[tech] ?? 0) + 1;
    seeds.push({ ...pos, tech });
  }
  if (!seeds.length) return;

  // Assign each eligible cell to its nearest seed (Chebyshev)
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      const c = cellAt(s, x, y);
      if (c.content === 'water') continue;
      if (zoneCfg.safeRadiusNeutral && minCmdDist(x, y) <= mapgen.safeRadius) continue;
      let best = Infinity;
      let chosen = seeds[0].tech;
      for (const seed of seeds) {
        const d = cheb(x, y, seed.x, seed.y);
        if (d < best) { best = d; chosen = seed.tech; }
      }
      c.element = chosen;
    }
  }

  // One smoothing pass: a cell switches to the majority of its 8 neighbours when ≥5 agree
  const snap = s.cells.map((c) => c.element);
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      const c = cellAt(s, x, y);
      if (!c.element) continue;
      const counts: Record<string, number> = {};
      for (const [dx, dy] of N8) {
        const nx = x + dx, ny = y + dy;
        if (!inBounds(s, nx, ny)) continue;
        const el = snap[ny * s.width + nx];
        if (el) counts[el] = (counts[el] ?? 0) + 1;
      }
      const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (best && best[1] >= 5) c.element = best[0] as Tech;
    }
  }
}
