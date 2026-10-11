import { buildings as buildingDefs, type SlotId } from '../core/data';
import type { Command } from '../core/commands';
import type { Building, Unit } from '../core/state';
import type { World } from '../core/world';

/** The card's trophy buttons, as plain commands (no Phaser here, so tests can run them). */
const cheb = (ax: number, ay: number, bx: number, by: number) => Math.max(Math.abs(Math.round(ax) - bx), Math.abs(Math.round(ay) - by));

export const SLOT_ORDER: SlotId[] = ['arm_left', 'arm_right', 'leg_left', 'leg_right', 'tail', 'wings'];
export const slotKind = (slot: SlotId) => (slot.startsWith('arm') ? 'arm' : slot.startsWith('leg') ? 'leg' : slot);

/** Our heroes in range of a building, that the trophy actions can reach. */
export function heroesInReach(world: World, b: Building, me: number, radius: number): Unit[] {
  return world.s.units.filter((u) => u.owner === me && u.kind === 'ally' && u.hp > 0 && cheb(u.x, u.y, b.x, b.y) <= radius);
}

/** The forge recolors the first trophy of the first hero in reach that has one (the card shows the result). */
export function recolorCommand(world: World, b: Building, me: number, tech: string): Command | null {
  const def = buildingDefs[b.type]?.recolor;
  if (!def) return null;
  const u = heroesInReach(world, b, me, def.radius).find((x) => Object.keys(x.parts).length > 0);
  const slot = u && (SLOT_ORDER.find((sl) => u.parts[sl]) ?? null);
  return u && slot ? { type: 'recolorTrophy', building: b.id, unit: u.id, slot, tech } : null;
}

/** The rotation centre moves the first trophy of a hero in reach to an empty slot of the same kind on another hero in reach. */
export function swapCommand(world: World, b: Building, me: number): Command | null {
  const def = buildingDefs[b.type]?.swap;
  if (!def) return null;
  const near = heroesInReach(world, b, me, def.radius);
  for (const from of near) {
    for (const fromSlot of SLOT_ORDER) {
      if (!from.parts[fromSlot]) continue;
      const to = near.find((h) => h !== from && Object.keys(h.parts).length < def.respectsMaxTrophies && SLOT_ORDER.some((sl) => slotKind(sl) === slotKind(fromSlot) && !h.parts[sl]));
      const toSlot = to && SLOT_ORDER.find((sl) => slotKind(sl) === slotKind(fromSlot) && !to.parts[sl]);
      if (to && toSlot) return { type: 'swapTrophy', building: b.id, from: from.id, fromSlot, to: to.id, toSlot };
    }
  }
  return null;
}
