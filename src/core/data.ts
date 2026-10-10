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
import eventsJson from '../data/design/events.json';
import heroesJson from '../data/design/heroes.json';
import mapgenJson from '../data/design/mapgen.json';
import hazardsJson from '../data/design/hazards.json';
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
    /** Jammer (buildings.json): targets in range move and attack slower. */
    moveSpeedFactor?: number;
    attackSpeedFactor?: number;
  };
  /** Outpost: our heroes in range gain defense. */
  heroAura?: { radius: number; defenseAdd: number };
  /** Repair building: our buildings in range regain HP over time. */
  repair?: { radius: number; hpPerSecond: number };
  spawnPoint?: boolean;
  trainingLevel?: number;
  /** Hero tiers this building spawns when construction completes (MVP_RULES §4.1b). */
  heroBirthTiers?: number[];
  /** Upgrade levels beyond base (index 0 = level 2, index 1 = level 3). Cost defaults to base cost × (level). */
  levels?: { cost?: number; effectKey?: string }[];
  /** Boost: temporary acceleration. Cost defaults to 30, cooldown to 60 s. */
  boost?: { cost?: number; cooldown?: number; effectKey?: string };
  /** Fraction of total spent energy returned on demolish. Defaults to 0.5. Command center cannot be demolished. */
  demolishRefund?: number;
  /** Maximum number of this building per player. */
  maxCount?: number;
  /** Build requirements beyond energy (checked by canBuild). */
  requires?: { schools?: number; nestsDestroyed?: number };

  autoAttack?: { damage: number; attackSeconds: number; range: number; tech?: string };
  healAura?: { radius: number; hpPerSecond: number };
  /** Relay: +N to our hero cap, up to +2 in total over the difficulty cap (buildings.json relay). */
  heroCapAdd?: number;
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
  /** True: no infected lair in the map; this hero exists as an ally only (e.g. Standard). */
  allyOnly?: boolean;
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
  onReveal?: { energy?: number; resident?: number; permanentSlotOnCommand?: boolean; blueprintFragment?: number; armorPlates?: number; loreRecord?: number; civilians?: [number, number] };
  /** Icon shown in the blue sensor window (design/MVP_RULES §5.1). */
  findIcon?: string;
  /** Higher = more valuable for the sensor icon priority (design/MVP_RULES §5.1). */
  findValue?: number;
  /** Overrides spawnSeconds / maxAlive from a threat level on (QA B-2: early nests are weaker). */
  spawnByThreat?: { fromLevel: number; spawnSeconds: number; maxAlive: number }[];
  initialSpawnByThreat?: { fromLevel: number; count: number }[];
}

/** Tables from rules v0.4 on (residents fight, heroes as enemies); later minor versions only add fields. */
const MIN_VERSION = [0, 4];
/** Compares "major.minor" as parts: "0.10" is newer than "0.9", which a float compare gets backwards. */
const versionAtLeast = (v: string, min: number[]) => {
  const parts = v.split('.').map(Number);
  for (let i = 0; i < min.length; i++) {
    const p = parts[i] ?? 0;
    if (p !== min[i]) return p > min[i];
  }
  return true;
};
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
  if (!v || !versionAtLeast(v, MIN_VERSION)) throw new Error(`${name}: unsupported table version ${v}`);
}

/** boss.selfWakeSeconds comes from the difficulty level (World.effectiveConfig fills it in). */
export const config = configJson as unknown as Omit<typeof configJson, 'boss'> & { boss: { selfWakeSeconds: number; warningSeconds: number } };
export const mapgen = mapgenJson;

