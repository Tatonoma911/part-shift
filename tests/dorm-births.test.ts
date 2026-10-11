import { describe, expect, it } from 'vitest';
import { handWorld, residents } from './helpers';

describe('the Dormitory gives a new hero from the squad', () => {
  it('a finished Dormitory spawns one more active hero', () => {
    const w = handWorld(['.......', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 0, y: 1 });
    const before = residents(w).filter((u) => u.kind === 'ally').length;
    const p = w.s.players[0];
    p.energy = 999;
    w.apply({ type: 'build', building: 'home', x: 1, y: 0 } as never);
    const home = w.s.buildings.find((b) => b.type === 'home');
    expect(home).toBeDefined();
    w.s.buildings.forEach((b) => (b.complete = true));
    (w as unknown as { finishBuilding(b: unknown): void }).finishBuilding(home!);
    const after = residents(w).filter((u) => u.kind === 'ally').length;
    expect(after).toBe(before + 1);
  });
});
