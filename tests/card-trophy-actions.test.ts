import { describe, expect, it } from 'vitest';
import { recolorCommand, swapCommand } from '../src/game/trophyActions';
import { handWorld } from './helpers';
import type { Unit } from '../src/core/state';
import type { World } from '../src/core/world';

type Inner = { addBuilding(owner: number, type: string, x: number, y: number, complete: boolean): { id: number; hp: number; type: string; x: number; y: number } };
const inner = (w: World) => w as unknown as Inner;

/** A finished rotation centre at (3,5); hero A at (3,4) with an arm trophy; hero B at (5,4), both in reach. */
function rig(type: 'rotation_center' | 'forge') {
  const w = handWorld(['.......', '.......', '.......', '.......', '.......', '......n']);
  w.apply({ type: 'placeCommand', x: 0, y: 1 });
  const [a, b] = w.s.units.filter((u) => u.owner === 0 && u.kind === 'ally') as Unit[];
  Object.assign(a, { x: 3, y: 1, path: [], task: { type: 'idle' } });
  Object.assign(b, { x: 5, y: 1, path: [], task: { type: 'idle' } });
  a.parts = { arm_right: { id: 'thermo_arm', tier: 2 } };
  b.parts = {};
  const bld = inner(w).addBuilding(0, type, 3, 3, true);
  return { w, a, b, bld };
}

describe('card trophy actions (what the card buttons send)', () => {
  it('the swap picks a trophy and an empty matching slot in reach', () => {
    const { w, a, b, bld } = rig('rotation_center');
    const cmd = swapCommand(w, bld as never, 0);
    expect(cmd).toEqual({ type: 'swapTrophy', building: bld.id, from: a.id, fromSlot: 'arm_right', to: b.id, toSlot: 'arm_left' });
    expect(w.apply(cmd!, 0).ok).toBe(true);
    expect(b.parts.arm_left).toEqual({ id: 'thermo_arm', tier: 2 });
  });

  it('no swap when no other hero in reach has a free matching slot', () => {
    const { w, b, bld } = rig('rotation_center');
    b.x = 9;
    expect(swapCommand(w, bld as never, 0)).toBeNull();
  });

  it('the recolor picks the first trophy of a hero in reach', () => {
    const { w, a, bld } = rig('forge');
    const cmd = recolorCommand(w, bld as never, 0, 'cryo');
    expect(cmd).toEqual({ type: 'recolorTrophy', building: bld.id, unit: a.id, slot: 'arm_right', tech: 'cryo' });
    expect(w.apply(cmd!, 0).ok).toBe(true);
    expect(a.parts.arm_right?.id).toBe('cryo_arm');
  });
});
