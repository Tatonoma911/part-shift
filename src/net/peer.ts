/**
 * P2P multiplayer via PeerJS (WebRTC data channels).
 * Host keeps the authoritative World; guests sync via patches.
 * No dedicated server needed — PeerJS Cloud handles signalling.
 *
 * Drop-in replacement for OnlineSession: same public interface.
 */
import Peer, { type DataConnection } from 'peerjs';
import type { ApplyResult, Command } from '../core/commands';
import { createMatch } from '../core/match';
import type { AssistMode, GameState, MatchMode } from '../core/state';
import { World } from '../core/world';
import { diff } from './patch';
import { OnlineWorld, type OnlineProfile } from './online';
import type { LobbyInfo } from './protocol';

// Prefix prevents collision with other PeerJS apps on the public server.
const PREFIX = 'ps2-';
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;

function genCode(): string {
  let s = '';
  for (let i = 0; i < 5; i++) s += CODE_ABC[Math.floor(Math.random() * CODE_ABC.length)];
  return s;
}

// ── messages ──────────────────────────────────────────────────────────────────

type ToGuest =
  | { t: 'lobby'; d: LobbyInfo }
  | { t: 'full'; d: { me: number; state: GameState; tick: number } }
  | { t: 'tick'; d: { n: number; p?: unknown; e?: unknown[] } }
  | { t: 'presence'; d: { connected: boolean[] } }
  /** Host broadcasts that a cooperative vote has started (Звонок Контроля). */
  | { t: 'vote_open'; d: { callId: string } }
  /** Host broadcasts the resolved vote result; all clients apply the winning choice. */
  | { t: 'vote_result'; d: { choice: 'a' | 'b'; tally: { a: number; b: number } } };

type ToHost =
  | { t: 'hello'; d: { name: string; assist: AssistMode } }
  | { t: 'cmd'; d: { cmd: Command } }
  | { t: 'start' }
  | { t: 'mode'; d: { mode: MatchMode } }
  /** Guest sends their vote for the active cooperative call. */
  | { t: 'vote'; d: { choice: 'a' | 'b'; callId: string } };

/** Resolved vote outcome, emitted to the voteResult listener on all peers. */
export interface VoteResult {
  choice: 'a' | 'b';
  tally: { a: number; b: number };
}

const VOTE_TIMEOUT_MS = 15_000;

function send(conn: DataConnection, msg: ToGuest | ToHost): void {
  if (conn.open) conn.send(JSON.stringify(msg));
}

function parse(raw: unknown): ToGuest | ToHost {
  return JSON.parse(typeof raw === 'string' ? raw : String(raw)) as ToGuest | ToHost;
}

// ── Authoritative World (host-side) ──────────────────────────────────────────

/**
 * The host's local World. tick() advances the simulation AND ships a patch
 * diff to every guest connection, so the host pump drives the whole match.
 */
class HostWorld extends World {
  lastTick = 0;
  private sent!: GameState;
  private conns: DataConnection[];

  constructor(state: GameState, conns: DataConnection[]) {
    super({ state });
    this.sent = structuredClone(state);
    this.conns = conns;
  }

  /** Called by GameScene's pump (setInterval 50ms). Advances sim + ships diff. */
  tick(dt: number): void {
    super.tick(dt);
    const p = diff(this.sent, this.s) ?? undefined;
    const e = this.drainEvents();
    this.lastTick++;
    const msg: ToGuest = {
      t: 'tick',
      d: { n: this.lastTick, p, e: e.length ? e : undefined },
    };
    const json = JSON.stringify(msg);
    for (const c of this.conns) if (c.open) c.send(json);
    this.sent = structuredClone(this.s);
  }

  /** Host applies own commands directly without a server round-trip. */
  apply(cmd: Command, playerId = 0): ApplyResult {
    return super.apply(cmd, playerId);
  }

  /** Called when a guest sends a command. */
  guestCmd(cmd: Command, pid: number): void {
    super.apply(cmd, pid);
  }
}

// ── Listener types ────────────────────────────────────────────────────────────

type Listener = {
  lobby?: (info: LobbyInfo) => void;
  start?: () => void;
  presence?: (connected: boolean[]) => void;
  refused?: (reason: string) => void;
  closed?: (code: number) => void;
  /** Fired when the host opens a cooperative vote (show vote UI, start 15s countdown). */
  voteOpen?: (callId: string) => void;
  /** Fired on all peers when the vote resolves (hide vote UI, apply the winning choice). */
  voteResult?: (result: VoteResult) => void;
};

// ── PeerSession ───────────────────────────────────────────────────────────────

