/**
 * One online match (design/MVP_RULES.md §14). The room runs the same src/core
 * World as the single-player game: clients only send commands, the server
 * applies them and ships what changed every step (src/net/patch.ts).
 */
import { Room, type Client } from '@colyseus/core';
import type { Command } from '../src/core/commands';
import { createMatch, multiplayer } from '../src/core/match';
import type { AssistMode, GameState, MatchMode } from '../src/core/state';
import { STEP, type World } from '../src/core/world';
import { diff } from '../src/net/patch';
import { TICK_MS, type JoinOptions, type LobbyInfo } from '../src/net/protocol';

/** Quick match starts this long after the second player arrives (or at once when full). */
const QUICK_COUNTDOWN = 20;
/** Lobby seats wait this long for a dropped player; in a match the rules say 60 s. */
const LOBBY_GRACE = 20;
/** A finished match stays open this long so everyone sees the result. */
const AFTER_MATCH = 60;
/** Local testing: SOLO=1 lets one player start a match alone. */
const MIN_PLAYERS = process.env.SOLO === '1' ? 1 : multiplayer.players.min;

const COMMANDS = new Set<Command['type']>(['placeCommand', 'queueDig', 'cancelDig', 'toggleMark', 'build', 'setRecruit', 'attack', 'cancelOrder', 'scan']);
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface Seat {
  sessionId: string;
  name: string;
  assist: AssistMode;
  connected: boolean;
  /** Left for good (consented leave or reconnection window over). */
  gone: boolean;
}

