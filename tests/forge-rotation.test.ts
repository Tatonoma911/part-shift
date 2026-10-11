import { describe, expect, it } from 'vitest';
import { buildings as buildingDefs } from '../src/core/data';
import { handWorld } from './helpers';
import type { Unit } from '../src/core/state';
import type { World } from '../src/core/world';

type Inner = {
  addBuilding(owner: number, type: string, x: number, y: number, complete: boolean): { id: number; hp: number };
};
const inner = (w: World) => w as unknown as Inner;

/** Command at (0,1); two of our heroes at (2,1) and (3,1); a finished building at (2,0). */
function world(type: 'forge' | 'rotation_center') {
  const w = handWorld(['.......', '.......', '......n']);
  w.apply({ type: 'placeCommand', x: 0, y: 1 });
  const [a, b] = w.s.units.filter((x) => x.kind === 'ally').slice(0, 2) as Unit[];
  Object.assign(a, { x: 2, y: 1, path: [], task: { type: 'idle' } });
  Object.assign(b, { x: 3, y: 1, path: [], task: { type: 'idle' } });
  a.parts = { arm_right: { id: 'thermo_arm', tier: 2 } };
  b.parts = {};
  const bld = inner(w).addBuilding(0, type, 2, 0, true);
  w.s.players[0].energy = 500;
  return { w, a, b, bld };
}

describe('forge recolor (buildings.json forge.recolor)', () => {
  it('changes one trophy to another element, keeping its tier, and costs energy', () => {
    const { w, a, bld } = world('forge');
    const r = buildingDefs.forge.recolor!;
    const before = w.s.players[0].energy;
    expect(w.apply({ type: 'recolorTrophy', building: bld.id, unit: a.id, slot: 'arm_right', tech: 'cryo' }).ok).toBe(true);
    expect(a.parts.arm_right).toEqual({ id: 'cryo_arm', tier: 2 });
    expect(w.s.players[0].energy).toBe(before - r.energyCost);
  });

  it('refuses the same element, a hero out of range, and a second recolor during the cooldown', () => {
    const { w, a, b, bld } = world('forge');
    expect(w.apply({ type: 'recolorTrophy', building: bld.id, unit: a.id, slot: 'arm_right', tech: 'thermo' }).ok).toBe(false);
    b.parts = { arm_right: { id: 'thermo_arm', tier: 1 } };
    b.x = 9;
    expect(w.apply({ type: 'recolorTrophy', building: bld.id, unit: b.id, slot: 'arm_right', tech: 'cryo' }).ok).toBe(false);
    b.x = 3;
    expect(w.apply({ type: 'recolorTrophy', building: bld.id, unit: a.id, slot: 'arm_right', tech: 'cryo' }).ok).toBe(true);
    expect(w.apply({ type: 'recolorTrophy', building: bld.id, unit: b.id, slot: 'arm_right', tech: 'volt' }).ok).toBe(false);
    for (let t = 0; t < buildingDefs.forge.recolor!.cooldownSeconds + 1; t += 0.05) w.step(0.05);
    expect(w.apply({ type: 'recolorTrophy', building: bld.id, unit: b.id, slot: 'arm_right', tech: 'volt' }).ok).toBe(true);
  });
});

describe('rotation centre swap (buildings.json rotation_center.swap)', () => {
  it('moves a trophy to an empty slot of another hero, and the hero it left gets its own limb back', () => {
    const { w, a, b, bld } = world('rotation_center');
    a.lostLimbs = ['arm'];
    b.lostLimbs = ['arm'];
    expect(w.apply({ type: 'swapTrophy', building: bld.id, from: a.id, fromSlot: 'arm_right', to: b.id, toSlot: 'arm_left' }).ok).toBe(true);
    expect(a.parts.arm_right).toBeUndefined();
    expect(b.parts.arm_left).toEqual({ id: 'thermo_arm', tier: 2 });
    expect(a.lostLimbs).toBeUndefined();
    expect(b.lostLimbs).toBeUndefined();
  });

  it('trades two trophies of the same slot kind, and refuses a mismatch', () => {
    const { w, a, b, bld } = world('rotation_center');
    b.parts = { arm_left: { id: 'cryo_arm', tier: 1 } };
    expect(w.apply({ type: 'swapTrophy', building: bld.id, from: a.id, fromSlot: 'arm_right', to: b.id, toSlot: 'leg_left' }).ok).toBe(false);
    expect(w.apply({ type: 'swapTrophy', building: bld.id, from: a.id, fromSlot: 'arm_right', to: b.id, toSlot: 'arm_left' }).ok).toBe(true);
    expect(a.parts.arm_right).toEqual({ id: 'cryo_arm', tier: 1 });
    expect(b.parts.arm_left).toEqual({ id: 'thermo_arm', tier: 2 });
  });

  it('respects the trophy cap of a hero and the cooldown, which costs energy', () => {
    const { w, a, b, bld } = world('rotation_center');
    const cap = buildingDefs.rotation_center.swap!.respectsMaxTrophies;
    b.parts = { arm_left: { id: 'cryo_arm', tier: 1 }, leg_left: { id: 'thermo_arm', tier: 1 }, leg_right: { id: 'cryo_arm', tier: 1 } };
    b.parts.wings = { id: 'thermo_arm', tier: 1 };
    expect(Object.keys(b.parts).length).toBe(cap);
    expect(w.apply({ type: 'swapTrophy', building: bld.id, from: a.id, fromSlot: 'arm_right', to: b.id, toSlot: 'arm_right' }).ok).toBe(false);
    const energy = w.s.players[0].energy;
    expect(w.apply({ type: 'swapTrophy', building: bld.id, from: a.id, fromSlot: 'arm_right', to: a.id, toSlot: 'arm_right' }).ok).toBe(false);
    b.parts = {};
    expect(w.apply({ type: 'swapTrophy', building: bld.id, from: a.id, fromSlot: 'arm_right', to: b.id, toSlot: 'arm_left' }).ok).toBe(true);
    expect(w.s.players[0].energy).toBe(energy - buildingDefs.rotation_center.swap!.energyCost);
    expect(w.apply({ type: 'swapTrophy', building: bld.id, from: b.id, fromSlot: 'arm_left', to: a.id, toSlot: 'arm_right' }).ok).toBe(false);
  });
});

describe('hero boost cooldown', () => {
  it('counts down, so the boost can be used again after its cooldown', () => {
    const w = handWorld(['.......', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 0, y: 1 });
    const cmd = w.s.buildings.find((x) => x.type === 'command')!;
    expect(w.apply({ type: 'heroBoost', building: cmd.id }).ok).toBe(true);
    expect(w.apply({ type: 'heroBoost', building: cmd.id }).ok).toBe(false);
    for (let t = 0; t < 61; t += 0.05) w.step(0.05);
    expect(w.apply({ type: 'heroBoost', building: cmd.id }).ok).toBe(true);
  });
});
