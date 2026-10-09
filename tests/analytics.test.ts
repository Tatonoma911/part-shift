import { describe, expect, it } from 'vitest';
import { Analytics, clean, CONSENT_KEY, type Sink, type Storage } from '../src/analytics/analytics';

function setup(opts: { saved?: string; optedOut?: boolean; sink?: boolean } = {}) {
  const data = new Map<string, string>();
  if (opts.saved) data.set(CONSENT_KEY, opts.saved);
  const store: Storage = { get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v) };
  const sent: [string, Record<string, string | number>][] = [];
  const sink: Sink = { send: (n, p) => void sent.push([n, p]) };
  let loads = 0;
  const a = new Analytics(
    store,
    async () => {
      loads++;
      return opts.sink === false ? null : sink;
    },
    opts.optedOut,
  );
  const flush = () => new Promise((r) => setTimeout(r, 0));
  return { a, data, sent, flush, loads: () => loads };
}

describe('analytics', () => {
  it('sends nothing and loads no provider before the player answers', async () => {
    const { a, sent, flush, loads } = setup();
    expect(a.shouldAsk).toBe(true);
    a.track('intro_start');
    await flush();
    expect(sent).toEqual([]);
    expect(loads()).toBe(0);
  });

  it('sends what happened before "yes" once the player agrees', async () => {
    const { a, sent, flush, data } = setup();
    a.track('intro_start', { auto: true });
    a.setConsent(true);
    await flush();
    a.track('menu_view');
    expect(sent.map((e) => e[0])).toEqual(['intro_start', 'menu_view']);
    expect(sent[0][1]).toEqual({ auto: 1 });
    expect(data.get(CONSENT_KEY)).toBe('granted');
  });

  it('drops the queue on "no" and never asks again', async () => {
    const { a, sent, flush, loads } = setup();
    a.track('intro_start');
    a.setConsent(false);
    a.track('menu_view');
    await flush();
    expect(sent).toEqual([]);
    expect(loads()).toBe(0);
    expect(a.shouldAsk).toBe(false);
  });

  it('remembers the answer across launches', async () => {
    const { a, sent, flush } = setup({ saved: 'granted' });
    expect(a.shouldAsk).toBe(false);
    await flush();
    a.track('game_boot');
    expect(sent).toHaveLength(1);
  });

  it('treats Do Not Track as a standing "no"', async () => {
    const { a, sent, flush } = setup({ saved: 'granted', optedOut: true });
    expect(a.consent).toBe('denied');
    expect(a.shouldAsk).toBe(false);
    a.setConsent(true);
    a.track('menu_view');
    await flush();
    expect(sent).toEqual([]);
  });

  it('reports where the player left', async () => {
    const { a, sent, flush } = setup({ saved: 'granted' });
    await flush();
    a.where('tutorial', () => ({ step: 4, seconds: 31.456 }));
    a.left();
    expect(sent).toEqual([['app_hide', { screen: 'tutorial', step: 4, seconds: 31.46 }]]);
  });

  it('counts launches and days since the first one', () => {
    const { a } = setup();
    const day = 86_400_000;
    expect(a.launch(1000)).toEqual({ first_launch: true, launch_count: 1, days_since_first: 0 });
    expect(a.launch(1000 + 3 * day + 5)).toEqual({ first_launch: false, launch_count: 2, days_since_first: 3 });
  });

  it('keeps parameters within GA4 limits', () => {
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`p${i}`, i]));
    expect(Object.keys(clean(many))).toHaveLength(25);
    expect(clean({ 'Step-ID': 'x'.repeat(150), gone: undefined, bad: NaN })).toEqual({ step_id: 'x'.repeat(100), bad: 0 });
  });
});