export function roomCode(): string {
  let s = '';
  for (let i = 0; i < 5; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

function cleanName(v: unknown, fallback: string): string {
  const s = typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) : '';
  return s || fallback;
}

export class MatchRoom extends Room {
  maxClients = multiplayer.players.max;
  maxMessagesPerSecond = 40;

  private mode: MatchMode = 'coop';
  private quick = false;
  private seats: Seat[] = [];
  private world: World | null = null;
  private sent: GameState | null = null;
  private tickNo = 0;
  private countdown: number | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;

  onCreate(options: Partial<JoinOptions>): void {
    this.roomId = roomCode();
    this.mode = options.mode === 'ffa' ? 'ffa' : 'coop';
    this.quick = !!options.quick;
    // Private rooms are joined by code only, never by quick match.
    if (!this.quick) void this.setPrivate(true);
    void this.setMetadata({ mode: this.mode });

    this.onMessage('cmd', (client: Client, msg: { cmd?: Command }) => {
      const pid = this.playerOf(client);
      const cmd = msg?.cmd;
      if (!this.world || pid < 0 || !cmd || typeof cmd !== 'object' || !COMMANDS.has(cmd.type)) return;
      const r = this.world.apply(cmd, pid);
      if (!r.ok) client.send('refused', { reason: r.reason });
    });
    this.onMessage('start', (client: Client) => {
      if (this.isHost(client) && !this.world && this.seats.length >= MIN_PLAYERS) this.startMatch();
    });
    this.onMessage('mode', (client: Client, msg: { mode?: MatchMode }) => {
      if (!this.isHost(client) || this.world || this.quick) return;
      this.mode = msg?.mode === 'ffa' ? 'ffa' : 'coop';
      this.sendLobby();
    });
  }

  onJoin(client: Client, options: Partial<JoinOptions>): void {
    this.seats.push({
      sessionId: client.sessionId,
      name: cleanName(options?.name, `Игрок ${this.seats.length + 1}`),
      assist: options?.assist === 'scanner' || options?.assist === 'off' ? options.assist : 'full',
      connected: true,
      gone: false,
    });
    if (this.quick) this.armCountdown();
    this.sendLobby();
  }

  async onDrop(client: Client): Promise<void> {
    const seat = this.seatOf(client);
    if (!seat) return;
    seat.connected = false;
    this.sendPresence();
    this.sendLobby();
    // The residents keep working meanwhile (MVP_RULES §14.2).
    await this.allowReconnection(client, this.world ? multiplayer.disconnectGraceSeconds : LOBBY_GRACE);
  }

  onReconnect(client: Client): void {
    const seat = this.seatOf(client);
    if (!seat) return;
    seat.connected = true;
    this.sendPresence();
    if (this.world) client.send('full', { me: this.seats.indexOf(seat), state: this.world.s, tick: this.tickNo });
    else this.sendLobby();
  }

  onLeave(client: Client): void {
    const seat = this.seatOf(client);
    if (!seat) return;
    seat.connected = false;
    seat.gone = true;
    if (this.world) {
      // Gone for good: the center falls, as the rules say for a lost connection.
      this.world.forfeit(this.seats.indexOf(seat));
      this.sendPresence();
      return;
    }
    this.seats = this.seats.filter((s) => s !== seat);
    if (this.quick) this.armCountdown();
    this.sendLobby();
  }

  onDispose(): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
  }

  // ---------------------------------------------------------------- lobby

  private seatOf(client: Client): Seat | undefined {
    return this.seats.find((s) => s.sessionId === client.sessionId);
  }

  private playerOf(client: Client): number {
    return this.seats.findIndex((s) => s.sessionId === client.sessionId);
  }

  private isHost(client: Client): boolean {
    return this.seats.find((s) => !s.gone)?.sessionId === client.sessionId;
  }

  private sendLobby(): void {
    if (this.world) return;
    const host = this.seats.find((s) => !s.gone);
    for (const client of this.clients) {
      const info: LobbyInfo = {
        code: this.roomId,
        mode: this.mode,
        quick: this.quick,
        min: MIN_PLAYERS,
        max: this.maxClients,
        countdown: this.countdown,
        seats: this.seats.map((s) => ({ name: s.name, connected: s.connected, host: s === host, you: s.sessionId === client.sessionId })),
      };
      client.send('lobby', info);
    }
  }

  private sendPresence(): void {
    if (this.world) this.broadcast('presence', { connected: this.seats.map((s) => s.connected) });
  }

  /** Quick match: count down once two are in, start at once when the room is full. */
  private armCountdown(): void {
    if (this.world) return;
    if (this.seats.length >= this.maxClients) return this.startMatch();
    if (this.seats.length < Math.max(2, MIN_PLAYERS)) {
      this.countdown = null;
      if (this.countdownTimer) clearInterval(this.countdownTimer);
      this.countdownTimer = null;
      return;
    }
    if (this.countdownTimer) return;
    this.countdown = QUICK_COUNTDOWN;
    this.countdownTimer = setInterval(() => {
      this.countdown = (this.countdown ?? 1) - 1;
      if (this.countdown <= 0) this.startMatch();
      else this.sendLobby();
    }, 1000);
  }

  // ---------------------------------------------------------------- match

  private startMatch(): void {
    if (this.world) return;
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.countdownTimer = null;
    this.countdown = null;
    void this.lock();
    // Seats that left before the start do not get a center.
    this.seats = this.seats.filter((s) => !s.gone);
    const world = createMatch({
      seed: Math.floor(Math.random() * 1e9),
      mode: this.mode,
      names: this.seats.map((s) => s.name),
      assist: this.seats.map((s) => s.assist),
    });
    this.world = world;
    this.sent = structuredClone(world.s);
    this.seats.forEach((seat, me) => this.clients.get(seat.sessionId)?.send('full', { me, state: world.s, tick: 0 }));
    // Anyone who dropped in the lobby and never came back loses the center like a mid-match drop.
    this.seats.forEach((seat, i) => {
      if (!seat.connected && !this.clients.get(seat.sessionId)) world.forfeit(i);
    });
    this.setSimulationInterval(() => this.step(), TICK_MS);
  }

  private step(): void {
    const w = this.world!;
    if (w.s.outcome !== 'playing') return;
    w.tick(STEP);
    const e = w.drainEvents();
    const p = diff(this.sent, w.s);
    this.sent = structuredClone(w.s);
    this.tickNo++;
    this.broadcast('tick', { n: this.tickNo, ...(p ? { p } : {}), ...(e.length ? { e } : {}) });
    if (w.s.outcome !== 'playing') {
      this.setSimulationInterval(undefined);
      this.clock.setTimeout(() => this.disconnect(), AFTER_MATCH * 1000);
    }
  }
}
