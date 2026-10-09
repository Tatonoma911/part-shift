/**
 * Typed view of the game designer's tables (src/data/design, synced from
 * design/data). Code reads only these; balance changes never touch code.
 */
import buildingsJson from '../data/design/buildings.json';
import configJson from '../data/design/config.json';
import enemiesJson from '../data/design/enemies.json';
import mapgenJson from '../data/design/mapgen.json';
import multiplayerJson from '../data/design/multiplayer.json';
import partsJson from '../data/design/parts.json';
import unitsJson from '../data/design/units.json';

export type Tech = 'thermo' | 'cryo' | 'volt' | 'impact' | 'toxin';
export type PartSlotKind = 'arm' | 'leg' | 'tail';
export type SlotId = 'arm_left' | 'arm_right' | 'leg_left' | 'leg_right' | 'tail';

export interface PartTier {
  tier: number;
  damage?: number;
  defense?: number;
  hp?: number;
  speed?: number;
  burnDps?: number;
  burnSeconds?: number;
  slowPercent?: number;
  slowSeconds?: number;
  chainTargets?: number;
  chainDamageFactor?: number;
  chainRange?: number;
  splashRadius?: number;
  splashFactor?: number;
}

export interface PartDef {
  id: string;
  slot: PartSlotKind;
  tech: string;
  tiers: PartTier[];
}

export interface BuildingDef {
  id: string;
  buildable: boolean;
  cost: number;
  buildSeconds: number;
  hp: number;
  defense: number;
  residentSlots?: number;
  operatorSlots?: number;
  territoryRadius?: number;
  isKeep?: boolean;
  produce?: { energy: number; everySeconds: number; perOperator: boolean };
  aura?: {
    radius: number;
    targets: string[];
    productionSpeedMultiplier?: number;
    stacks?: boolean;
    healAmount?: number;
    healEverySeconds?: number;
  };
  defenderCapacity?: number;
  trainsDefenders?: boolean;
}

export interface UnitStats {
  hp: number;
  damage: number;
  defense: number;
  attackSeconds: number;
  range: number;
  speed: number;
}

export interface EnemyDef extends UnitStats {
  id: string;
  boss?: boolean;
  part: {
    slotWeights?: { arm: number; leg: number };
    armByTech?: string;
    arm?: string;
    leg?: string;
    tierOffset?: number;
    fixed?: string;
  };
  partDropChance: number;
  reward: number;
  special?: {
    id: string;
    windupSeconds: number;
    range: number;
    blastSeconds: number;
    cooldownSeconds: number;
    hotGroundSeconds: number;
    hotGroundDps: number;
  };
}

export interface SiteDef {
  id: string;
  clueChannel: 'threat' | 'demon' | 'finds';
  hp?: number;
  defense?: number;
  spawns?: string;
  initialSpawn?: number;
  spawnSeconds?: number;
  respawnAfterDeathSeconds?: number;
  maxAlive?: number;
  reward?: number;
  techPool?: Tech[];
  tech?: Tech;
  onReveal?: { energy?: number; resident?: number; permanentSlotOnCommand?: boolean };
}

const SUPPORTED_VERSIONS = ['0.1', '0.2'];
for (const [name, table] of Object.entries({
  buildingsJson,
  configJson,
  enemiesJson,
  mapgenJson,
  multiplayerJson,
  partsJson,
  unitsJson,
})) {
  const v = (table as { version?: string }).version;
  if (!v || !SUPPORTED_VERSIONS.includes(v)) throw new Error(`${name}: unsupported table version ${v}`);
}

export const config = configJson;
export const mapgen = mapgenJson;
export const multiplayer = multiplayerJson;

export const buildings: Record<string, BuildingDef> = Object.fromEntries(
  (buildingsJson.buildings as BuildingDef[]).map((b) => [b.id, b]),
);
export const sites: Record<string, SiteDef> = Object.fromEntries((enemiesJson.sites as SiteDef[]).map((s) => [s.id, s]));
export const enemies: Record<string, EnemyDef> = Object.fromEntries(
  (enemiesJson.enemies as EnemyDef[]).map((e) => [e.id, e]),
);
export const parts: Record<string, PartDef> = Object.fromEntries((partsJson.parts as PartDef[]).map((p) => [p.id, p]));

const unitList = unitsJson.units as (Partial<UnitStats> & { id: string; hp: number; speed: number })[];
function unitStats(id: string): UnitStats {
  const u = unitList.find((x) => x.id === id);
  if (!u) throw new Error(`unknown unit ${id}`);
  return { hp: u.hp, damage: u.damage ?? 0, defense: u.defense ?? 0, attackSeconds: u.attackSeconds ?? 1, range: u.range ?? 1, speed: u.speed };
}
export const residentStats = unitStats('resident');
export const defenderStats = unitStats('defender');
export const DEFENDER_SLOTS = (unitsJson.units.find((u) => u.id === 'defender') as unknown as { slots: SlotId[] }).slots;

export const BUILDABLE = Object.values(buildings)
  .filter((b) => b.buildable)
  .map((b) => b.id);

export function partTier(partId: string, tier: number): PartTier {
  const def = parts[partId];
  return def.tiers.find((t) => t.tier === tier) ?? def.tiers[def.tiers.length - 1];
}
