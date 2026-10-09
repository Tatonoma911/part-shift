import meta from '../data/design/meta.json';

/** What a finished run contributes to the score (design/HEROES.md §4, meta.json runScore). */
export interface RunResult {
  victory: boolean;
  seconds: number;
  nests: number;
  /** Energy the player earned during the run (spending doesn't lower it). */
  energy: number;
  heroes?: number;
  /** The call target (boss) was stopped. */
  callTarget?: boolean;
  /** difficulty.json level id. */
  difficulty?: string;
  mode?: 'call' | 'quick' | 'coop_call';
}

const S = meta.runScore;

export function runScore(r: RunResult): number {
  let s = Math.floor(r.energy) * S.energyEarned + r.nests * S.nestDestroyed + (r.heroes ?? 0) * S.heroDefeated;
  if (r.callTarget) s += S.callTargetDefeatedExtra;
  if (r.victory) {
    s += S.winBonus;
    const steps = S.timeBonusByMode[r.mode === 'quick' ? 'quick' : 'call'].underSeconds;
    const step = steps.find(([sec]) => r.seconds < sec);
    if (step) s += step[1];
  }
  const diff = (S.multiplierByDifficulty as Record<string, number>)[r.difficulty ?? 'shift'] ?? 1;
  const mode = (S.multiplierByMode as Record<string, number>)[r.mode ?? 'call'] ?? 1;
  return Math.max(0, Math.round(s * diff * mode));
}

/** Career titles by lifetime score; text keys rank.0 … rank.6. */
export const RANKS = [0, 1500, 4000, 9000, 18000, 35000, 70000];

export function rankOf(total: number): number {
  let r = 0;
  for (let i = 0; i < RANKS.length; i++) if (total >= RANKS[i]) r = i;
  return r;
}

/** Progress to the next title: [score inside the step, step size], or null at the top. */
export function rankProgress(total: number): [number, number] | null {
  const r = rankOf(total);
  if (r >= RANKS.length - 1) return null;
  return [total - RANKS[r], RANKS[r + 1] - RANKS[r]];
}

const pad = (n: number) => String(n).padStart(2, '0');

/** UTC day id, the same for every player: "2026-10-09". */
export function dayId(now = new Date()): string {
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
}

/** ISO week id in UTC: "2026-W41". The weekly board resets on Monday 00:00 UTC. */
export function weekId(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-W${pad(week)}`;
}

/** The "city of the day" map seed: one board for everybody on that UTC day. */
export function dailySeed(day = dayId()): number {
  let h = 2166136261;
  for (const ch of `partshift-daily-${day}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1e9 || 1;
}

export type BoardKind = 'week' | 'day' | 'all';
export const boardId = (kind: BoardKind, now = new Date()): string => (kind === 'week' ? `week-${weekId(now)}` : kind === 'day' ? `day-${dayId(now)}` : 'all');

/** Nicknames: letters, digits, space, _ - . ; 2–18 characters; a short stop list. */
const BAD = ['хуй', 'хуе', 'хуё', 'пизд', 'ебат', 'ебан', 'еблан', 'бляд', 'сука', 'пидор', 'пидар', 'мудак', 'гандон', 'fuck', 'shit', 'cunt', 'nigg', 'fag', 'hitler', 'гитлер', 'нацист', 'nazi'];

export function cleanName(raw: string): string | null {
  const s = raw.normalize('NFC').replace(/[^\p{L}\p{N} _.\-№#]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 18);
  if (s.length < 2) return null;
  const low = s.toLowerCase().replace(/[\s_.\-]/g, '');
  if (BAD.some((b) => low.includes(b))) return null;
  return s;
}