interface SeatInfo {
  name: string;
  assist: AssistMode;
  connected: boolean;
}

function buildLobby(code: string, mode: MatchMode, seats: SeatInfo[], myIdx: number): LobbyInfo {
  return {
    code,
    mode,
    quick: false,
    seats: seats.map((s, i) => ({
      name: s.name,
      connected: s.connected,
      host: i === 0,
      you: i === myIdx,
    })),
    min: MIN_PLAYERS,
    max: MAX_PLAYERS,
    countdown: null,
  };
}

/**
 * Custom signalling server for e2e tests or self-hosted setups.
 * Set via URL params: ?_ph=<host>&_pp=<port>&_ppath=<path>
 * Defaults to PeerJS Cloud (no config needed for production).
 *
 * TURN note: PeerJS Cloud uses Google STUN by default. For most consumer
 * networks (full-cone or port-restricted NAT) this is enough. Symmetric
 * NAT — common on corporate/cellular networks — requires a TURN relay.
 * No free reliable TURN is available; Metered.ca has a free tier but
 * rate-limits heavily. Until a TURN server is configured, connections
 * on symmetric NAT silently fail after the STUN timeout (~5 s). Players
 * on the same Wi-Fi always work (loopback candidates).
 */
function peerServerOpts(): Record<string, unknown> {
  if (typeof location === 'undefined') return {};
  const p = new URLSearchParams(location.search);
  const host = p.get('_ph');
  if (!host) return {};
  return { host, port: Number(p.get('_pp') ?? 9001), path: p.get('_ppath') ?? '/myapp', secure: false };
}

function openPeer(id?: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const opts = peerServerOpts();
    const peer = id ? new Peer(id, opts) : new Peer(opts);
    const onOpen = () => { cleanup(); resolve(peer); };
    const onErr = (e: Error) => { cleanup(); reject(e); };
    const cleanup = () => { peer.off('open', onOpen); peer.off('error', onErr); };
    peer.on('open', onOpen);
    peer.on('error', onErr);
  });
}

interface ActiveVote {
  callId: string;
  /** Votes collected by the host: guestIndex (1-based) → choice. Index 0 = host. */
  votes: Map<number, 'a' | 'b'>;
  timer: ReturnType<typeof setTimeout>;
}

export class PeerSession {
  me = -1;
  world: HostWorld | OnlineWorld | null = null;
  lobby: LobbyInfo | null = null;
  connected: boolean[] = [];
  private listeners: Listener = {};
  private peer!: Peer;
  private _code = '';
  private gone = false;
  /** Active cooperative vote (host only while vote is open). */
  private _vote: ActiveVote | null = null;

  private constructor() {}

  get code(): string { return this._code; }

  on(l: Listener): void {
    this.listeners = l;
  }

  // ── Host path ──────────────────────────────────────────────────────────────