/** Mines, bonus capsules, medkits (hazards.json, MVP_RULES §5.2). */
export interface HazardRules {
  mine: {
    countByDifficulty: Record<string, number>;
    coopFactor: number;
    /** Обеденный вызов (quick mode). */
    quickMode?: number;
    unmarkedDig: {
      armSeconds: number;
      radius: number;
      hitsBuildings: boolean;
      status: Partial<Record<Tech, string | { stunSeconds?: number; freezeSeconds?: number; defenseMinus?: number; seconds?: number }>>;
      /** v0.2: each of our heroes in the radius loses this share of max HP, by difficulty. */
      heroDamageMaxHpFraction: Record<string, number>;
      neverKillsAlone: boolean;
      leavesMinHp: number;
      concussion: { seconds: number; digSpeedFactor: number; attackSpeedFactor: number; moveSpeedFactor: number };
      buildingDamageMaxHpFraction: number;
      tearLimbChance: number;
      threatBump?: { threatSeconds: number };
      tempoReset?: boolean;
    };
    markedDig: { defuse: boolean; energy: number };
  };
  bonusCapsule: {
    count: number;
    pool: Record<string, { energy?: number; armorPlateNearestHero?: number; buildingsHealPercent?: number; peekCharges?: number; heroesDamageTakenFactor?: number; seconds?: number }>;
  };
  medkit: { count: number; radius: number; hpPerSecond: number; seconds: number; doctorFactor: number };
}
export const hazards = hazardsJson as unknown as HazardRules;

/**
 * A by-difficulty row of the design tables. hazards.json says «crunch» for Аврал, difficulty.json says «rush»:
 * both names are accepted; unknown levels fall back to «shift».
 */
export function byDifficulty<T>(table: Record<string, T>, id: string): T | undefined {
  return table[id] ?? (id === 'rush' ? table.crunch : id === 'crunch' ? table.rush : undefined) ?? table.shift;
}

/** Townsfolk «on the balance» (enemies.json civilian.balance, MVP_RULES §4.4 v0.2). */
export interface CivilianRules {
  onReachCommand: { score: number; energy: number; addToBalance: number };
  balance: { energyIncomeBonusPerCivilian: number; bonusCapCivilians: number; bonusCapPerShelter: number; loseOnBuildingDestroyed: number };
}
/**
 * The design numbers as of enemies.json v0.2; used until the synced enemies.json carries `civilian`
 * (the ×2.5 data pass ships it), then the table wins.
 */
const CIVILIAN_DEFAULTS: CivilianRules = {
  onReachCommand: { score: 25, energy: 5, addToBalance: 1 },
  balance: { energyIncomeBonusPerCivilian: 0.04, bonusCapCivilians: 10, bonusCapPerShelter: 5, loseOnBuildingDestroyed: 1 },
};
const civilianJson = (enemiesJson as unknown as { civilian?: Partial<CivilianRules> }).civilian;
export const civilianRules: CivilianRules = {
  onReachCommand: { ...CIVILIAN_DEFAULTS.onReachCommand, ...civilianJson?.onReachCommand },
  balance: { ...CIVILIAN_DEFAULTS.balance, ...civilianJson?.balance },
};
/** Townsfolk per opened survivor site (enemies.json sites.survivor.onReveal.civilians). */
export const CIVILIANS_PER_SITE_DEFAULT: [number, number] = [3, 6];

/** Контроль's calls (events.json, MVP_RULES §17.7). */
export interface ControlEventDef {
  id: string;
  a?: Record<string, unknown>;
  b?: Record<string, unknown>;
  requires?: Record<string, unknown>;
}
export const controlEvents: Record<string, ControlEventDef> = Object.fromEntries(
  ((eventsJson as unknown as { events: ControlEventDef[] }).events ?? []).map((e) => [e.id, e]),
);
/** Timing of random Контроль calls (events.json: perRun, firstAtSeconds, gapSeconds). */
export const controlSchedule = {
  perRun: (eventsJson as unknown as { perRun: number[] }).perRun,
  firstAtSeconds: (eventsJson as unknown as { firstAtSeconds: number[] }).firstAtSeconds,
  gapSeconds: (eventsJson as unknown as { gapSeconds: number[] }).gapSeconds,
};
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
  enemyMutations: {
    countByTier: Record<string, number>;
    slots: string[];
    elementPool: Tech[];
    otherThanOwnTechChance: number;
    sameElementForAllMutationsChance: number;
  };
};

export const armorPlateDef = (enemiesJson as unknown as { armorPlate: { defenseAdd: number; hpAdd: number; maxPerHero: number; giveTo: string; lostOnKnockout: number } }).armorPlate;

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
