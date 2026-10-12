import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getFirstUncleared, markShiftCleared, CAMPAIGN_TOTAL } from '../src/game/campaign';

// Node has no localStorage: a small in-memory stand-in lets the campaign save run for real.
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
}

describe('campaign progress hand-off', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = memoryStorage();
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it('the first shift is the first one played after the tutorial', () => {
    expect(getFirstUncleared()).toBe(1);
  });

  it('clearing shift 1 moves the next run to shift 2', () => {
    markShiftCleared(1, 3);
    expect(getFirstUncleared()).toBe(2);
  });

  it('clearing every shift wraps back to shift 1', () => {
    for (let n = 1; n <= CAMPAIGN_TOTAL; n++) markShiftCleared(n, 1);
    expect(getFirstUncleared()).toBe(1);
  });
});
