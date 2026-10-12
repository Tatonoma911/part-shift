import { describe, expect, it } from 'vitest';
import { config } from '../src/core/data';
import { handWorld } from './helpers';

describe('dig priority rings (MVP_RULES §22.22)', () => {
  it('a tap on a queued closed cell cycles 1 → 2 → 3 → 0', () => {
    const w = handWorld(['.....']);
    for (const c of w.s.cells) c.revealed = true;
    w.cell(3, 0).revealed = false;
    w.apply({ type: 'placeCommand', x: 0, y: 0 });
    w.apply({ type: 'queueDig', x: 3, y: 0 });
    const seen: (number | undefined)[] = [];
    for (let i = 0; i < 4; i++) {
      w.apply({ type: 'setDigPriority', x: 3, y: 0 });
      seen.push(w.cell(3, 0).digPriority);
    }
    expect(seen).toEqual([1, 2, 3, undefined]);
    expect(config.digPriority.cycle).toEqual([0, 1, 2, 3, 0]);
  });
});
