/**
 * What can hide under a covered cell. Mapping to Keepsweeper:
 * nest = goblin lair, depot = crypt, cache = treasure, demon = dragon.
 */
export type SiteKind = 'none' | 'nest' | 'depot' | 'cache' | 'demon';

/** The four separate clue channels shown on a revealed cell (KS-001). */
export interface Hints {
  nest: number;
  depot: number;
  cache: number;
  demon: number;
}

export const HINT_CHANNELS = ['nest', 'demon', 'cache', 'depot'] as const;
export type HintChannel = (typeof HINT_CHANNELS)[number];

export interface Cell {
  x: number;
  y: number;
  site: SiteKind;
  revealed: boolean;
  /** Site was claimed (cache) or destroyed (threat); it no longer counts in hints. */
  resolved: boolean;
  /** Player's own "danger here" mark. */
  marked: boolean;
  /** Command center sits here. */
  core: boolean;
}

export interface BoardConfig {
  width: number;
  height: number;
  sites: { nest: number; depot: number; cache: number; demon: number };
  /** No sites within this Chebyshev distance of the command center. */
  safeRadius: number;
  /** Demon is buried at least this far (Chebyshev) from the command center. */
  demonMinDistance: number;
}

export interface SimConfig {
  startWorkers: number;
  /** Seconds a worker spends digging one cell. */
  digSeconds: number;
  /** Worker speed in cells per second. */
  walkSpeed: number;
  energyPerCell: number;
  energyPerCache: number;
}

export type GameEvent =
  | { type: 'revealed'; cells: { x: number; y: number }[] }
  | { type: 'energy'; x: number; y: number; amount: number }
  | { type: 'cacheFound'; x: number; y: number }
  | { type: 'threatAwakened'; x: number; y: number; site: SiteKind };
