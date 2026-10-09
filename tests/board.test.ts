import { describe, expect, it } from 'vitest';
import { Board } from '../src/core/board';
import { createRng } from '../src/core/rng';
import type { BoardConfig } from '../src/core/types';

const config: BoardConfig = {
  width: 11,
  height: 15,
  sites: { nest: 7, depot: 4, cache: 8, demon: 1 },
  safeRadius: 1,
  demonMinDistance: 5,
};

function count(board: Board, kind: string) {
  return board.cells.filter((c) => c.site === kind).length;
}

describe('Board generation', () => {
  it('buries exactly the configured sites', () => {
    const b = new Board(config);
    b.placeCore(5, 7, createRng(1));
    expect(count(b, 'nest')).toBe(7);
    expect(count(b, 'depot')).toBe(4);
    expect(count(b, 'cache')).toBe(8);
    expect(count(b, 'demon')).toBe(1);
  });

  it('keeps the starting area safe and opened, and the demon far away', () => {
    for (let seed = 0; seed < 50; seed++) {
      const b = new Board(config);
      b.placeCore(0, 0, createRng(seed));
      for (const c of [b.get(0, 0), ...b.neighbors(0, 0)]) {
        expect(c.site).toBe('none');
        expect(c.revealed).toBe(true);
      }
      const demon = b.cells.find((c) => c.site === 'demon')!;
      expect(Math.max(demon.x, demon.y)).toBeGreaterThanOrEqual(5);
    }
  });

  it('is deterministic for a seed', () => {
    const a = new Board(config);
    const b = new Board(config);
    a.placeCore(3, 3, createRng(42));
    b.placeCore(3, 3, createRng(42));
    expect(a.cells.map((c) => c.site)).toEqual(b.cells.map((c) => c.site));
  });
});

describe('Hints', () => {
  function emptyBoard() {
    return new Board({ ...config, width: 5, height: 5, sites: { nest: 0, depot: 0, cache: 0, demon: 0 } });
  }

  it('counts each channel separately over 8 neighbors, diagonals included', () => {
    const b = emptyBoard();
    b.get(0, 0).site = 'nest';
    b.get(2, 0).site = 'nest';
    b.get(0, 2).site = 'cache';
    b.get(2, 2).site = 'demon';
    b.get(1, 2).site = 'depot';
    b.get(4, 4).site = 'nest'; // not a neighbor
    expect(b.hints(1, 1)).toEqual({ nest: 2, depot: 1, cache: 1, demon: 1 });
  });

  it('drops the count when a site is resolved', () => {
    const b = emptyBoard();
    b.get(0, 0).site = 'cache';
    expect(b.hints(1, 1).cache).toBe(1);
    b.resolve(0, 0);
    expect(b.hints(1, 1).cache).toBe(0);
  });
});

describe('Reveal', () => {
  it('cascades through quiet cells and stops at hinted ones', () => {
    const b = new Board({ ...config, width: 5, height: 1, sites: { nest: 0, depot: 0, cache: 0, demon: 0 } });
    b.get(4, 0).site = 'nest';
    const { opened } = b.reveal(0, 0);
    // 0,1,2 are quiet; 3 touches the nest and opens but does not spread; 4 stays covered.
    expect(opened.map((c) => c.x).sort()).toEqual([0, 1, 2, 3]);
    expect(b.get(4, 0).revealed).toBe(false);
  });

  it('never cascades into a marked cell', () => {
    const b = new Board({ ...config, width: 3, height: 1, sites: { nest: 0, depot: 0, cache: 0, demon: 0 } });
    b.toggleMark(2, 0);
    b.reveal(0, 0);
    expect(b.get(2, 0).revealed).toBe(false);
  });

  it('only covered cells next to opened land are frontier', () => {
    const b = new Board({ ...config, width: 5, height: 1, sites: { nest: 0, depot: 0, cache: 0, demon: 0 } });
    b.get(2, 0).site = 'nest';
    b.reveal(0, 0);
    expect(b.isFrontier(2, 0)).toBe(true);
    expect(b.isFrontier(3, 0)).toBe(false);
  });
});
