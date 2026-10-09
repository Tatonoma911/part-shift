import { analytics } from '../analytics';
import { t } from '../i18n';
import { boardEnabled, placeOf, submit, top } from './board';
import { addRun, displayName, profile, updateProfile } from './profile';
import { boardId, dayId, rankOf, runScore, type RunResult } from './score';
import { flushFeedback } from './ui';

export { donateReady } from './config';
export { boardEnabled } from './board';
export { dailySeed, dayId, rankOf } from './score';
export { displayName, profile } from './profile';
export { challengeUrl, readChallenge, resultCard } from './share';
export { invite, openBoard, openDonate, openFeedback, share, socialOpen, close as closeSocial } from './ui';

export interface RecordedRun {
  score: number;
  rankBefore: number;
  rankAfter: number;
  best: boolean;
  /** Place on this week's board once the server answers (null when offline or not configured). */
  place: Promise<number | null>;
}

/**
 * A free-play run ended: score it, add it to the career, send it to the world boards
 * (all time, this week, and today's board when it was the city of the day).
 */
export function recordRun(r: RunResult & { threat: number; daily?: string }): RecordedRun {
  const score = runScore(r);
  const { before, after, best } = addRun(score, r.victory);
  analytics.track('run_score', { score, victory: r.victory ? 1 : 0, daily: r.daily ? 1 : 0, rank: after });
  const boards = [boardId('all'), boardId('week')];
  if (r.daily && r.daily === dayId()) boards.push(boardId('day'));
  const place = (async () => {
    if (!boardEnabled() || score <= 0) return null;
    const entry = { name: displayName(t('social.default_name')), score, seconds: Math.round(r.seconds), victory: r.victory, rank: rankOf(profile().total) };
    const kept = await Promise.all(boards.map((b) => submit(b, entry)));
    updateProfile((p) => boards.forEach((b, i) => (p.sent[b] = kept[i])));
    return placeOf(boards[1], kept[1]);
  })().catch(() => null);
  return { score, rankBefore: before, rankAfter: after, best, place };
}

/** This week's leader for the main menu, or null. */
export async function heroOfWeek(): Promise<{ name: string; score: number } | null> {
  if (!boardEnabled()) return null;
  try {
    const { rows } = await top('week', 1);
    return rows[0] ? { name: String(rows[0].name), score: Number(rows[0].score) || 0 } : null;
  } catch {
    return null;
  }
}

/** Once per launch: deliver feedback written offline. */
export function bootSocial(): void {
  void flushFeedback().catch(() => undefined);
}

/** Every few finished runs, a gentle reminder that the author drinks coffee (never twice in a row). */
export function shouldNudge(): boolean {
  const p = profile();
  if (p.sinceNudge < 3) return false;
  updateProfile((q) => (q.sinceNudge = 0));
  return true;
}
