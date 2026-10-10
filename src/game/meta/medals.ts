import achJson from '../../data/design/achievements.json';
import ruText from '../../data/text/ru.json';
import { BLUEPRINT_BUILDINGS, buildingUnlocked, fragmentNeed, stat, type MetaSave } from './store';

/**
 * Medals (design/ACHIEVEMENTS.md §2–4, data/achievements.json): 22 tiered
 * lifetime counters (bronze / silver / gold) and 6 special one-run feats
 * (diamond). Pure rules here; RunTally counts and commits, the screens draw.
 * Saved inside `partshift.meta.v1` as `medals: {<id>: {tier, at}}`.
 */
export const TIERS = ['bronze', 'silver', 'gold', 'diamond'] as const;
export type TierName = (typeof TIERS)[number];

export { mergeMedals, type MedalEntry } from './mergeMedals';

interface TieredJson { id: string; stat: string; thresholds: (number | 'all')[]; iconFallback?: string }
interface SpecialJson { id: string; condition: string; iconFallback?: string }
interface AchJson {
  tierRankPoints: Record<TierName, number>;
  tiered: TieredJson[];
  special: SpecialJson[];
  shiftStars: { stars: { n: number; limitSeconds?: Record<string, number> }[]; scoreBonus: Record<string, number> };
}
const ACH = achJson as unknown as AchJson;

export interface MedalDef {
  id: string;
  kind: 'tiered' | 'special';
  /** Lifetime stat expression ("a+b" sums, "runs_won.crunch" a sub-counter). Tiered only. */
  stat?: string;
  /** Resolved thresholds; gold is left out when "all" can't be resolved yet. */
  thresholds: number[];
  icon?: string;
}

/** Control's archive records available in the texts (record.<n>.title). */
export const RECORD_TOTAL = Math.max(10, Object.keys(ruText).filter((k) => /^record\.\d+\.title$/.test(k)).length);

/** "all" for the collection medals: every blueprint building / every record in data; 0 when unknown. */
function allOf(stat: string): number {
  if (stat === 'blueprints_completed') return BLUEPRINT_BUILDINGS.length;
  if (stat === 'lore_records_count') return RECORD_TOTAL;
  return 0;
}

export const MEDALS: MedalDef[] = [
  ...ACH.tiered.map((m): MedalDef => {
    const th: number[] = [];
    for (const x of m.thresholds) {
      const v = x === 'all' ? allOf(m.stat) : x;
      // An "all" smaller than silver (or unknown) would make gold meaningless: skip it.
      if (v > (th[th.length - 1] ?? 0)) th.push(v);
    }
    return { id: m.id, kind: 'tiered', stat: m.stat, thresholds: th, icon: m.iconFallback };
  }),
  ...ACH.special.map((m): MedalDef => ({ id: m.id, kind: 'special', thresholds: [1], icon: m.iconFallback })),
];

export const MEDAL = Object.fromEntries(MEDALS.map((m) => [m.id, m])) as Record<string, MedalDef>;

/** Difficulty ids in the design docs vs the data: «Аврал» is `crunch` in ACHIEVEMENTS.md and `rush` in difficulty.json. */
const ALIAS: Record<string, string[]> = { 'runs_won.crunch': ['runs_won.crunch', 'runs_won.rush'] };

/** One counter of the save plus the run's live counts, with the derived ones (§newCounters). */
function counter(m: MetaSave, key: string, run: Record<string, number>): number {
  const raw = (k: string) => stat(m, k) + (run[k] ?? 0);
  switch (key) {
    case 'daily_streak_best':
      return Math.max(stat(m, 'daily_streak_best'), m.daily?.streak ?? 0);
    case 'lore_records_count':
      return Math.max(m.archive?.length ?? 0, raw('lore_records_found'));
    case 'blueprints_completed': {
      // Buildings whose blueprint is fully collected; before the fragment system is in, whole sets of found fragments.
      const built = BLUEPRINT_BUILDINGS.filter((id) => (m.fragments?.[`building.${id}`] ?? 0) > 0 && buildingUnlocked(m, id)).length;
      const sets = Math.floor(raw('blueprints_found') / Math.max(1, fragmentNeed('hero', '')));
      return Math.max(built, sets);
    }
  }
  return (ALIAS[key] ?? [key]).reduce((s, k) => s + raw(k), 0);
}

