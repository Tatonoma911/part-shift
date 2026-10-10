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
  | 'blueprint'
  | 'armor_crate'
  | 'lore_record'
  | 'mine'
  | 'bonus_capsule'
  | 'medkit'
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
  /** Mine: seconds until an opened (armed) mine blows; undefined when hidden or spent. */
  fuse?: number;
  /** A capsule peek shows this closed cell's sensor until this game time (MVP_RULES §5.2). */
  peekUntil?: number;
  /** Dug on purpose under an «Опасно» mark: a mine here is defused, not blown (MVP_RULES §5.2). */
  defuse?: boolean;
  /** Bonus capsule: the bonus it gave (hazards.json bonusCapsule.types). */
  bonus?: string;
  /** Medkit: seconds of healing left after it was opened. */
  heal?: number;
  /** Shared dig progress of everyone digging this cell (config.dig.workers). */
  dig?: number;
  /** Building standing on this cell. */
  building?: number;
  /** Player's "danger here" flag. */
  marked?: boolean;
  /** The player's own mark (MVP_RULES §3.1а): «Опасно» or «Не уверен». Set together with `marked`. */
  markKind?: 'danger' | 'unsure';
  /** The player confirmed digging this known danger ("Да, вскрыть"): opening it is deliberate. */
  deliberate?: boolean;
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
  /** Elemental zone this cell belongs to (mapgen.cellElements Voronoi). Ground/safe-radius cells have none. */
  element?: Tech;
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

/** 'ally': a hero who came back to the team (meta progress), fighting next to the residents. */
export type UnitKind = 'resident' | 'adaptant' | 'heavy_adaptant' | 'hero' | 'ally';

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
  /** Enemy heroes: mutation slots, each with a random element (MVP_RULES §9.9). */
  mutations?: { slot: SlotId; tech: Tech }[];
  /** Ally/resident: armor plates from armor_crate (enemies.json armorPlate). */
  armorPlates?: number;
  /** Ally: limbs torn off on knockout (MVP_RULES §4.1а). 'arm' = -20% damage, 'leg' = -25% speed each. */
  lostLimbs?: ('arm' | 'leg')[];
  /** Hero star tier (0 = base, 1–3 = upgraded via meta). */
  stars?: number;
  /** Super-charge meter 0–100; full charge triggers the hero's super ability. */
  superCharge?: number;
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
  /** Raiders wait at their exit until the siren has run (raidRules.minSecondsSirenToFirstHit). */
  holdUntil?: number;
  /** Residents: badly hurt, walking back to heal (config.residents.retreat). */
  retreat?: boolean;
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
  /** Seconds until the next shot (buildings with autoAttack: the command center). */
  attackCd?: number;
  /** Current upgrade level (1 = base, 2 = upgraded once, 3 = max). */
  level?: number;
  /** Seconds remaining on the boost cooldown (0 or absent = ready). */
  boostCooldown?: number;
  /** True while the building is in ruined state (damaged below 0 HP). */
  ruined?: boolean;
  /** Total energy spent building and upgrading this structure (for demolish refund). */
  spent?: number;
  /** For stations: the hero id this building gives birth to. */
  hero?: string;
}

export interface Orb {
  owner: number;
  x: number;
  y: number;
  amount: number;
  /** Where the orb was born (view only: arc of the flight). */
  x0?: number;
  y0?: number;
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
  /** Residents gathering before they engage, so they don't trickle in one by one (config.residents.rally). */
  rally?: { x: number; y: number; start: number; members: number[] };
  /** Cache bonuses taken this run, with their stack count (boons.json). */
  boons?: Record<string, number>;
  /** An opened cache waiting for the player's pick: three boon ids, and when it was offered. */
  boonOffer?: { ids: string[]; at: number };
  /** Allies down, waiting to come back at the center: hero id → game time it returns. */
  allyBack?: Record<string, number>;
  /** Bonus capsule «damage_resist»: our heroes take less damage until this game time. */
  resistUntil?: number;
  /** What a knocked-out ally comes back with (MVP_RULES §4.1а): kept trophies, stumps, armor plates. */
  allyScars?: Record<string, { parts: Unit['parts']; lostLimbs: ('arm' | 'leg')[]; armorPlates: number }>;
  /** Ally passive timers (heroes.json ally.everySeconds): hero id → seconds left. */
  allyTimers?: Record<string, number>;
  stats: { nests: number; caches: number; heroes: string[]; energy: number; lost: number; parts: number; blueprints: number; loreRecords: number };
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

/** Online match (design/MVP_RULES.md §14): coop "Вместе против Демона" or FFA "Последний центр". */
export type MatchMode = 'coop' | 'ffa';

export interface MatchInfo {
  mode: MatchMode;
  /** Display names by player id. */
  names: string[];
  /** FFA: the player whose center stood last (null: nobody). */
  winner?: number | null;
}

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
  /** Cache bonuses this player's rank allows (boons.json, meta ranks); none: a cache only pays Energy (tutorial). */
  boonPool?: string[];
  /** Heroes taken on this shift as allies (meta allyChoice), heroes.json ids. */
  allies?: string[];
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
  /** Game time of the next raid (MVP_RULES §9.7). @deprecated use raid.nextIn */
  raidAt?: number;
  /**
   * Raid status: read-only view for the UI.
   * nextIn  = seconds until the next raid wave fires (0 while active).
   * active  = a raid wave is currently in progress.
   * techs   = element types of raiders in the current wave.
   * callEarlyEnergy = energy cost to call a raid early.
   * canCallEarly    = player has enough energy and the clock is ready.
   */
  raid?: { nextIn: number; active: boolean; techs: Tech[]; callEarlyEnergy: number; canCallEarly: boolean };
  /**
   * Tempo: how well the shift is going (score system for difficulty scaling).
   * points       = accumulated tempo points (digs, clears, rescues).
   * level        = 0–3 difficulty tier derived from points.
   * stagnant     = true when no progress was made in the last config.tempo.stagnantSeconds.
   * lastProgress = game time of the last progress event.
   */
  tempo?: { points: number; level: number; stagnant: boolean; lastProgress?: number };
  /** True while the current raid wave was called early (callRaidEarly command); cleared when the wave ends. */
  raidCalledEarly?: boolean;
  /** Active boss call, or null if none. options[0]=refuse, options[1]=comply. fork set after player chooses. */
  controlCall?: { id: string; options?: { cost: number; effect: 'refuse' | 'comply' }[]; fork?: number } | null;
  rules?: RuleOverrides;
  /** Present only in online matches. */
  match?: MatchInfo;
}
