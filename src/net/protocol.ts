/**
 * Messages between the game and the match server (server/). Shared by both,
 * so a renamed field breaks the typecheck on both sides at once.
 */
import type { Command, RefuseReason } from '../core/commands';
import type { AssistMode, GameState, MatchMode } from '../core/state';
import type { GameEvent } from '../core/world';
import type { Delta } from './patch';

export const ROOM = 'match';
/** Server simulation step and patch rate (World.STEP is 0.05 s). */
export const TICK_MS = 50;

/** What a client sends when it creates or joins a room. */
export interface JoinOptions {
  name: string;
  mode: MatchMode;
  assist: AssistMode;
  /** Quick match: joins any open room of this mode; otherwise a private room by code. */
  quick?: boolean;
}

export interface LobbySeat {
  name: string;
  connected: boolean;
  host: boolean;
  /** This seat is the receiving client. */
  you: boolean;
}

export interface LobbyInfo {
  code: string;
  mode: MatchMode;
  quick: boolean;
  seats: LobbySeat[];
  min: number;
  max: number;
  /** Quick match: seconds until it starts by itself (null: waiting for players). */
  countdown: number | null;
}

/** Client → server. */
export interface ClientMessages {
  cmd: { cmd: Command };
  start: Record<string, never>;
  mode: { mode: MatchMode };
}

/** Server → client. */
export interface ServerMessages {
  lobby: LobbyInfo;
  /** The match began, or a reconnect: the whole state and which player you are. */
  full: { me: number; state: GameState; tick: number };
  /** One server step: what changed and what happened. */
  tick: { n: number; p?: Delta; e?: GameEvent[] };
  refused: { reason: RefuseReason };
  /** Someone dropped or came back (names by player id). */
  presence: { connected: boolean[] };
}
