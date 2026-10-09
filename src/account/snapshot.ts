/**
 * What gets synced between devices: every localStorage key starting with `partshift.`,
 * except the account's own bookkeeping. New saved things (comic seen, settings...) sync automatically.
 * Pure functions here; Account (cloud.ts) does the I/O.
 */
export type Snapshot = Record<string, string>;

export const PREFIX = 'partshift.';
export const ACCOUNT_PREFIX = 'partshift.account.';
export const RUN_KEY = 'partshift.save.v1';
const BEST_KEY = 'partshift.best.v1';
const TUTORIAL_KEY = 'partshift.tutorialDone.v1';

export interface Side {
  data: Snapshot;
  /** When this side's data last changed (ms since epoch). */
  changedAt: number;
}

export interface MergeResult {
  data: Snapshot;
  changedAt: number;
  /** The cloud copy differs from the result and must be written. */
  upload: boolean;
  /** Local storage differs from the result and must be written. */
  localChanged: boolean;
  /** The run in progress comes from the cloud and differs from the one on this device. */
  runFromCloud: boolean;
}

export function readLocal(storage: Storage): Snapshot {
  const out: Snapshot = {};
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && k.startsWith(PREFIX) && !k.startsWith(ACCOUNT_PREFIX)) out[k] = storage.getItem(k) ?? '';
  }
  return out;
}

/** Writes `data` into storage: changed keys set, synced keys missing from `data` removed. */
export function writeLocal(storage: Storage, data: Snapshot): void {
  for (const k of Object.keys(readLocal(storage))) if (!(k in data)) storage.removeItem(k);
  for (const [k, v] of Object.entries(data)) if (storage.getItem(k) !== v) storage.setItem(k, v);
}

/** Stable text form, used to see whether anything changed. */
export function fingerprint(data: Snapshot): string {
  return JSON.stringify(Object.keys(data).sort().map((k) => [k, data[k]]));
}

/**
 * Combines this device and the cloud: the newer side wins key by key (the run in progress, sound...),
 * except the best time (the smaller one) and "tutorial done" (done anywhere means done).
 */
export function merge(local: Side, cloud: Side | null): MergeResult {
  if (!cloud) return { data: { ...local.data }, changedAt: local.changedAt, upload: true, localChanged: false, runFromCloud: false };
  const [newer, older] = cloud.changedAt > local.changedAt ? [cloud, local] : [local, cloud];
  const data: Snapshot = { ...older.data, ...newer.data };
  // A finished or abandoned run is removed on the newer side; don't resurrect the older one.
  if (!(RUN_KEY in newer.data)) delete data[RUN_KEY];

  const bests = [local.data[BEST_KEY], cloud.data[BEST_KEY]].map(Number).filter((n) => n > 0 && Number.isFinite(n));
  if (bests.length) data[BEST_KEY] = String(Math.min(...bests));
  if (local.data[TUTORIAL_KEY] === '1' || cloud.data[TUTORIAL_KEY] === '1') data[TUTORIAL_KEY] = '1';

  const fp = fingerprint(data);
  return {
    data,
    changedAt: Math.max(local.changedAt, cloud.changedAt),
    upload: fp !== fingerprint(cloud.data),
    localChanged: fp !== fingerprint(local.data),
    runFromCloud: data[RUN_KEY] !== undefined && data[RUN_KEY] !== local.data[RUN_KEY] && data[RUN_KEY] === cloud.data[RUN_KEY],
  };
}
