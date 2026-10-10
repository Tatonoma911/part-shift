import heroesJson from '../../data/design/heroes.json';
import metaJson from '../../data/design/meta.json';

/**
 * Read side of the meta progress (design/META.md §1, data/meta.json) for the
 * meta screens: ranks, hero states and unlock progress, ally slots. Writing the
 * counters during a run is the engine's job; this file only reads
 * `partshift.meta.v1` and has `pickAllies` for the ally screen.
 */
export interface MetaSave {
  version: number;
  stats: Record<string, number>;
  unlocked: string[];
  seenHeroes: string[];
  allyChoice: string[];
  /** Last squad picked on «Сводка смены» (MVP_RULES §4.5), offered again next time. */
  lastSquad?: string[];
  records: Record<string, { bestSeconds?: number; bestScore?: number; bestEnergy?: number }>;
  daily?: { date: string; bestScore: number; streak: number };
  tutorialDone?: boolean;
  /** Blueprint fragments collected across runs; key = blueprint site id (future: building ids). */
  blueprintFragments?: Record<string, number>;
  /** Lore record ids collected across runs. */
  loreRecords?: string[];
  /** Fragments for buildings/heroes (MVP_RULES §5.1): key = `building.<id>` or `hero.<id>`. */
  fragments?: Record<string, number>;
  /** Control record ids found in order (Досье → «Архив»). */
  archive?: string[];
}

export interface Rank {
  id: string;
  from: number;
  unlocksBoons: string[];
}

interface Unlock {
  type: 'starter' | 'tutorial_complete' | 'lifetime_stat' | 'run_stat' | 'defeat_hero' | 'run_challenge' | 'unlock_all';
  stat?: string;
  hero?: string;
  challenge?: string;
  count?: number;
}

export interface HeroInfo {
  id: string;
  tech: string;
  tier: number;
  unlock: Unlock;
  enemy?: { resist?: Record<string, number>; ability?: { id: string } };
  drops?: { slot: string; id: string; damage?: number; hp?: number; speed?: number; defense?: number }[];
}

const KEY = 'partshift.meta.v1';
export const HEROES = (heroesJson as unknown as { heroes: HeroInfo[] }).heroes;
export const RANKS = (metaJson as unknown as { ranks: { list: Rank[] } }).ranks.list;
const SLOTS = (heroesJson as unknown as { allySlots: { unlockedHeroes: number; slots: number }[] }).allySlots;
interface OurSide {
  starterRoster?: string[];
  squad?: {
    enemyRoll: { lairs: { tier: number }[]; callTarget: { tiers: number[] } };
    slotsByUnlocked: { unlocked: number; slots: number }[];
    maxHighTierInSquad: { tiers: number[]; max: number };
  };
  backup?: {
    states: { draft: { maxInSquad: number; hpFactor: number; damageFactor: number } };
    sync: { levels: number[]; factorsByLevel: { hp: number; damage: number }[] };
  };
}
const OUR = ((heroesJson as unknown as { ourSide?: OurSide }).ourSide ?? {}) as OurSide;
/** Heroes every player has from the first shift (v0.7). */
export const STARTERS = OUR.starterRoster ?? [];

/** Heroes whose lines use feminine forms (text/ru.json *_female keys). */
export const FEMALE = new Set(['seraph', 'frostline', 'beacon', 'canopy']);

export function emptyMeta(): MetaSave {
  return { version: 1, stats: {}, unlocked: [], seenHeroes: [], allyChoice: [...STARTERS], records: {}, blueprintFragments: {}, loreRecords: [] };
}

export function loadMeta(): MetaSave {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (raw && typeof raw === 'object') return { ...emptyMeta(), ...raw, stats: { ...(raw.stats ?? {}) } };
  } catch {
    /* fresh */
  }
  return emptyMeta();
}

export function saveMeta(m: MetaSave): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* private mode */
  }
}

export function stat(m: MetaSave, key: string): number {
  return m.stats[key] ?? 0;
}

/** Rank for a total score and the next one (undefined at the top). */
export function rankAt(score: number): { rank: Rank; index: number; next?: Rank } {
  let index = 0;
  RANKS.forEach((r, i) => {
    if (score >= r.from) index = i;
  });
  return { rank: RANKS[index], index, next: RANKS[index + 1] };
}

