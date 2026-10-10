import Phaser from 'phaser';
import { buildings as buildingDefs } from '../core/data';
import type { World } from '../core/world';
import buildingsJson from '../data/design/buildings.json';
import { CELL, STEP } from './layout';
import { TECH_HEX, techOf } from './Vitals';

/**
 * «Здание должно чувствоваться» (Антон 10.10 10:49, BUILDINGS.md §9.1): every building tints the ground
 * where it acts, in its own colour (buildings.json → feel.groundTint, feel.tintRadius, feelRules.tintAlpha).
 * 12 % at rest, 30 % when the building is tapped or its ghost is being placed; each zone keeps its own border,
 * so overlapping zones stay readable. Jammer and Watchtower also tint closed blocks.
 */

type Feel = { groundTint?: string; tintRadius?: number | string; tintOverClosedCells?: boolean };
type Def = Record<string, unknown> & { id: string; feel?: Feel };
type Rules = {
  buildings: Def[];
  feelRules?: { tintAlpha?: { idle: number; selected: number } };
  upgrades?: { perBuilding?: Record<string, { levels?: Record<string, Record<string, unknown>> }> };
};
const RULES = buildingsJson as unknown as Rules;
const DEFS = new Map(RULES.buildings.map((b) => [b.id, b]));
export const TINT_ALPHA = RULES.feelRules?.tintAlpha ?? { idle: 0.12, selected: 0.3 };

/** Reads "aura.radius" or "healAura.radius / autoAttack.range" (the larger one) from a building's table. */
function radiusFrom(def: Def, ref: number | string | undefined): number {
  if (typeof ref === 'number') return ref;
  if (!ref) return 0;
  let best = 0;
  for (const path of ref.split('/').map((p) => p.trim())) {
    let v: unknown = def;
    for (const k of path.split('.')) v = v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined;
    if (typeof v === 'number') best = Math.max(best, v);
  }
  return best;
}

export interface Zone {
  color: number;
  radius: number;
  overClosed: boolean;
}

/** The zone of a building at a level (upgrades can widen it: auraRadius, healAuraRadius, radius, autoAttackRange). */
export function zoneOf(type: string, level = 1, hero?: string, chosenTech?: string): Zone | null {
  const def = DEFS.get(type);
  const feel = def?.feel;
  if (!def || !feel?.groundTint) return null;
  let radius = radiusFrom(def, feel.tintRadius);
  const lv = RULES.upgrades?.perBuilding?.[type]?.levels ?? {};
  for (let n = 2; n <= level; n++) {
    const l = lv[String(n)] ?? {};
    for (const k of ['auraRadius', 'healAuraRadius', 'radius', 'autoAttackRange']) if (typeof l[k] === 'number') radius = Math.max(radius, l[k] as number);
  }
  const tint = feel.groundTint;
  const color = tint === 'heroTech' ? (hero ? (TECH_HEX[techOf(hero)] ?? 0xffffff) : 0xffffff) : tint === 'chosenTech' ? (TECH_HEX[chosenTech ?? ''] ?? 0xff8a3d) : Phaser.Display.Color.HexStringToColor(tint).color;
  return { color, radius, overClosed: !!feel.tintOverClosedCells };
}

/**
 * Paints one zone: cells within `radius` (Chebyshev, like the rules) around (x, y), and a border on its outer edge.
 * `bx, by` = board origin in the board camera. Closed blocks are skipped unless the zone acts on them.
 */
export function paintZone(g: Phaser.GameObjects.Graphics, world: World, bx: number, by: number, x: number, y: number, zone: Zone, alpha: number): void {
  const s = world.s;
  const r = zone.radius;
  const inZone = (cx: number, cy: number) => cx >= 0 && cy >= 0 && cx < s.width && cy < s.height && Math.max(Math.abs(cx - x), Math.abs(cy - y)) <= r && (zone.overClosed || world.cell(cx, cy).revealed);
  g.fillStyle(zone.color, alpha);
  for (let cy = y - r; cy <= y + r; cy++)
    for (let cx = x - r; cx <= x + r; cx++) {
      if (!inZone(cx, cy)) continue;
      const px = bx + cx * STEP;
      const py = by + cy * STEP;
      // Fill the gutter between cells too, so a zone reads as one patch of ground.
      g.fillRect(px - (inZone(cx - 1, cy) ? STEP - CELL : 0), py - (inZone(cx, cy - 1) ? STEP - CELL : 0), CELL + (inZone(cx - 1, cy) ? STEP - CELL : 0), CELL + (inZone(cx, cy - 1) ? STEP - CELL : 0));
    }
  // Border: only the outer edges, slightly stronger than the fill.
  g.lineStyle(alpha >= TINT_ALPHA.selected ? 3 : 2, zone.color, Math.min(1, alpha * 3));
  for (let cy = y - r; cy <= y + r; cy++)
    for (let cx = x - r; cx <= x + r; cx++) {
      if (!inZone(cx, cy)) continue;
      const px = bx + cx * STEP;
      const py = by + cy * STEP;
      if (!inZone(cx, cy - 1)) g.lineBetween(px, py, px + CELL, py);
      if (!inZone(cx, cy + 1)) g.lineBetween(px, py + CELL, px + CELL, py + CELL);
      if (!inZone(cx - 1, cy)) g.lineBetween(px, py, px, py + CELL);
      if (!inZone(cx + 1, cy)) g.lineBetween(px + CELL, py, px + CELL, py + CELL);
    }
}

/**
 * All zones of one player's buildings: idle ones faint, the tapped one (`selected`) bright.
 * While a ghost is placed, its zone is drawn bright at the ghost's cell.
 */
export function paintZones(
  g: Phaser.GameObjects.Graphics,
  world: World,
  me: number,
  bx: number,
  by: number,
  selected: number | null,
  ghost: { type: string; x: number; y: number; hero?: string } | null,
): void {
  for (const b of world.s.buildings) {
    if (b.owner !== me || !b.complete) continue;
    const live = b as typeof b & { level?: number; hero?: string; tech?: string };
    const z = zoneOf(b.type, live.level ?? 1, live.hero, live.tech);
    if (z) paintZone(g, world, bx, by, b.x, b.y, z, b.id === selected ? TINT_ALPHA.selected : TINT_ALPHA.idle);
  }
  if (ghost) {
    // The land it will free (territory) in seam blue, then its own zone on top.
    const land = buildingDefs[ghost.type]?.territoryRadius ?? 0;
    if (land > 0) paintZone(g, world, bx, by, ghost.x, ghost.y, { color: 0x57d8f2, radius: land, overClosed: true }, 0.16);
    const z = zoneOf(ghost.type, 1, ghost.hero);
    if (z) paintZone(g, world, bx, by, ghost.x, ghost.y, z, TINT_ALPHA.selected);
  }
}
