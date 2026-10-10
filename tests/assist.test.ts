import { describe, expect, it } from 'vitest';
import { deduce } from '../src/core/assist';
import { config } from '../src/core/data';
import { World } from '../src/core/world';
import { handWorld, run } from './helpers';

/** Reveal exactly the cells marked 'o' in the mask (content comes from rows). */
function opened(rows: string[], mask: string[]): World {
  const w = handWorld(rows);
  mask.forEach((m, y) => [...m].forEach((ch, x) => (w.cell(x, y).revealed = ch === 'o')));
  return w;
}

describe('scanner deduction', () => {
  it('a clue 1 with one covered neighbor proves that neighbor is a nest', () => {
    const w = opened(['n..', '...'], ['#oo', 'ooo']);
    expect(deduce(w.s).get('0,0')).toBe('threat');
  });

  it('a zero clue proves its covered neighbors safe', () => {
    const w = opened(['....', '...n'], ['oo##', 'oo##']);
    const k = deduce(w.s);
    expect(k.get('2,0')).toBe('safe');
    expect(k.get('2,1')).toBe('safe');
  });

  it('the classic pair: 1 over two cells and 1 over one of them proves the other safe', () => {
    // Row 0 covered; row 1 opened. Nest at (0,0).
    //  cell (0,1) sees (0,0),(1,0)      → 1
    //  cell (1,1) sees (0,0),(1,0),(2,0) → 1  ⇒ (2,0) is safe
    const w = opened(['n..', '...'], ['###', 'oo#']);
    w.cell(2, 1).revealed = false;
    const k = deduce(w.s);
    expect(k.get('2,0')).toBe('safe');
    expect(k.has('0,0')).toBe(false); // 50/50 between (0,0) and (1,0): never guessed
  });

  it('never claims a cell safe while the demon channel is ambiguous there', () => {
    const w = opened(['D..', '...'], ['###', 'oo#']);
    const k = deduce(w.s);
    expect(k.get('2,0')).toBe('safe');
    expect(k.has('0,0')).toBe(false);
    expect(k.has('1,0')).toBe(false); // nest-free for sure, but it may be the hatch
  });

  // 30 full 2-minute simulations: slow on shared CI runners.
  it('is never wrong on real generated fields', () => {
    for (let seed = 0; seed < 30; seed++) {
      const w = new World({ seed });
      w.apply({ type: 'placeCommand', x: 7, y: 9 });
      for (let x = 0; x < 14; x++) for (const y of [7, 11]) w.apply({ type: 'queueDig', x, y, force: true });
      run(w, 120);
      for (const [key, v] of w.knowledge()) {
        const [x, y] = key.split(',').map(Number);
        const c = w.cell(x, y);
        if (v === 'safe') expect(['nest', 'heavy_nest', 'hero_lair', 'boss_hatch', 'mine']).not.toContain(c.content);
        if (v === 'threat') expect(['nest', 'heavy_nest', 'hero_lair', 'mine']).toContain(c.content);
        if (v === 'demon') expect(c.content).toBe('boss_hatch');
      }
    }
  }, 30_000);
});

describe('assist modes', () => {
  it('full mode refuses to queue a known nest unless confirmed', () => {
    const w = handWorld(['......', '......', '......', '.....n']);
    w.apply({ type: 'placeCommand', x: 1, y: 1 });
    for (const c of w.s.cells) c.revealed = c.content !== 'nest';
    expect(w.apply({ type: 'queueDig', x: 5, y: 3 })).toEqual({ ok: false, reason: 'assist.known_danger' });
    expect(w.apply({ type: 'queueDig', x: 5, y: 3, force: true }).ok).toBe(true);
  });

  it('scanner mode shows knowledge only during a scan and recharges', () => {
    const w = new World({ seed: 4, assist: 'scanner' });
    w.apply({ type: 'placeCommand', x: 7, y: 9 });
    expect(w.visibleKnowledge(0).size).toBe(0);
    expect(w.apply({ type: 'scan' }).ok).toBe(true);
    expect(w.visibleKnowledge(0).size).toBeGreaterThan(0);
    expect(w.player(0).assist.charges).toBe(config.assist.scanner.maxCharges - 1);
    run(w, config.assist.scanner.markDurationSeconds + 0.1);
    expect(w.visibleKnowledge(0).size).toBe(0);
    run(w, config.assist.scanner.rechargeSeconds);
    expect(w.player(0).assist.charges).toBe(config.assist.scanner.maxCharges);
  });

  it('off mode shows nothing and blocks nothing', () => {
    const w = new World({ seed: 4, assist: 'off' });
    w.apply({ type: 'placeCommand', x: 7, y: 9 });
    expect(w.visibleKnowledge(0).size).toBe(0);
    expect(w.apply({ type: 'scan' }).ok).toBe(false);
  });
});
