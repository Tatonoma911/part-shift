/**
 * The whole match as plain JSON-able data. Saves are JSON.stringify(state);
 * the multiplayer server will send the same object to clients.
 */
import type { AttackTech, SlotId, Tech, UnitStats } from './data';

export type CellContent =
  | 'ground'
  | 'water'
  | 'rubble'
  | 'energy_vein'
  | 'cache'
  | 'survivor'
  | 'nest'
  | 'heavy_nest'
  | 'hero_lair'
  | 'boss_hatch';

/**
 * Clue channels. 'demon' is the «Цель вызова» channel (design id `boss`): the
 * key keeps its old name so the board, the scanner and saved settings stay stable.
 */
export type ClueChannel = 'threat' | 'demon' | 'finds';

export interface Cell {
  content: CellContent;
  revealed: boolean;
  /** Site claimed (cache, survivor) or destroyed (nest, demon dead); no longer counts in clues. */
  resolved: boolean;
  /** Nest technology, chosen at generation. */
  tech?: Tech;
  /** Energy left in rubble / energy vein. */
  stock?: number;
  /** Seconds of rubble clearing done. */
  work?: number;
  /** Shared dig progress of everyone digging this cell (config.dig.workers). */
  dig?: number;
  /** Building standing on this cell. */
  building?: number;
  /** Player's "danger here" flag. */
  marked?: boolean;
  /** Seconds left of steam-burnt ground. */
  hot?: number;
  /** Hero lair / boss hatch: the hero waiting inside (heroes.json id). */
  hero?: string;
  /** Lair tier (1–3) for the self-open clock; the boss hatch has none. */
  heroTier?: number;
  /** Hero lair: the "coming out soon" warning was given. */
  warned?: boolean;
  /** Seconds left of Canopy's overgrowth (slows residents). */
  overgrown?: number;
  /** Ruins of this building type: rebuilding is cheaper and faster (difficulty.json buildingDamage.ruins). */
  ruin?: string;
}

/** An opened nest (a structure with HP that releases enemies) or an opened hero lair / boss hatch. */
export interface SiteState {
  x: number;
  y: number;
  kind: 'nest' | 'heavy_nest' | 'hero_lair' | 'boss_hatch';
  hp: number;
  maxHp: number;
  spawnTimer: number;
  alive: number[];
  destroyed: boolean;
  /** Enemies released so far (for a limited spawn budget). */
  spawned?: number;
  /** Seconds left of Beacon's alarm flare: this nest spawns twice as fast. */
  rush?: number;
}

export interface PartInstance {
  id: string;
  tier: number;
}

export type UnitKind = 'resident' | 'adaptant' | 'heavy_adaptant' | 'hero';

export type Task =
  | { type: 'idle' }
  | { type: 'dig'; x: number; y: number; progress: number }
  | { type: 'harvest'; x: number; y: number; progress: number }
  | { type: 'build'; building: number }
  | { type: 'rest' };

export interface Unit {
  id: number;
  kind: UnitKind;
  /** Player id, or -1 for adaptants and the Demon. */
  owner: number;
  x: number;
  y: number;
  hp: number;
  /** Stats before parts; enemies get threat scaling baked in at spawn. */
  base: UnitStats;
  path: { x: number; y: number }[];
  task: Task;
  parts: Partial<Record<SlotId, PartInstance>>;
  attackCooldown: number;
  /** Unit id or site key ("s:x,y") or building key ("b:id") being attacked. */
  target?: string;
  repathTimer: number;
  burn?: { dps: number; left: number; source: number };
  slow?: { percent: number; left: number };
  /** Chill hits in a row (design/ELEMENTS.md: 3 = frozen). */
  chill?: number;
  poison?: { dps: number; left: number; defense: number; source: number };
  /** Frozen or stunned: no moving, no hitting. */
  stun?: number;
  /** Shell break: defense counts as 0. */
  bare?: number;
  /** Enemies: the nest or lair that released them. */
  nest?: string;
  /** Heroes: heroes.json id. Adaptants: the nest tech (sprite and resists). */
  hero?: string;
  tech?: Tech;
  attackTech?: AttackTech;
  /** Seconds until the hero's ability fires again. */
  abilityCd?: number;
  /** Demon special attack state. */
  blast?: { phase: 'windup' | 'cooldown'; left: number; dx: number; dy: number };
  /** Heroes: damage taken per resident id (the second part goes to the runner-up). */
  dealt?: Record<number, number>;
  /** Seconds left before a resident goes back to work after a fight. */
  calm?: number;
  /** Raiders: the building they march on ("b:id"); dropped once a resident hits them. */
  raid?: string;
  kills: number;
}

