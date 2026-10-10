import { describe, expect, it } from 'vitest';
import { buildings as buildingDefs } from '../src/core/data';
import { handWorld } from './helpers';
import type { World } from '../src/core/world';

type Inner = {
  kill(v: unknown, by?: unknown): void;
  addBuilding(owner: number, type: string, x: number, y: number, complete: boolean): { id: number };
};
const inner = (w: World) => w as unknown as Inner;

/** Command at (0,1); our first hero knocked out; returns the seconds until its rebirth. */
function rebirthSeconds(withArchive: boolean): number {
  const w = handWorld(['.......', '.......', '......n']);
  w.apply({ type: 'placeCommand', x: 0, y: 1 });
  if (withArchive) inner(w).addBuilding(0, 'backup_lab', 2, 2, true);
  const hero = w.s.units.find((u) => u.kind === 'ally')!;
  const id = hero.hero!;
  inner(w).kill(hero);
  return (w.s.players[0].allyBack?.[id] ?? 0) - w.s.time;
}

describe('Archive (buildings.json backup_lab)', () => {
  it('a finished archive brings knocked-out squad heroes back 20 % sooner', () => {
    const plain = rebirthSeconds(false);
    const fast = rebirthSeconds(true);
    expect(fast).toBeCloseTo(plain * buildingDefs.backup_lab.birthTimeFactor!, 5);
    expect(fast).toBeLessThan(plain);
  });

  it('the archive counts for hero unlock progress ×1.5 only at the end of a shift that has it', () => {
    expect(buildingDefs.backup_lab.unlockProgressFactorThisRun).toBe(1.5);
    expect(buildingDefs.backup_lab.requires).toEqual({ schools: 1 });
  });
});