/** Value of a medal's stat expression ("a+b" = sum). */
export function statValue(m: MetaSave, expr: string, run: Record<string, number> = {}): number {
  return expr.split('+').reduce((s, k) => s + counter(m, k.trim(), run), 0);
}

/** Tier reached for a value: the number of thresholds met. */
export function tierFor(def: MedalDef, value: number): number {
  return def.thresholds.filter((x) => value >= x).length;
}

export function savedTier(m: MetaSave, id: string): number {
  return m.medals?.[id]?.tier ?? 0;
}

/** Tier name for a medal at a tier: specials are always diamond. */
export function tierName(def: MedalDef, tier: number): TierName {
  return def.kind === 'special' ? 'diamond' : TIERS[Math.max(0, Math.min(2, tier - 1))];
}

/** Atlas frame of a tier cup (172 row 1: cups 1–4 = bronze, silver, gold, diamond). */
export function tierCup(name: TierName): string {
  return `rank_${TIERS.indexOf(name) + 1}`;
}

/** Progress toward the next tier: current value and the threshold (the last one when maxed). */
export function medalProgress(m: MetaSave, def: MedalDef, run: Record<string, number> = {}): { tier: number; cur: number; max: number; done: boolean } {
  const tier = savedTier(m, def.id);
  if (def.kind === 'special') return { tier, cur: tier ? 1 : 0, max: 1, done: tier > 0 };
  const cur = statValue(m, def.stat!, run);
  const reached = Math.max(tier, tierFor(def, cur));
  const done = reached >= def.thresholds.length;
  return { tier: reached, cur, max: def.thresholds[Math.min(reached, def.thresholds.length - 1)], done };
}

// ---------------------------------------------------------------- one run

/** What one run did, for the special medals and the shift stars. */
export interface RunFacts {
  win: boolean;
  /** 'call' or 'quick'. */
  mode: string;
  difficulty: string;
  seconds: number;
  accidentalOpens: number;
  minesExploded: number;
  /** Own heroes knocked out this run. */
  heroesDown: number;
  /** An own hero carried 4 trophies at once. */
  fullLimbs: boolean;
  /** Longest stretch at max tempo, seconds. */
  tempoMaxSeconds: number;
  /** Raids called early by this player. */
  earlyRaids: number;
}

export function specialMet(id: string, f: RunFacts): boolean {
  switch (id) {
    case 'clean_sweep':
      return f.win && f.accidentalOpens === 0 && f.minesExploded === 0;
    case 'no_losses':
      return f.win && f.heroesDown === 0;
    case 'full_limbs':
      return f.fullLimbs;
    case 'fast_win':
      return f.win && f.mode !== 'quick' && f.difficulty === 'shift' && f.seconds < 480;
    case 'fire_tempo':
      return f.tempoMaxSeconds >= 180;
    case 'early_raids':
      return f.win && f.earlyRaids >= 3;
  }
  return false;
}

export interface MedalAward {
  id: string;
  /** A special (diamond) medal: the screens show it as tier 4. */
  special: boolean;
  /** Tier before and after (a jump of two tiers in one run is possible). */
  from: number;
  tier: number;
  /** Rank points for the new tiers. */
  points: number;
}

/** Rank points for going from one tier to another (each new tier pays once). */
export function tierPoints(def: MedalDef, from: number, to: number): number {
  let p = 0;
  for (let k = from + 1; k <= to; k++) p += ACH.tierRankPoints[tierName(def, k)];
  return p;
}

