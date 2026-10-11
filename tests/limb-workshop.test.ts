import { describe, expect, it } from 'vitest';
import { buildings as buildingDefs } from '../src/core/data';
import { handWorld } from './helpers';
import type { Unit } from '../src/core/state';
import type { World } from '../src/core/world';

type Inner = {
  addBuilding(owner: number, type: string, x: number, y: number, complete: boolean): { id: number; hp: number };
};
const inner = (w: World) => w as unknown as Inner;

/** Command at (0,1); two of our heroes at (2,1) and (3,1); a finished limb workshop at (2,0). */
function world() {
  const w = handWorld(['.......', '.......', '......n']);
  w.apply({ type: 'placeCommand', x: 0, y: 1 });
  const [a, b] = w.s.units.filter((x) => x.kind === 'ally').slice(0, 2) as Unit[];
  Object.assign(a, { x: 2, y: 1, path: [], task: { type: 'idle' } });
  Object.assign(b, { x: 3, y: 1, path: [], task: { type: 'idle' } });
  a.parts = {};
  b.parts = {};
  const bld = inner(w).addBuilding(0, 'limb_workshop', 2, 0, true);
  return { w, a, b, bld };
}

const run = (w: World, seconds: number) => {
  for (let t = 0; t < seconds; t += 0.05) w.step(0.05);
};

describe('limb workshop (buildings.json limbMaker)', () => {
  it('needs an element picked before it makes anything, and only takes one of the five', () => {
    const { w, a, bld } = world();
    expect(w.apply({ type: 'setLimbTech', building: bld.id, tech: 'void' as string }).ok).toBe(false);
    expect(w.apply({ type: 'setLimbTech', building: bld.id, tech: 'cryo' }).ok).toBe(true);
    run(w, buildingDefs.limb_workshop.limbMaker!.everySeconds + 1);
    expect(a.parts.arm_left).toEqual({ id: 'cryo_arm', tier: 2 });
  });

  it('makes nothing without an element picked', () => {
    const { w, a, b, bld } = world();
    run(w, 200);
    expect(Object.keys(a.parts).length + Object.keys(b.parts).length).toBe(0);
    expect(bld.id).toBeGreaterThan(0);
  });

  it('spreads arms and legs over time; each element has its own legs now (QA-053)', () => {
    const { w, a, b, bld } = world();
    w.apply({ type: 'setLimbTech', building: bld.id, tech: 'impact' });
    const every = buildingDefs.limb_workshop.limbMaker!.everySeconds;
    run(w, every * 3 + 1);
    const got = [...Object.values(a.parts), ...Object.values(b.parts)];
    // Both kinds come out, whatever the cycle count: arms and legs of the element.
    expect(new Set(got.map((p) => p!.id))).toEqual(new Set(['impact_arm', 'impact_leg']));
    expect(got.every((p) => p!.tier === 2)).toBe(true);
  });
});
