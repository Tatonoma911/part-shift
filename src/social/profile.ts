import { cleanName, rankOf } from './score';

/**
 * The player's social profile on this device: nickname, a random id for the leaderboard,
 * lifetime score and personal bests. Key starts with "partshift." so it syncs with the account.
 */
export interface Profile {
  /** Random device id; the leaderboard uses the Firebase anonymous uid, this one names the default nickname. */
  id: string;
  name: string;
  /** The player picked the name themselves (otherwise it's the default "Property #1234"). */
  named: boolean;
  total: number;
  runs: number;
  wins: number;
  best: number;
  /** Best score sent to each board: { "week-2026-W41": 1234 }. */
  sent: Record<string, number>;
  /** Runs finished since the donation nudge was last shown. */
  sinceNudge: number;
}

const KEY = 'partshift.social.v1';

function fresh(): Profile {
  const n = 1000 + Math.floor(Math.random() * 9000);
  const id = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
  return { id, name: String(n), named: false, total: 0, runs: 0, wins: 0, best: 0, sent: {}, sinceNudge: 0 };
}

let cached: Profile | null = null;

export function profile(): Profile {
  if (cached) return cached;
  let p = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) p = { ...p, ...JSON.parse(raw) };
  } catch {
    /* defaults */
  }
  cached = p;
  if (!p.named) persist();
  return p;
}

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(cached));
  } catch {
    /* ignore */
  }
}

export function updateProfile(fn: (p: Profile) => void): Profile {
  const p = profile();
  fn(p);
  persist();
  return p;
}

/** Returns false when the name is rejected. */
export function setName(raw: string): boolean {
  const s = cleanName(raw);
  if (!s) return false;
  updateProfile((p) => {
    p.name = s;
    p.named = true;
  });
  return true;
}

/** Display name: the chosen nickname, or "Property #1234" in the current language. */
export function displayName(prefix: string): string {
  const p = profile();
  return p.named ? p.name : `${prefix}${p.name}`;
}

/** Adds a finished run; returns the title index before and after (to celebrate a promotion). */
export function addRun(score: number, victory: boolean): { before: number; after: number; best: boolean } {
  const before = rankOf(profile().total);
  let best = false;
  const p = updateProfile((q) => {
    q.total += score;
    q.runs += 1;
    if (victory) q.wins += 1;
    if (score > q.best) {
      q.best = score;
      best = true;
    }
    q.sinceNudge += 1;
  });
  return { before, after: rankOf(p.total), best };
}

/** Test hook. */
export function resetProfileCache(): void {
  cached = null;
}
