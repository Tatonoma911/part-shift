import { describe, expect, it } from 'vitest';
import { handWorld } from './helpers';

describe('digs need a path for heroes', () => {
  it('refuses a plain tap on a cell no hero can reach, accepts one next to opened ground', () => {
    const w = handWorld(['.......', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 0, y: 1 });
    expect(w.apply({ type: 'queueDig', x: 5, y: 1 }).ok).toBe(false);
    expect(w.apply({ type: 'queueDig', x: 5, y: 1 })).toEqual({ ok: false, reason: 'dig.unreachable' });
    expect(w.apply({ type: 'queueDig', x: 2, y: 1 }).ok).toBe(true);
  });

  it('a forced queue (confirmed tap) still goes in', () => {
    const w = handWorld(['.......', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 0, y: 1 });
    expect(w.apply({ type: 'queueDig', x: 5, y: 1, force: true }).ok).toBe(true);
  });
});
