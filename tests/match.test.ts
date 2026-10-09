import { describe, expect, it } from 'vitest';
import { cheb } from '../src/core/grid';
import { boardFor, commandSpots, createMatch } from '../src/core/match';
import { compact, diff, patch } from '../src/net/patch';

const names = (n: number) => Array.from({ length: n }, (_, i) => `P${i + 1}`);

describe('online match setup (MVP_RULES §14)', () => {
  it('board size follows the player count', () => {
    expect(boardFor(2)).toEqual({ width: 18, height: 22 });
    expect(boardFor(4)).toEqual({ width: 22, height: 26 });
  });

  for (const n of [2, 3, 4]) {
    it(`${n} players: every center stands, with the same surroundings mirrored`, () => {
      const w = createMatch({ seed: 7 + n, mode: 'coop', names: names(n) });
      const spots = commandSpots(n, w.s.width, w.s.height);
      expect(w.s.players.every((p) => p.command !== null && p.alive)).toBe(true);
      const [a, ...rest] = spots;
      for (const b of rest) {
        for (let dy = -4; dy <= 4; dy++) {
          for (let dx = -4; dx <= 4; dx++) {
            const sx = a.x + dx;
            const sy = a.y + dy;
            const tx = b.x + dx * a.fx * b.fx;
            const ty = b.y + dy * a.fy * b.fy;
            const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w.s.width && y < w.s.height;
            if (!inside(sx, sy) || !inside(tx, ty)) continue;
            expect(w.cell(tx, ty).content).toBe(w.cell(sx, sy).content);
          }
        }
      }
      // The Demon sleeps away from every center.
      const hatch = w.s.cells.findIndex((c) => c.content === 'demon_hatch');
      const hx = hatch % w.s.width;
      const hy = Math.floor(hatch / w.s.width);
      for (const p of spots) expect(cheb(p.x, p.y, hx, hy)).toBeGreaterThan(4);
    });
  }

  it('coop: the Demon has extra HP per extra player; FFA does not', () => {
    expect(createMatch({ seed: 1, mode: 'coop', names: names(3) }).s.demon.hpScale).toBeCloseTo(2.2);
    expect(createMatch({ seed: 1, mode: 'ffa', names: names(3) }).s.demon.hpScale).toBe(1);
  });

  it('coop: one forfeit leaves the others playing; all gone is a defeat', () => {
    const w = createMatch({ seed: 3, mode: 'coop', names: names(2) });
    w.forfeit(0);
    w.tick(0.05);
    expect(w.s.players[0].alive).toBe(false);
    expect(w.s.outcome).toBe('playing');
    w.forfeit(1);
    w.tick(0.05);
    expect(w.s.outcome).toBe('defeat');
  });

  it('FFA: the last center standing wins', () => {
    const w = createMatch({ seed: 4, mode: 'ffa', names: names(3) });
    w.forfeit(0);
    w.forfeit(2);
    w.tick(0.05);
    expect(w.s.outcome).toBe('victory');
    expect(w.s.match?.winner).toBe(1);
  });

  it('attack orders: rivals only in FFA, never allies in coop', () => {
    const coop = createMatch({ seed: 5, mode: 'coop', names: names(2) });
    const allyCenter = `b:${coop.s.players[1].command}`;
    expect(coop.apply({ type: 'attack', target: allyCenter }, 0).ok).toBe(false);
    const ffa = createMatch({ seed: 5, mode: 'ffa', names: names(2) });
    expect(ffa.apply({ type: 'attack', target: `b:${ffa.s.players[1].command}` }, 0).ok).toBe(true);
    expect(ffa.apply({ type: 'attack', target: `b:${ffa.s.players[0].command}` }, 0).ok).toBe(false);
  });
});

describe('state patches', () => {
  it('a client that applies every patch ends with the server state', () => {
    const w = createMatch({ seed: 11, mode: 'coop', names: names(2) });
    let sent = structuredClone(w.s);
    const client = compact(structuredClone(w.s));
    // Both players dig around their centers for a few minutes of game time.
    for (const p of w.s.players) {
      const c = w.building(p.command)!;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) w.apply({ type: 'queueDig', x: c.x + dx, y: c.y + dy, force: true }, p.id);
    }
    for (let i = 0; i < 20 * 180; i++) {
      w.tick(0.05);
      const d = diff(sent, w.s);
      sent = structuredClone(w.s);
      if (d) patch(client, structuredClone(d));
    }
    expect(w.s.units.length).toBeGreaterThan(2);
    expect(client).toEqual(compact(w.s));
  });
});
