import { beforeEach, describe, expect, it } from 'vitest';
import { merge } from '../src/account/snapshot';
import { World } from '../src/core/world';
import { applyAwards, evaluate, MEDAL, MEDALS, mergeMedals, shiftStars, statValue, tierFor, type RunFacts } from '../src/game/meta/medals';
import { RunTally } from '../src/game/meta/record';
import { emptyMeta, loadMeta } from '../src/game/meta/store';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const facts = (f: Partial<RunFacts> = {}): RunFacts => ({
  win: false, mode: 'call', difficulty: 'shift', seconds: 700, accidentalOpens: 0, minesExploded: 0,
  heroesDown: 0, fullLimbs: false, tempoMaxSeconds: 0, earlyRaids: 0, ...f,
});

describe('medals (design/ACHIEVEMENTS.md)', () => {
  beforeEach(() => store.clear());

  it('has 22 tiered and 6 special medals', () => {
    expect(MEDALS.filter((m) => m.kind === 'tiered')).toHaveLength(22);
    expect(MEDALS.filter((m) => m.kind === 'special')).toHaveLength(6);
  });

  it('tier = number of thresholds met', () => {
    const dig = MEDAL.dig;
    expect(tierFor(dig, 0)).toBe(0);
    expect(tierFor(dig, 499)).toBe(0);
    expect(tierFor(dig, 500)).toBe(1);
    expect(tierFor(dig, 3000)).toBe(2);
    expect(tierFor(dig, 99999)).toBe(3);
  });

  it('sums "a+b" stats, reads aliases and adds the live run counts', () => {
    const m = emptyMeta();
    m.stats.caches_opened = 10;
    m.stats.capsules_opened = 4;
    m.stats['runs_won.rush'] = 2;
    expect(statValue(m, 'caches_opened+capsules_opened')).toBe(14);
    expect(statValue(m, 'caches_opened+capsules_opened', { capsules_opened: 1 })).toBe(15);
    expect(statValue(m, 'runs_won.crunch')).toBe(2);
  });

  it('a jump of two tiers pays both tiers once, and only once', () => {
    const m = emptyMeta();
    m.stats.tiles_dug = 3200;
    const a = evaluate(m, {}, null);
    expect(a.find((x) => x.id === 'dig')).toMatchObject({ from: 0, tier: 2, points: 1300 });
    expect(applyAwards(m, a, '2026-10-10')).toBe(1300);
    expect(m.medals!.dig).toEqual({ tier: 2, at: '2026-10-10' });
    expect(m.stats.total_score).toBe(1300);
    expect(evaluate(m, {}, null).find((x) => x.id === 'dig')).toBeUndefined();
  });

  it('special medals follow their run conditions', () => {
    const ids = (f: RunFacts) => evaluate(emptyMeta(), {}, f).filter((a) => MEDAL[a.id].kind === 'special').map((a) => a.id).sort();
    expect(ids(facts({ win: true, seconds: 470, earlyRaids: 3 }))).toEqual(['clean_sweep', 'early_raids', 'fast_win', 'no_losses']);
    expect(ids(facts({ win: true, seconds: 470, difficulty: 'intern', minesExploded: 1, heroesDown: 1 }))).toEqual([]);
    expect(ids(facts({ fullLimbs: true, tempoMaxSeconds: 181 }))).toEqual(['fire_tempo', 'full_limbs']);
    expect(evaluate(emptyMeta(), {}, facts({ win: true })).find((a) => a.id === 'no_losses')?.points).toBe(2000);
  });

  it('account merge keeps the higher tier per medal', () => {
    const a = { dig: { tier: 1, at: '2026-10-01' }, wins: { tier: 3, at: '2026-10-02' } };
    const b = { dig: { tier: 2, at: '2026-10-05' }, wins: { tier: 1, at: '2026-09-01' }, fast_win: { tier: 1, at: '2026-10-03' } };
    expect(mergeMedals(a, b)).toEqual({ dig: b.dig, wins: a.wins, fast_win: b.fast_win });
    // Through the account sync: the older side's better medal survives.
    const save = (medals: object, score: number) => JSON.stringify({ ...emptyMeta(), stats: { total_score: score }, medals });
    const r = merge({ data: { 'partshift.meta.v1': save(a, 5) }, changedAt: 1 }, { data: { 'partshift.meta.v1': save(b, 9) }, changedAt: 2 });
    const m = JSON.parse(r.data['partshift.meta.v1']);
    expect(m.stats.total_score).toBe(9);
    expect(m.medals.wins.tier).toBe(3);
    expect(m.medals.dig.tier).toBe(2);
  });

  it('shift stars: win, time limit, no hero lost; bonus 150 / 400', () => {
    expect(shiftStars(facts({ win: false, seconds: 100 })).stars).toBe(0);
    expect(shiftStars(facts({ win: true, seconds: 800, heroesDown: 1 })).stars).toBe(1);
    expect(shiftStars(facts({ win: true, seconds: 700, heroesDown: 1 }))).toMatchObject({ stars: 2, bonus: 150 });
    expect(shiftStars(facts({ win: true, seconds: 700 }))).toMatchObject({ stars: 3, bonus: 400 });
    expect(shiftStars(facts({ win: true, seconds: 650, difficulty: 'rush' })).met[1]).toBe(true);
    expect(shiftStars(facts({ win: true, seconds: 670, difficulty: 'rush' })).met[1]).toBe(false);
  });

  it('commit saves new tiers, counts new events and fires live toasts once', () => {
    const w = new World({ seed: 3 });
    w.apply({ type: 'placeCommand', x: 6, y: 8 });
    const tally = new RunTally(0);
    const live: string[] = [];
    tally.onMedal = (a) => live.push(`${a.id}:${a.tier}`);
    for (let i = 0; i < 5; i++) tally.onEvent({ type: 'mine_defused', owner: 0 });
    tally.onEvent({ type: 'boss_call_fork', owner: 0 });
    tally.swipe([{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }]);
    tally.onEvent({ type: 'dig_done', x: 2, y: 1, owner: 0 });
    tally.sample(w, 0.016);
    tally.sample(w, 0.016);
    expect(live).toEqual(['defuse:1']);
    const { view } = tally.commit(w, 'win');
    const m = loadMeta();
    expect(m.stats.mines_defused).toBe(5);
    expect(m.stats.control_calls_answered).toBe(1);
    expect(m.stats.tiles_wave).toBe(1);
    expect(m.stats.chords).toBe(1);
    expect(m.medals?.defuse?.tier).toBe(1);
    expect(m.medals?.wins?.tier).toBe(1);
    expect(view.medals?.[0].id).toBe('defuse');
    expect(view.medalPoints).toBeGreaterThanOrEqual(600);
    expect(m.stats.total_score).toBe(view.total + view.medalPoints!);
  });
});