/** 0..1 inside the current rank band. */
export function rankFraction(score: number): number {
  const { rank, next } = rankAt(score);
  if (!next) return 1;
  return Math.min(1, (score - rank.from) / (next.from - rank.from));
}

export type HeroState = 'unknown' | 'seen' | 'unlocked';

export function heroState(m: MetaSave, id: string): HeroState {
  if (m.unlocked.includes(id) || STARTERS.includes(id)) return 'unlocked';
  if (m.seenHeroes.includes(id) || stat(m, `hero_seen.${id}`) > 0) return 'seen';
  return 'unknown';
}

/** Unlock progress as have/need (challenges are 0/1), plus the stat label key for lifetime counters. */
export function heroProgress(m: MetaSave, h: HeroInfo): { have: number; need: number; frac: number } {
  const u = h.unlock;
  let have = 0;
  let need = u.count ?? 1;
  switch (u.type) {
    case 'starter':
      have = 1;
      break;
    case 'tutorial_complete':
      have = m.tutorialDone ? 1 : 0;
      break;
    case 'lifetime_stat':
      have = stat(m, u.stat!);
      break;
    case 'run_stat':
      have = stat(m, `best_run_${u.stat!.replace(/_earned$/, '')}`) || stat(m, 'best_run_energy');
      break;
    case 'defeat_hero':
      have = stat(m, `hero_defeats.${u.hero}`);
      break;
    case 'run_challenge':
      have = stat(m, `challenge.${u.challenge}`) > 0 ? 1 : 0;
      break;
    case 'unlock_all':
      need = HEROES.length - 1;
      have = m.unlocked.filter((id) => id !== h.id).length;
      break;
  }
  if (m.unlocked.includes(h.id)) have = need;
  return { have: Math.min(have, need), need, frac: need ? Math.min(1, have / need) : 0 };
}

/** Ally slots for the number of returned heroes, and how many are needed for the next one. */
export function allySlots(m: MetaSave): { slots: number; nextAt?: number } {
  const n = m.unlocked.length;
  let slots = 1;
  let nextAt: number | undefined;
  for (const s of SLOTS) {
    if (n >= s.unlockedHeroes) slots = s.slots;
    else if (nextAt === undefined) nextAt = s.unlockedHeroes;
  }
  return { slots, nextAt };
}

/** Closest locked hero by progress fraction (for "Ближе всех"). */
export function closestHero(m: MetaSave): { hero: HeroInfo; have: number; need: number } | undefined {
  let best: { hero: HeroInfo; have: number; need: number; frac: number } | undefined;
  for (const h of HEROES) {
    if (m.unlocked.includes(h.id)) continue;
    const p = heroProgress(m, h);
    if (!best || p.frac > best.frac) best = { hero: h, ...p };
  }
  return best;
}

// ------------------------------------------------------- «Сводка смены» (§4.5)

/** Heroes the player can take on a shift: starters plus everyone returned. */
export function roster(m: MetaSave): string[] {
  return HEROES.map((h) => h.id).filter((id) => STARTERS.includes(id) || m.unlocked.includes(id));
}

/** Squad size for this many available heroes: 3, then 4 after 6, 5 after 10. */
export function squadSlots(m: MetaSave): { slots: number; nextAt?: number } {
  const n = roster(m).length;
  const list = OUR.squad?.slotsByUnlocked ?? [{ unlocked: 0, slots: 3 }];
  let slots = list[0].slots;
  let nextAt: number | undefined;
  for (const s of list) {
    if (n >= s.unlocked) slots = s.slots;
    else if (nextAt === undefined) nextAt = s.unlocked;
  }
  return { slots, nextAt };
}

export const HIGH_TIERS = OUR.squad?.maxHighTierInSquad.tiers ?? [3, 4];
export const MAX_HIGH = OUR.squad?.maxHighTierInSquad.max ?? 2;

export interface DistrictEnemy {
  id: string;
  tier: number;
  role: 'lair' | 'target';
}

