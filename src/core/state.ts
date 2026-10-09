/**
 * The whole match as plain JSON-able data. Saves are JSON.stringify(state);
 * the multiplayer server will send the same object to clients.
 */
import type { SlotId, Tech, UnitStats } from './data';

export type CellContent =
  | 'ground'
  | 'water'
  | 'rubble'
  | 'energy_vein'
  | 'cache'
  | 'survivor'
  | 'nest'
  | 'heavy_nest'
  | 'demon_hatch';

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
  /** Building standing on this cell. */
  building?: number;
  /** Player's "danger here" flag. */
  marked?: boolean;
  /** Seconds left of steam-burnt ground. */
  hot?: number;
}

/** An opened nest / demon hatch: a structure with HP that releases enemies. */
export interface SiteState {
  x: number;
  y: number;
  kind: 'nest' | 'heavy_nest' | 'demon_hatch';
  hp: number;
  maxHp: number;
  spawnTimer: number;
  alive: number[];
  destroyed: boolean;
  /** Enemies released so far (for a limited spawn budget). */
  spawned?: number;
}

export interface PartInstance {
  id: string;
  tier: number;
}

export type UnitKind = 'resident' | 'defender' | 'adaptant' | 'heavy_adaptant' | 'demon';

export type Task =
  | { type: 'idle' }
  | { type: 'dig'; x: number; y: number; progress: number }
  | { type: 'harvest'; x: number; y: number; progress: number }
  | { type: 'build'; building: number }
  | { type: 'operate'; building: number }
  | { type: 'train'; building: number; progress: number }
  | { type: 'flee' }
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
  /** Residents: the dwelling slot they belong to (building id). */
  home?: number;
  task: Task;
  parts: Partial<Record<SlotId, PartInstance>>;
  attackCooldown: number;
  /** Unit id or site key ("s:x,y") or building key ("b:id") being attacked. */
  target?: string;
  repathTimer: number;
  burn?: { dps: number; left: number; source: number };
  slow?: { percent: number; left: number };
  /** Enemies: the nest that released them. */
  nest?: string;
  /** Demon special attack state. */
  blast?: { phase: 'windup' | 'cooldown'; left: number; dx: number; dy: number };
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
  /** Dwelling slots: unit id living there, or seconds until the next birth. */
  slots: { unit: number | null; timer: number }[];
  operators: number[];
  produceTimer: number;
  recruit: boolean;
  healTimer: number;
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
  /** Attack order for all defenders: unit id or site key. */
  order: string | null;
  stats: { nests: number; caches: number };
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
  demonEnabled?: boolean;
  commandInvulnerable?: boolean;
  /** The command center may only go here (tutorial). */
  commandFixed?: { x: number; y: number };
  nest?: { initialSpawn?: number; maxAlive?: number; spawnSeconds?: number; totalBudget?: number };
  adaptant?: { partDropChance?: number; partSlot?: 'arm' | 'leg' };
}

export interface GameState {
  version: 1;
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
  demon: { awake: boolean; warned: boolean; dead: boolean; hpScale: number };
  outcome: Outcome;
  rules?: RuleOverrides;
}