/**
 * Medals whose tier is now above `known` (the save's tiers by default).
 * `run` = this run's counters not yet in `m.stats`; `facts` judges the special medals
 * (null: only the specials that need no win are judged live, from `liveFacts`).
 */
export function evaluate(m: MetaSave, run: Record<string, number>, facts: RunFacts | null, known: Record<string, number> = {}): MedalAward[] {
  const out: MedalAward[] = [];
  for (const def of MEDALS) {
    const from = Math.max(savedTier(m, def.id), known[def.id] ?? 0);
    let tier = 0;
    if (def.kind === 'tiered') tier = tierFor(def, statValue(m, def.stat!, run));
    else if (facts && specialMet(def.id, facts)) tier = 1;
    if (tier > from) out.push({ id: def.id, special: def.kind === 'special', from, tier, points: tierPoints(def, from, tier) });
  }
  return out;
}

/** Writes the awards into the save and adds their rank points to total_score. */
export function applyAwards(m: MetaSave, awards: MedalAward[], date: string): number {
  let points = 0;
  m.medals ??= {};
  for (const a of awards) {
    if (a.tier <= savedTier(m, a.id)) continue;
    m.medals[a.id] = { tier: a.tier, at: date };
    points += a.points;
  }
  if (points) m.stats.total_score = stat(m, 'total_score') + points;
  return points;
}

/** The tiered medal closest to its next tier (for «Ближе всего»). */
export function closestMedal(m: MetaSave, skip: string[] = []): { def: MedalDef; cur: number; max: number } | undefined {
  let best: { def: MedalDef; cur: number; max: number; f: number } | undefined;
  for (const def of MEDALS) {
    if (def.kind !== 'tiered' || skip.includes(def.id)) continue;
    const p = medalProgress(m, def);
    if (p.done) continue;
    const prev = p.tier ? def.thresholds[p.tier - 1] : 0;
    const f = (p.cur - prev) / Math.max(1, p.max - prev);
    if (!best || f > best.f) best = { def, cur: p.cur, max: p.max, f };
  }
  return best && { def: best.def, cur: best.cur, max: best.max };
}

export function today(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// ------------------------------------------------------------ shift stars (§6)

export interface StarCheck {
  /** 1: win, 2: within the time limit, 3: no hero lost (solo) / team share (co-op). */
  met: [boolean, boolean, boolean];
  stars: number;
  bonus: number;
  coop: boolean;
  /** Star 2's time limit for this mode and difficulty, seconds. */
  limit?: number;
}

const STAR_LIMIT = ACH.shiftStars.stars.find((s) => s.n === 2)?.limitSeconds ?? {};

/** Time limit for star 2 by mode and difficulty («Аврал» is `rush` in the data, `crunch` in the docs). */
export function starLimit(mode: string, difficulty: string): number | undefined {
  if (mode === 'quick') return STAR_LIMIT.quick;
  return STAR_LIMIT[`call.${difficulty}`] ?? (difficulty === 'rush' ? STAR_LIMIT['call.crunch'] : undefined);
}

/**
 * Stars for a shift. Without a win there are none, but each condition is still
 * reported so the screen can show it grey. Co-op star 3 needs every player's
 * share of damage to the call target; the core does not track it per player
 * yet, so `coopShareOk` defaults to true (a won co-op shift counts).
 */
export function shiftStars(f: Pick<RunFacts, 'win' | 'mode' | 'difficulty' | 'seconds' | 'heroesDown'>, coop = false, coopShareOk = true): StarCheck {
  const limit = starLimit(f.mode, f.difficulty);
  const met: [boolean, boolean, boolean] = [f.win, limit !== undefined && f.seconds <= limit, coop ? coopShareOk : f.heroesDown === 0];
  const stars = f.win ? met.filter(Boolean).length : 0;
  return { met, stars, bonus: ACH.shiftStars.scoreBonus[String(stars)] ?? 0, coop, limit };
}
