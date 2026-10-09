import { describe, expect, it } from 'vitest';
import { merge, readLocal, RUN_KEY, writeLocal } from '../src/account/snapshot';

const BEST = 'partshift.best.v1';
const TUT = 'partshift.tutorialDone.v1';
const SOUND = 'partshift.sound.v1';

class MemStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

describe('cloud save merge', () => {
  it('first sign-in uploads everything when the cloud is empty', () => {
    const r = merge({ data: { [RUN_KEY]: 'a' }, changedAt: 5 }, null);
    expect(r.upload).toBe(true);
    expect(r.localChanged).toBe(false);
  });

  it('a newer run from the cloud replaces the local one', () => {
    const r = merge({ data: { [RUN_KEY]: 'old', [SOUND]: 'L' }, changedAt: 10 }, { data: { [RUN_KEY]: 'new', [SOUND]: 'C' }, changedAt: 20 });
    expect(r.data[RUN_KEY]).toBe('new');
    expect(r.data[SOUND]).toBe('C');
    expect(r.runFromCloud).toBe(true);
    expect(r.upload).toBe(false);
  });

  it('a newer local run wins and goes up', () => {
    const r = merge({ data: { [RUN_KEY]: 'mine' }, changedAt: 30 }, { data: { [RUN_KEY]: 'theirs' }, changedAt: 20 });
    expect(r.data[RUN_KEY]).toBe('mine');
    expect(r.runFromCloud).toBe(false);
    expect(r.upload).toBe(true);
  });

  it('a run finished on the newer side is not brought back', () => {
    const r = merge({ data: { [RUN_KEY]: 'stale' }, changedAt: 1 }, { data: {}, changedAt: 9 });
    expect(r.data[RUN_KEY]).toBeUndefined();
    expect(r.localChanged).toBe(true);
  });

  it('keeps the best time and tutorial progress from both devices', () => {
    const r = merge({ data: { [BEST]: '300', [TUT]: '1' }, changedAt: 50 }, { data: { [BEST]: '240' }, changedAt: 10 });
    expect(r.data[BEST]).toBe('240');
    expect(r.data[TUT]).toBe('1');
    expect(r.upload).toBe(true);
  });

  it('identical sides need nothing', () => {
    const d = { [RUN_KEY]: 'x', [BEST]: '100' };
    const r = merge({ data: { ...d }, changedAt: 3 }, { data: { ...d }, changedAt: 3 });
    expect(r.upload).toBe(false);
    expect(r.localChanged).toBe(false);
  });

  it('syncs only game keys, never the account bookkeeping or other sites', () => {
    const s = new MemStorage();
    s.setItem(RUN_KEY, 'r');
    s.setItem('partshift.account.meta', '{}');
    s.setItem('other.app', 'x');
    expect(readLocal(s)).toEqual({ [RUN_KEY]: 'r' });
    writeLocal(s, { [BEST]: '5' });
    expect(s.getItem(RUN_KEY)).toBeNull();
    expect(s.getItem(BEST)).toBe('5');
    expect(s.getItem('partshift.account.meta')).toBe('{}');
    expect(s.getItem('other.app')).toBe('x');
  });
});