  static async create(p: OnlineProfile, mode: MatchMode): Promise<PeerSession> {
    const code = genCode();
    const peer = await openPeer(PREFIX + code);

    const s = new PeerSession();
    s.peer = peer;
    s._code = code;
    s.me = 0;

    const seats: SeatInfo[] = [{ name: p.name, assist: p.assist, connected: true }];
    let currentMode: MatchMode = mode;
    const guestConns: DataConnection[] = [];

    const refreshLobby = () => {
      s.lobby = buildLobby(code, currentMode, seats, 0);
      s.connected = seats.map((st) => st.connected);
      s.listeners.lobby?.(s.lobby);
      for (const c of guestConns) send(c, { t: 'lobby', d: buildLobby(code, currentMode, seats, guestConns.indexOf(c) + 1) });
    };

    // Initial lobby (just the host)
    s.lobby = buildLobby(code, mode, seats, 0);

    peer.on('connection', (conn: DataConnection) => {
      if (s.world || seats.length >= MAX_PLAYERS) {
        // Match already running or full — refuse
        conn.on('open', () => {
          send(conn, { t: 'refused' as never, d: { reason: 'full' } as never });
          conn.close();
        });
        return;
      }

      const guestIdx = guestConns.length;
      guestConns.push(conn);
      // Reserve seat with placeholder name until hello arrives
      seats.push({ name: `Игрок ${guestConns.length + 1}`, assist: 'full', connected: false });

      conn.on('open', () => {
        // Send current lobby immediately so guest knows they're queued
        send(conn, { t: 'lobby', d: buildLobby(code, currentMode, seats, guestIdx + 1) });
      });

      conn.on('data', (raw: unknown) => {
        const msg = parse(raw) as ToHost;

        if (msg.t === 'hello') {
          seats[guestIdx + 1] = { name: msg.d.name, assist: msg.d.assist, connected: true };
          refreshLobby();
        }

        if (msg.t === 'mode' && !s.world) {
          if (msg.d.mode === 'ffa' || msg.d.mode === 'coop') currentMode = msg.d.mode;
          refreshLobby();
        }

        if (msg.t === 'cmd' && s.world instanceof HostWorld) {
          (s.world as HostWorld).guestCmd((msg as { t: 'cmd'; d: { cmd: Command } }).d.cmd, guestIdx + 1);
        }

        if (msg.t === 'vote') {
          const vm = msg as { t: 'vote'; d: { choice: 'a' | 'b'; callId: string } };
          s._recordVote(guestIdx + 1, vm.d.choice, vm.d.callId, seats.length, guestConns);
        }
      });

      conn.on('close', () => {
        const pidx = guestConns.indexOf(conn) + 1;
        if (seats[pidx]) seats[pidx].connected = false;
        s.connected = seats.map((st) => st.connected);
        s.listeners.presence?.(s.connected);
        // Also notify guests
        const msg: ToGuest = { t: 'presence', d: { connected: s.connected } };
        for (const c of guestConns) if (c !== conn) send(c, msg);
      });

      refreshLobby();
    });

    peer.on('error', () => {
      if (!s.gone) s.listeners.closed?.(-1);
    });

    // Expose start/setMode bound to this session
    s._startFn = () => {
      if (s.world || seats.length < MIN_PLAYERS) return;
      const world = createMatch({
        seed: Date.now(),
        mode: currentMode,
        names: seats.map((st) => st.name),
        assist: seats.map((st) => st.assist),
      });
      const hostWorld = new HostWorld(world.s, guestConns);
      s.world = hostWorld;
      s.lobby = null;
      // Send full state to each guest
      guestConns.forEach((conn, i) => {
        send(conn, { t: 'full', d: { me: i + 1, state: world.s, tick: 0 } });
      });
      s.listeners.start?.();
    };

    s._setModeFn = (m: MatchMode) => {
      if (!s.world) { currentMode = m; refreshLobby(); }
    };

    // Host opens a cooperative vote for Звонок Контроля.
    s._openVoteFn = (callId: string) => {
      if (s._vote) return; // vote already in progress
      const votes = new Map<number, 'a' | 'b'>();
      const timer = setTimeout(() => {
        s._resolveVote(callId, votes, seats.length, guestConns);
      }, VOTE_TIMEOUT_MS);
      s._vote = { callId, votes, timer };
      for (const c of guestConns) send(c, { t: 'vote_open', d: { callId } });
      s.listeners.voteOpen?.(callId);
    };

    // Host casts their own vote (player index 0).
    s._castVoteFn = (choice: 'a' | 'b') => {
      if (!s._vote) return;
      s._recordVote(0, choice, s._vote.callId, seats.length, guestConns);
    };

    return s;
  }

  // ── Guest path ─────────────────────────────────────────────────────────────