export interface Building {
  id: number;
  type: string;
  owner: number;
  x: number;
  y: number;
  hp: number;
  /** Seconds of construction done; complete when >= buildSeconds. */
  built: number;
  complete: boolean;
  produceTimer: number;
  healTimer: number;
  /** Rebuilt on its own ruins: builds in half the time. */
  rebuild?: boolean;
}

export interface Orb {
  owner: number;
  x: number;
  y: number;
  amount: number;
}

export interface Player {
  id: number;
  energy: number;
  alive: boolean;
  command: number | null;
  /** Cells the player asked to dig (keys "x,y"), in order. */
  queue: string[];
  /** Cells queued automatically next to quiet cells (low priority). */
  autoQueue: string[];
  /** Attack order for all residents: unit id or site key. */
  order: string | null;
  /** Seconds until the next resident appears. */
  spawnTimer: number;
  /** Extra resident places (survivors). */
  capBonus: number;
  stats: { nests: number; caches: number; heroes: string[]; energy: number; lost: number; parts: number };
  /** Scanner helper (design/ONBOARDING.md §1.3). */
  assist: AssistState;
}

export type AssistMode = 'full' | 'scanner' | 'off';

export interface AssistState {
  mode: AssistMode;
  charges: number;
  /** Seconds until the next scanner charge. */
  recharge: number;
  /** Seconds the last scan stays visible. */
  scanLeft: number;
}

export type Outcome = 'playing' | 'victory' | 'defeat';

/**
 * Per-match changes to the design tables (the tutorial uses them).
 * `config` keys are dotted paths into config.json, e.g. "dig.digSeconds".
 */
export interface RuleOverrides {
  config?: Record<string, number | boolean>;
  threatEnabled?: boolean;
  bossEnabled?: boolean;
  commandInvulnerable?: boolean;
  /** The command center may only go here (tutorial). */
  commandFixed?: { x: number; y: number };
  /** Sites laid out around wherever the command center lands (tutorial, design commandPlacement). */
  relativeSites?: { type: 'nest' | 'cache' | 'rubble'; dx: number; dy: number }[];
  /** Tech of nests placed by relativeSites. */
  relativeTech?: Tech;
  nest?: { initialSpawn?: number; maxAlive?: number; spawnSeconds?: number; totalBudget?: number };
  adaptant?: { partDropChance?: number; partSlot?: 'arm' | 'leg' };
}

export interface GameState {
  version: 2;
  seed: number;
  rng: number;
  time: number;
  width: number;
  height: number;
  cells: Cell[];
  generated: boolean;
  players: Player[];
  units: Unit[];
  buildings: Building[];
  sites: SiteState[];
  orbs: Orb[];
  nextId: number;
  /** The call target: the strongest hero of the district (boss_hatch). */
  boss: { hero: string; awake: boolean; warned: boolean; dead: boolean; hpScale: number };
  outcome: Outcome;
  /** difficulty.json level id. */
  difficulty: string;
  /** Game time of the next raid (MVP_RULES §9.7). */
  raidAt?: number;
  rules?: RuleOverrides;
}