/**
 * The district's infected heroes for one run: lairs of tier 1, 2, 3 and a call
 * target of tier 3–4, all different; nearest lower tier when a tier runs out.
 * Rerolled when fewer free heroes than squad slots would be left (§4.5 p.4).
 * The engine may roll its own; this one serves the screen and the preview.
 */
export function rollDistrict(m: MetaSave, rnd: () => number = Math.random): DistrictEnemy[] {
  const roll = OUR.squad?.enemyRoll ?? { lairs: [{ tier: 1 }, { tier: 2 }, { tier: 3 }], callTarget: { tiers: [3, 4] } };
  const n73Allowed = HEROES.filter((h) => h.id !== 'n73').every((h) => roster(m).includes(h.id));
  const pool = HEROES.filter((h) => h.id !== 'n73' || n73Allowed);
  const { slots } = squadSlots(m);
  let best: DistrictEnemy[] = [];
  for (let attempt = 0; attempt < 30; attempt++) {
    const used = new Set<string>();
    const take = (tier: number, role: DistrictEnemy['role']): DistrictEnemy | undefined => {
      for (let t = tier; t >= 1; t--) {
        const free = pool.filter((h) => h.tier === t && !used.has(h.id));
        if (free.length) {
          const h = free[Math.floor(rnd() * free.length)];
          used.add(h.id);
          return { id: h.id, tier: h.tier, role };
        }
      }
      return undefined;
    };
    const tiers = roll.callTarget.tiers;
    const target = take(tiers[Math.floor(rnd() * tiers.length)], 'target');
    const lairs = roll.lairs.map((l) => take(l.tier, 'lair'));
    const out = [...lairs, target].filter((e): e is DistrictEnemy => !!e);
    best = out;
    const freeForUs = roster(m).filter((id) => !used.has(id)).length;
    if (freeForUs >= slots) break;
  }
  return best;
}

/** Techs that beat this enemy (its weaknesses), from the resist table. */
function weakTechs(id: string): string[] {
  const r = HEROES.find((h) => h.id === id)?.enemy?.resist ?? {};
  return Object.keys(r).filter((k) => (r[k] ?? 1) > 1.001);
}

/** How many of the district's weaknesses this hero's element hits (the call target counts double). */
export function weaknessHits(heroId: string, enemies: DistrictEnemy[]): number {
  const tech = HEROES.find((h) => h.id === heroId)?.tech;
  if (!tech) return 0;
  return enemies.reduce((s, e) => s + (weakTechs(e.id).includes(tech) ? (e.role === 'target' ? 2 : 1) : 0), 0);
}

/** «Авто-отряд»: free heroes whose element hits the most weaknesses, cheaper tiers first on ties, at most MAX_HIGH of tier 3–4. */
export function autoSquad(m: MetaSave, enemies: DistrictEnemy[]): string[] {
  const taken = new Set(enemies.map((e) => e.id));
  const { slots } = squadSlots(m);
  const free = roster(m)
    .filter((id) => !taken.has(id))
    .map((id) => ({ id, tier: HEROES.find((h) => h.id === id)!.tier, hits: weaknessHits(id, enemies) }))
    .sort((a, b) => b.hits - a.hits || a.tier - b.tier);
  const out: string[] = [];
  let high = 0;
  for (const h of free) {
    if (out.length >= slots) break;
    if (HIGH_TIERS.includes(h.tier)) {
      if (high >= MAX_HIGH) continue;
      high++;
    }
    out.push(h.id);
  }
  return out;
}

/** §4.6: heroes not yet unlocked can still go as a «черновой бэкап», one per squad. */
export const MAX_DRAFT = OUR.backup?.states.draft.maxInSquad ?? 1;

export function isDraft(m: MetaSave, id: string): boolean {
  return !roster(m).includes(id);
}

/** Sync level 0–5 from the `sync.<id>` stat (runs in squad, trophies, same-type kills, wins). */
export function syncLevel(m: MetaSave, id: string): number {
  const xp = stat(m, `sync.${id}`);
  const levels = OUR.backup?.sync.levels ?? [0, 5, 15, 30, 50, 80];
  let lv = 0;
  levels.forEach((need, i) => {
    if (xp >= need) lv = i;
  });
  return lv;
}

