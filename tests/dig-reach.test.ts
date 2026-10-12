import { describe, expect, it } from 'vitest';
import { handWorld, run } from './helpers';

describe('digs need a way for heroes, not a way right now', () => {
  it('accepts a far cell that heroes will reach once the ground in between is dug', () => {
    const w = handWorld(['.......', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 0, y: 1 });
    expect(w.apply({ type: 'queueDig', x: 5, y: 1 })).toEqual({ ok: true });
    expect(w.player(0).queue).toContain('5,1');
  });

  it('refuses a cell no way can ever reach (walled in by water), and says so', () => {
    const w = handWorld(['.~.....', '.~.....', '.~.....']);
    w.apply({ type: 'placeCommand', x: 0, y: 1 });
    expect(w.apply({ type: 'queueDig', x: 3, y: 1 })).toEqual({ ok: false, reason: 'dig.unreachable' });
  });

  it('a queued far cell is dug once heroes can reach it', () => {
    const w = handWorld(['.......', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 0, y: 1 });
    // The player picks the whole lane in advance; heroes take the cells one after another.
    for (const x of [2, 3, 4]) expect(w.apply({ type: 'queueDig', x, y: 1 }).ok).toBe(true);
    run(w, 240);
    expect(w.cell(4, 1).revealed).toBe(true);
  });

  it('a forced queue (confirmed tap) still goes in', () => {
    const w = handWorld(['.......', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 0, y: 1 });
    expect(w.apply({ type: 'queueDig', x: 5, y: 1, force: true }).ok).toBe(true);
  });
});
