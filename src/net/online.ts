/**
 * The game's side of an online match: connection, lobby and an OnlineWorld
 * that GameScene drives exactly like the single-player World, except that
 * the state comes from the server and commands go to it.
 */
import { Client, type Room } from '@colyseus/sdk';
import type { ApplyResult, Command } from '../core/commands';
import type { AssistMode, GameState, MatchMode } from '../core/state';
import { STEP, World } from '../core/world';
import { patch } from './patch';
import { ROOM, type JoinOptions, type LobbyInfo, type ServerMessages } from './protocol';

/** Built-in server address for the published game; empty until hosting is set up (docs/MULTIPLAYER.md). */
const DEFAULT_SERVER = (import.meta.env.VITE_MP_SERVER as string | undefined) ?? '';

let override = '';
/** Tests and tools point the game at a server directly. */
export function setServerUrl(url: string): void {
  override = url;
}

/** ?server=… wins, then the build setting; `npm run dev` talks to a local server. */
export function serverUrl(): string {
  if (override) return override;
  if (typeof location === 'undefined') return DEFAULT_SERVER;
  const forced = new URLSearchParams(location.search).get('server');
  if (forced) return forced;
  if (DEFAULT_SERVER) return DEFAULT_SERVER;
  if (import.meta.env.DEV) return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:2567`;
  return '';
}

export const onlineAvailable = () => serverUrl() !== '';

type Tick = ServerMessages['tick'];

/**
 * World whose state is the server's. tick() plays received steps from a small
 * buffer at the server's pace, so a late packet does not make units jump.
 */
export class OnlineWorld extends World {
  private buffer: Tick[] = [];
  private clock = 0;
  private waiting = true;
  /** Last server step applied. */
  lastTick = 0;

  constructor(
    state: GameState,
    tick: number,
    private readonly send: (cmd: Command) => void,
  ) {
    super({ state });
    this.lastTick = tick;
  }

  receive(t: Tick): void {
    if (t.n > this.lastTick) this.buffer.push(t);
  }

  /** A reconnect sends the whole state again: take it over in place. */
  reset(state: GameState, tick: number): void {
    const s = this.s as unknown as Record<string, unknown>;
    for (const k of Object.keys(s)) delete s[k];
    Object.assign(s, state);
    this.buffer = this.buffer.filter((t) => t.n > tick);
    this.lastTick = tick;
    this.rev++;
  }

  tick(dt: number): void {
    // Two steps of slack absorb network jitter; a long backlog is played at once.
    if (this.waiting && this.buffer.length < 2) return;
    this.waiting = false;
    while (this.buffer.length > 6) this.play(this.buffer.shift()!);
    this.clock += dt;
    while (this.clock >= STEP && this.buffer.length) {
      this.clock -= STEP;
      this.play(this.buffer.shift()!);
    }
    if (!this.buffer.length) {
      this.clock = 0;
      this.waiting = true;
    }
  }

  private play(t: Tick): void {
    if (t.n <= this.lastTick) return;
    this.lastTick = t.n;
    if (t.p) {
      patch(this.s, t.p);
      // The scanner's deductions depend on the opened field.
      if ('o' in t.p && t.p.o.cells) this.rev++;
    }
    if (t.e) this.pushEvents(t.e);
  }

  /** Checked against a copy of the current state first, so refusals show at once; then sent. */
  apply(cmd: Command, playerId = 0): ApplyResult {
    const probe = new World({ state: structuredClone(this.s) });
    const r = probe.apply(cmd, playerId);
    if (r.ok) this.send(cmd);
    else this.pushEvents(probe.drainEvents());
    return r;
  }
}

export interface OnlineProfile {
  name: string;
  assist: AssistMode;
}

type Listener = {
  lobby?: (info: LobbyInfo) => void;
  start?: () => void;
  presence?: (connected: boolean[]) => void;
  refused?: (reason: string) => void;
  closed?: (code: number) => void;
};

export class OnlineSession {
  me = -1;
  world: OnlineWorld | null = null;
  lobby: LobbyInfo | null = null;
  connected: boolean[] = [];
  private listeners: Listener = {};
  private leaving = false;

  private constructor(private readonly room: Room) {
    room.onMessage('lobby', (info: LobbyInfo) => {
      this.lobby = info;
      this.listeners.lobby?.(info);
    });
    room.onMessage('full', (m: ServerMessages['full']) => {
      this.me = m.me;
      this.connected = m.state.players.map(() => true);
      if (this.world) this.world.reset(m.state, m.tick);
      else {
        this.world = new OnlineWorld(m.state, m.tick, (cmd) => room.send('cmd', { cmd }));
        this.listeners.start?.();
      }
    });
    room.onMessage('tick', (t: ServerMessages['tick']) => this.world?.receive(t));
    room.onMessage('presence', (m: ServerMessages['presence']) => {
      this.connected = m.connected;
      this.listeners.presence?.(m.connected);
    });
    room.onMessage('refused', (m: ServerMessages['refused']) => this.listeners.refused?.(m.reason));
    room.onLeave((code: number) => {
      if (!this.leaving) this.listeners.closed?.(code);
    });
  }

  get code(): string {
    return this.room.roomId;
  }

  on(l: Listener): void {
    this.listeners = l;
  }

  private static client(): Client {
    return new Client(serverUrl());
  }

  private static opts(p: OnlineProfile, mode: MatchMode, quick: boolean): JoinOptions {
    return { name: p.name, assist: p.assist, mode, quick };
  }

  static async quick(p: OnlineProfile, mode: MatchMode): Promise<OnlineSession> {
    return new OnlineSession(await OnlineSession.client().joinOrCreate(ROOM, OnlineSession.opts(p, mode, true)));
  }

  static async create(p: OnlineProfile, mode: MatchMode): Promise<OnlineSession> {
    return new OnlineSession(await OnlineSession.client().create(ROOM, OnlineSession.opts(p, mode, false)));
  }

  static async join(p: OnlineProfile, code: string): Promise<OnlineSession> {
    return new OnlineSession(await OnlineSession.client().joinById(code.trim().toUpperCase(), OnlineSession.opts(p, 'coop', false)));
  }

  start(): void {
    this.room.send('start', {});
  }

  setMode(mode: MatchMode): void {
    this.room.send('mode', { mode });
  }

  leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.room.leave(true).catch(() => undefined);
  }
}
