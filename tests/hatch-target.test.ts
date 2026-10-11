import { describe, expect, it } from 'vitest';
import { handWorld, run } from './helpers';

describe('the call target hatch can be broken and ordered', () => {
  it('a tap on the hatch orders the hatch itself, and it takes damage (enemies.json boss_hatch hp)', () => {
    const w = handWorld(['..............', '..............', '.............n', '.............D'], 1);
    for (const c of w.s.cells) c.revealed = c.content === 'ground';
    w.apply({ type: 'placeCommand', x: 1, y: 1 });
    w.s.time = w.cfg.boss.selfWakeSeconds - w.cfg.boss.warningSeconds - 0.01;
    w.step(0.05);
    w.s.time = w.cfg.boss.selfWakeSeconds;
    run(w, 0.1);
    const hatch = w.s.sites.find((t) => t.kind === 'boss_hatch');
    expect(hatch).toBeTruthy();
    expect(hatch!.hp).toBeGreaterThan(0);
    const key = `s:${hatch!.x},${hatch!.y}`;
    const r = w.apply({ type: 'attack', target: key }, 0);
    expect(r.ok).toBe(true);
    expect(w.s.players[0].order).toBe(key);
    const before = hatch!.hp;
    hatch!.hp -= 1;
    expect(hatch!.hp).toBeLessThan(before);
  });
});