  static async join(p: OnlineProfile, code: string): Promise<PeerSession> {
    const clean = code.trim().toUpperCase();
    const peer = await openPeer(); // random peer ID for guest
    const conn = peer.connect(PREFIX + clean, { reliable: true });

    const s = new PeerSession();
    s.peer = peer;
    s._code = clean;

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('connection timeout')), 15_000);
      conn.on('open', () => { clearTimeout(timeout); resolve(); });
      conn.on('error', (e: Error) => { clearTimeout(timeout); reject(e); });
    });

    // Say hello
    send(conn, { t: 'hello', d: { name: p.name, assist: p.assist } });

    conn.on('data', (raw: unknown) => {
      const msg = parse(raw) as ToGuest;
      if (msg.t === 'lobby') {
        s.lobby = msg.d;
        s.connected = msg.d.seats.map((st) => st.connected);
        const me = msg.d.seats.findIndex((st) => st.you);
        if (me >= 0) s.me = me;
        s.listeners.lobby?.(msg.d);
      }
      if (msg.t === 'full') {
        s.me = msg.d.me;
        s.lobby = null;
        if (s.world instanceof OnlineWorld) {
          s.world.reset(msg.d.state, msg.d.tick);
        } else {
          s.world = new OnlineWorld(msg.d.state, msg.d.tick, (cmd) => send(conn, { t: 'cmd', d: { cmd } }));
        }
        s.listeners.start?.();
      }
      if (msg.t === 'tick' && s.world instanceof OnlineWorld) {
        s.world.receive(msg.d as Parameters<OnlineWorld['receive']>[0]);
      }
      if (msg.t === 'presence') {
        s.connected = msg.d.connected;
        s.listeners.presence?.(msg.d.connected);
      }
      if (msg.t === 'vote_open') {
        // Track the active callId so castVote can include it in the message to host.
        s._vote = { callId: msg.d.callId, votes: new Map(), timer: 0 as unknown as ReturnType<typeof setTimeout> };
        s.listeners.voteOpen?.(msg.d.callId);
      }
      if (msg.t === 'vote_result') {
        s._vote = null;
        s.listeners.voteResult?.(msg.d);
      }
    });

    conn.on('close', () => {
      if (!s.gone) s.listeners.closed?.(1006);
    });

    conn.on('error', () => {
      if (!s.gone) s.listeners.closed?.(-1);
    });

    peer.on('error', () => {
      if (!s.gone) s.listeners.closed?.(-1);
    });

    s._startFn = () => send(conn, { t: 'start' });
    s._setModeFn = (m: MatchMode) => send(conn, { t: 'mode', d: { mode: m } });
    s._castVoteFn = (choice: 'a' | 'b') => {
      if (s._vote) send(conn, { t: 'vote', d: { choice, callId: s._vote.callId } });
    };

    return s;
  }

  // Quick match = host a room (guest clicks Create + shares code)
  static async quick(p: OnlineProfile, mode: MatchMode): Promise<PeerSession> {
    return PeerSession.create(p, mode);
  }

  // ── Common ─────────────────────────────────────────────────────────────────

  private _startFn: () => void = () => {};
  private _setModeFn: (m: MatchMode) => void = () => {};
  private _openVoteFn: (callId: string) => void = () => {};
  private _castVoteFn: (choice: 'a' | 'b') => void = () => {};

  start(): void { this._startFn(); }
  setMode(m: MatchMode): void { this._setModeFn(m); }

  /**
   * Host only: open a cooperative vote for the active Звонок Контроля.
   * Broadcasts `vote_open` to all guests and starts the 15s resolution timer.
   * Call this when `controlCall` becomes active in the host's World.
   */
  openVote(callId: string): void { this._openVoteFn(callId); }

  /**
   * Any player: cast a vote for the active call.
   * Host resolves when all connected players have voted or the 15s timer fires.
   * Guests send their choice to the host; the host votes locally.
   */
  castVote(choice: 'a' | 'b'): void { this._castVoteFn(choice); }

  /**
   * Host-side: record one vote. Resolves immediately when all connected players
   * have cast a choice (or waits for the 15s timeout).
   * @internal exposed for test access
   */
  _recordVote(
    pid: number,
    choice: 'a' | 'b',
    callId: string,
    totalSeats: number,
    guestConns: DataConnection[],
  ): void {
    const v = this._vote;
    if (!v || v.callId !== callId) return;
    v.votes.set(pid, choice);
    // Resolve early once everyone who is currently connected has voted.
    const connectedCount = 1 + guestConns.filter((c) => c.open).length;
    if (v.votes.size >= connectedCount) {
      clearTimeout(v.timer);
      this._resolveVote(callId, v.votes, totalSeats, guestConns);
    }
  }

  /**
   * Host-side: tally votes and broadcast the result.
   * Rules: simple majority of those who voted; host (pid 0) breaks ties;
   * nobody voted → 'b' (timeoutChoice).
   * @internal exposed for test access
   */
  _resolveVote(
    callId: string,
    votes: Map<number, 'a' | 'b'>,
    _totalSeats: number,
    guestConns: DataConnection[],
  ): void {
    if (!this._vote || this._vote.callId !== callId) return;
    clearTimeout(this._vote.timer);
    this._vote = null;

    let a = 0;
    let b = 0;
    for (const choice of votes.values()) {
      if (choice === 'a') a++;
      else b++;
    }

    let winner: 'a' | 'b';
    if (a === 0 && b === 0) {
      winner = 'b'; // nobody voted → timeout choice
    } else if (a === b) {
      winner = votes.get(0) ?? 'b'; // tie → host's vote (or 'b' if host abstained)
    } else {
      winner = a > b ? 'a' : 'b';
    }

    const result: VoteResult = { choice: winner, tally: { a, b } };
    const msg: ToGuest = { t: 'vote_result', d: result };
    for (const c of guestConns) send(c, msg);
    this.listeners.voteResult?.(result);
  }

  leave(): void {
    if (this.gone) return;
    this.gone = true;
    if (this._vote) { clearTimeout(this._vote.timer); this._vote = null; }
    try { this.peer.destroy(); } catch { /* ignore */ }
  }
}
