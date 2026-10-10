/** A medal in the save: tier 1–3 (special: 1) and the YYYY-MM-DD it was earned. */
export interface MedalEntry {
  tier: number;
  at: string;
}

/**
 * Account merge (ACHIEVEMENTS.md §4): the higher tier wins per medal, with its date;
 * on a tie the earlier date stays. Kept free of game data so the account code can use it.
 */
export function mergeMedals(a: Record<string, MedalEntry> | undefined, b: Record<string, MedalEntry> | undefined): Record<string, MedalEntry> {
  const out: Record<string, MedalEntry> = { ...(a ?? {}) };
  for (const [id, e] of Object.entries(b ?? {})) {
    const mine = out[id];
    if (!mine || e.tier > mine.tier || (e.tier === mine.tier && e.at < mine.at)) out[id] = e;
  }
  return out;
}
