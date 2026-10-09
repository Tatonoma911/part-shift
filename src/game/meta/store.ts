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
  records: Record<string, { bestSeconds?: number; bestScore?: number; bestEnergy?: number }>;
  daily?: { date: string; bestScore: number; streak: number };
  tutorialDone?: boolean;
}

export interface Rank {
  id: string;
  from: number;
  unlocksBoons: string[];
}

interface Unlock {
  type: 'tutorial_complete' | 'lifetime_stat' | 'run_stat' | 'defeat_hero' | 'run_challenge' | 'unlock_all';
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
}

const KEY = 'partshift.meta.v1';
export const HEROES = (heroesJson as unknown as { heroes: HeroInfo[] }).heroes;
export const RANKS = (metaJson as unknown as { ranks: { list: Rank[] } }).ranks.list;
const SLOTS = (heroesJson as unknown as { allySlots: { unlockedHeroes: number; slots: number }[] }).allySlots;

/** Heroes whose lines use feminine forms (text/ru.json *_female keys). */
export const FEMALE = new Set(['seraph', 'frostline', 'beacon', 'canopy']);

export function emptyMeta(): MetaSave {
  return { version: 1, stats: {}, unlocked: [], seenHeroes: [], allyChoice: [], records: {} };
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
  if (m.unlocked.includes(id)) return 'unlocked';
  if (m.seenHeroes.includes(id) || stat(m, `hero_seen.${id}`) > 0) return 'seen';
  return 'unknown';
}

/** Unlock progress as have/need (challenges are 0/1), plus the stat label key for lifetime counters. */
export function heroProgress(m: MetaSave, h: HeroInfo): { have: number; need: number; frac: number } {
  const u = h.unlock;
  let have = 0;
  let need = u.count ?? 1;
  switch (u.type) {
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

export function pickAllies(m: MetaSave, ids: string[]): void {
  m.allyChoice = ids.slice(0, allySlots(m).slots);
  saveMeta(m);
}
