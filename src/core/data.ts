/**
 * Typed view of the game designer's tables (src/data/design, synced from
 * design/data). Code reads only these; balance changes never touch code.
 */
import boonsJson from '../data/design/boons.json';
import buildingsJson from '../data/design/buildings.json';
import configJson from '../data/design/config.json';
import difficultyJson from '../data/design/difficulty.json';
import elementsJson from '../data/design/elements.json';
import enemiesJson from '../data/design/enemies.json';
import heroesJson from '../data/design/heroes.json';
import mapgenJson from '../data/design/mapgen.json';
import multiplayerJson from '../data/design/multiplayer.json';
import partsJson from '../data/design/parts.json';
import unitsJson from '../data/design/units.json';

export type Tech = 'thermo' | 'cryo' | 'volt' | 'impact' | 'toxin';
/** Attack element: one of the five techs, or bare hands / buildings. */
export type AttackTech = Tech | 'kinetic';
export type PartSlotKind = 'arm' | 'leg' | 'tail' | 'wings';
export type SlotId = 'arm_left' | 'arm_right' | 'leg_left' | 'leg_right' | 'tail' | 'wings';
export type Resist = Record<Tech, number>;

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
  armorShred?: number;
  shredSeconds?: number;
  flying?: boolean;
  regenPerSec?: number;
  healSelfOnHit?: number;
  attackSpeedFactor?: number;
}

export interface PartDef {
  id: string;
  slot: PartSlotKind;
  tech: string;
  tiers: PartTier[];
  /** Set on parts that drop from a hero (heroes.json drops). */
  hero?: string;
}

export interface BuildingDef {
  id: string;
  buildable: boolean;
  cost: number;
  buildSeconds: number;
  hp: number;
  defense: number;
  territoryRadius?: number;
  isKeep?: boolean;
  produce?: { energy: number; everySeconds: number; autonomous?: boolean };
  shelter?: { capacity: number };
  aura?: {
    radius: number;
    targets: string[];
    productionSpeedMultiplier?: number;
    stacks?: boolean;
    healAmount?: number;
    healEverySeconds?: number;
  };
  spawnPoint?: boolean;
  trainingLevel?: number;
  autoAttack?: { damage: number; attackSeconds: number; range: number; tech?: string };
  healAura?: { radius: number; hpPerSecond: number };
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
  attackTech?: string;
  resist?: Resist;
  resistByTech?: Record<string, Resist>;
}

export interface HeroDef {
  id: string;
  name_ru: string;
  tech: AttackTech;
  tier: number;
  enemy: UnitStats & {
    attackTech: AttackTech;
    resist: Resist;
    flying?: boolean;
    ability: { id: string; desc: string };
    reward: number;
  };
  drops: ({ slot: PartSlotKind; id: string; tech: string } & PartTier)[];
}

export interface SiteDef {
  id: string;
  clueChannel: 'threat' | 'boss' | 'finds';
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
  /** Overrides spawnSeconds / maxAlive from a threat level on (QA B-2: early nests are weaker). */
  spawnByThreat?: { fromLevel: number; spawnSeconds: number; maxAlive: number }[];
  initialSpawnByThreat?: { fromLevel: number; count: number }[];
}

/** Tables from rules v0.4 on (residents fight, heroes as enemies); later minor versions only add fields. */
const MIN_VERSION = 0.4;
for (const [name, table] of Object.entries({
  buildingsJson,
  configJson,
  difficultyJson,
  elementsJson,
  enemiesJson,
  heroesJson,
  mapgenJson,
  multiplayerJson,
  partsJson,
  unitsJson,
})) {
  const v = (table as { version?: string }).version;
  if (!v || !(Number(v) >= MIN_VERSION)) throw new Error(`${name}: unsupported table version ${v}`);
}

/** boss.selfWakeSeconds comes from the difficulty level (World.effectiveConfig fills it in). */
export const config = configJson as unknown as Omit<typeof configJson, 'boss'> & { boss: { selfWakeSeconds: number; warningSeconds: number } };
export const mapgen = mapgenJson;
export const multiplayer = multiplayerJson;

