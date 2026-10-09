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

  it('a 50/50 is caught: two hidden cells, one nest, one clue that sees both', () => {
    const w = new World({ seed: 1, width: 3, height: 2, difficulty: 'rush' });
    // The command opens columns 0–1; both clues in column 1 see the same two hidden cells.
    w.s.cells[2].content = 'nest';
    expect(solvable(w.s, [{ x: 0, y: 0 }])).toBe(false);
    w.s.cells[2].content = 'ground';
    expect(solvable(w.s, [{ x: 0, y: 0 }])).toBe(true);
  });
});
