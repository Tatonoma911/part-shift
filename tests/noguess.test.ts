import { describe, expect, it } from 'vitest';
import { solvable } from '../src/core/noguess';
import { World } from '../src/core/world';

describe('no-guess boards (MVP_RULES §15.2)', () => {
  it('on Смена every generated field opens to the end by logic alone', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const w = new World({ seed, difficulty: 'shift' });
      const cmd = { x: Math.floor(w.s.width / 2), y: Math.floor(w.s.height / 2) };
      w.apply({ type: 'placeCommand', ...cmd });
      const fresh = structuredClone(w.s);
      for (const c of fresh.cells) c.revealed = false;
      expect(solvable(fresh, [cmd]), `seed ${seed}`).toBe(true);
    }
  });

  it('mines v0.2: Смена/Стажёр fields with 14/8 mines + nests + lairs pass the no-guess check within the retry budget; Аврал places 20', () => {
    const attempts: number[] = [];
    for (const [difficulty, mines] of [['shift', 14], ['intern', 8], ['rush', 20]] as const) {
      for (let seed = 101; seed <= 115; seed++) {
        const w = new World({ seed, difficulty });
        const cmd = { x: Math.floor(w.s.width / 2), y: Math.floor(w.s.height / 2) };
        w.apply({ type: 'placeCommand', ...cmd });
        expect(w.s.cells.filter((c) => c.content === 'mine').length, `${difficulty} seed ${seed}`).toBe(mines);
        expect(w.s.cells.some((c) => c.content === 'nest' || c.content === 'heavy_nest')).toBe(true);
        if (difficulty === 'rush') continue; // Аврал has no no-guess guarantee (difficulty.json noGuessBoard: false)
        // NO_GUESS_ATTEMPTS is 200; the last attempt is accepted as is, so stay clearly below it.
        expect(w.genAttempts, `${difficulty} seed ${seed}`).toBeLessThan(200);
        const fresh = structuredClone(w.s);
        for (const c of fresh.cells) c.revealed = false;
        expect(solvable(fresh, [cmd]), `${difficulty} seed ${seed}`).toBe(true);
        attempts.push(w.genAttempts);
      }
    }
    // Shown in the test log for the balance notes.
    console.log(`no-guess attempts per field: max ${Math.max(...attempts)}, mean ${(attempts.reduce((a, b) => a + b, 0) / attempts.length).toFixed(1)}`);
  });

  it('mapgen takes a mine / survivor-site count override (campaign shifts, quick mode)', () => {
    const w = new World({ seed: 3, difficulty: 'shift', rules: { counts: { mine: 6, survivor: 3 } } });
    w.apply({ type: 'placeCommand', x: Math.floor(w.s.width / 2), y: Math.floor(w.s.height / 2) });
    expect(w.s.cells.filter((c) => c.content === 'mine').length).toBe(6);
    expect(w.s.cells.filter((c) => c.content === 'survivor').length).toBe(3);
  });

  it('a 50/50 is caught: two hidden cells, one nest, one clue that sees both', () => {
    const w = new World({ seed: 1, width: 3, height: 2, difficulty: 'rush' });
    // The command opens columns 0–1; both clues in column 1 see the same two hidden cells.
    w.s.cells[2].content = 'nest';
    expect(solvable(w.s, [{ x: 0, y: 0 }])).toBe(false);
    w.s.cells[2].content = 'ground';
    expect(solvable(w.s, [{ x: 0, y: 0 }])).toBe(true);
  });
});