/** Our shift worker's strength vs the infected version, 0–1 (draft: fixed, restored: by sync). */
export function backupFactors(m: MetaSave, id: string): { hp: number; damage: number } {
  if (isDraft(m, id)) {
    const d = OUR.backup?.states.draft;
    return { hp: d?.hpFactor ?? 0.5, damage: d?.damageFactor ?? 0.7 };
  }
  const f = OUR.backup?.sync.factorsByLevel ?? [{ hp: 0.6, damage: 0.8 }];
  return f[Math.min(syncLevel(m, id), f.length - 1)];
}

export function saveSquad(m: MetaSave, ids: string[]): void {
  m.lastSquad = [...ids];
  saveMeta(m);
}

export function pickAllies(m: MetaSave, ids: string[]): void {
  m.allyChoice = ids.slice(0, allySlots(m).slots);
  saveMeta(m);
}

/** Cache bonuses opened by every rank up to the player's (meta.json ranks[].unlocksBoons, cumulative). */
export function boonPoolFor(m: MetaSave): string[] {
  const { index } = rankAt(stat(m, 'total_score'));
  return RANKS.slice(0, index + 1).flatMap((r) => r.unlocksBoons);
}

// ------------------------------------------------------------- blueprints (MVP_RULES §5.1)

interface Blueprints {
  buildingsStartUnlocked: string[];
  buildingFragments: Record<string, number>;
  heroFragments: number;
  targetPick: { buildingChance: number; closestToDoneChance: number };
}
const BP: Blueprints = (metaJson as unknown as { blueprints?: Blueprints }).blueprints ?? {
  buildingsStartUnlocked: [],
  buildingFragments: {},
  heroFragments: 6,
  targetPick: { buildingChance: 0.6, closestToDoneChance: 0.5 },
};

export type FragmentKind = 'building' | 'hero';
export interface FragmentTarget { kind: FragmentKind; id: string }

/** Buildings gated behind blueprints, sorted by fragment requirement. */
export const BLUEPRINT_BUILDINGS = Object.keys(BP.buildingFragments).sort((a, b) => BP.buildingFragments[a] - BP.buildingFragments[b]);

export function fragmentNeed(kind: FragmentKind, id: string): number {
  return kind === 'hero' ? BP.heroFragments : (BP.buildingFragments[id] ?? 0);
}

export function fragments(m: MetaSave, kind: FragmentKind, id: string): number {
  return Math.min(m.fragments?.[`${kind}.${id}`] ?? 0, fragmentNeed(kind, id));
}

export function buildingUnlocked(m: MetaSave, id: string): boolean {
  const need = BP.buildingFragments[id];
  return need === undefined || BP.buildingsStartUnlocked.includes(id) || fragments(m, 'building', id) >= need;
}

export function addFragment(m: MetaSave, kind: FragmentKind, id: string): void {
  const key = `${kind}.${id}`;
  m.fragments = m.fragments ?? {};
  m.fragments[key] = Math.min((m.fragments[key] ?? 0) + 1, fragmentNeed(kind, id));
  saveMeta(m);
}

export function addArchive(m: MetaSave, recordId: string): void {
  m.archive = m.archive ?? [];
  if (!m.archive.includes(recordId)) { m.archive.push(recordId); saveMeta(m); }
}

export function pickFragment(m: MetaSave, rnd = Math.random): FragmentTarget | null {
  const open: FragmentTarget[] = [
    ...BLUEPRINT_BUILDINGS.filter((id) => !buildingUnlocked(m, id)).map((id) => ({ kind: 'building' as const, id })),
    ...(fragments(m, 'hero', '') < BP.heroFragments ? [] : []),
  ];
  if (open.length === 0) return null;
  if (rnd() < BP.targetPick.buildingChance) {
    const bldgs = open.filter((t) => t.kind === 'building');
    if (bldgs.length > 0) {
      const closest = bldgs.reduce((a, b) => fragments(m, 'building', a.id) >= fragments(m, 'building', b.id) ? a : b);
      return rnd() < BP.targetPick.closestToDoneChance ? closest : bldgs[Math.floor(rnd() * bldgs.length)];
    }
  }
  return open[Math.floor(rnd() * open.length)];
}