export const buildings: Record<string, BuildingDef> = Object.fromEntries(
  (buildingsJson.buildings as BuildingDef[]).map((b) => [b.id, b]),
);
export const sites: Record<string, SiteDef> = Object.fromEntries((enemiesJson.sites as SiteDef[]).map((s) => [s.id, s]));
export const enemies: Record<string, EnemyDef> = Object.fromEntries(
  (enemiesJson.enemies as EnemyDef[]).map((e) => [e.id, e]),
);
export const heroes: Record<string, HeroDef> = Object.fromEntries(
  (heroesJson.heroes as unknown as HeroDef[]).map((h) => [h.id, h]),
);
export const heroList = Object.values(heroes);
export const heroRules = heroesJson as unknown as {
  lairsPerMapByTier: Record<string, number>;
  lairSelfOpenThreatLevels: number[];
  bossPool: { heroes: string[] };
  allyRules: { hpFactor: number; damageFactor: number; range: number; respawnSeconds: number; leashRadiusFromCommand: number };
};

/** Hero parts are tier 3 (MVP_RULES §8.1) and share the parts table shape. */
const HERO_PART_TIER = 3;
export const parts: Record<string, PartDef> = Object.fromEntries([
  ...(partsJson.parts as PartDef[]).map((p) => [p.id, p] as const),
  ...heroList.flatMap((h) =>
    h.drops.map((d) => {
      const { slot, id, tech, ...bonus } = d;
      return [id, { id, slot, tech, hero: h.id, tiers: [{ ...bonus, tier: HERO_PART_TIER }] }] as const;
    }),
  ),
]);

export const elements = elementsJson as unknown as {
  beats: Record<Tech, Tech>;
  partResist: { perTier: number; floor: number };
  statuses: {
    burn: { dpsByTier: number[]; seconds: number };
    chill: { slowPercentByTier: number[]; seconds: number; freezeAtStacks: number; freezeSeconds: number };
    shock: { chainTargetsByTier: number[]; chainFactor: number; chainRange: number };
    poison: { dpsByTier: number[]; seconds: number; defenseMinusByTier: number[] };
    stagger: { interruptChanceByTier: number[]; knockbackTiles: number };
  };
  reactions: { id: string; onTargetStatus: string; hitTech: string; effect: Record<string, number | boolean> }[];
};
export const TECHS: Tech[] = ['thermo', 'cryo', 'volt', 'toxin', 'impact'];

const residentRow = unitsJson.units.find((u) => u.id === 'resident')! as unknown as Partial<UnitStats> & {
  hp: number;
  speed: number;
  slots: SlotId[];
};
export const residentStats: UnitStats = {
  hp: residentRow.hp,
  damage: residentRow.damage ?? 0,
  defense: residentRow.defense ?? 0,
  attackSeconds: residentRow.attackSeconds ?? 1,
  range: residentRow.range ?? 1,
  speed: residentRow.speed,
};
export const RESIDENT_SLOTS = residentRow.slots;

export const BUILDABLE = Object.values(buildings)
  .filter((b) => b.buildable)
  .map((b) => b.id);

export function partTier(partId: string, tier: number): PartTier {
  const def = parts[partId];
  return def.tiers.find((t) => t.tier === tier) ?? def.tiers[def.tiers.length - 1];
}

/** Difficulty levels (design/data/difficulty.json, MVP_RULES §15). */
export interface DifficultyDef {
  id: string;
  threatSecondsPerLevel: number;
  enemyHpFactor: number;
  enemyDamageFactor: number;
  startEnergy: number;
  assistMode: 'full' | 'scanner' | 'off';
  bossSelfWakeSeconds: number;
  callTargetHpFactor: number;
  lairSelfOpenThreatLevels: number[];
  noGuessBoard?: boolean;
  raids?: { enabled: boolean; firstAfterSeconds: number; everySeconds: number; size: number; sizePerThreatLevels: number; maxSize: number };
}
export const difficulties: Record<string, DifficultyDef> = Object.fromEntries(
  (difficultyJson.levels as unknown as DifficultyDef[]).map((d) => [d.id, d]),
);
export const DEFAULT_DIFFICULTY = difficultyJson.default;
/** Raids and damage to buildings (MVP_RULES §9.7). */
export const raidRules = difficultyJson.raidRules;

export interface BoonDef {
  id: string;
  rarity: 'common' | 'rare';
  stackable: boolean;
  maxStacks?: number;
  effect: Record<string, unknown> & { type: string };
}
/** Cache bonuses, pick 1 of 3 (design/META.md §8). */
export const boonRules = boonsJson.rules;
export const boons: Record<string, BoonDef> = Object.fromEntries((boonsJson.boons as unknown as BoonDef[]).map((b) => [b.id, b]));
export const buildingDamage = difficultyJson.buildingDamage;
