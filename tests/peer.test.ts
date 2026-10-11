/**
 * Unit tests for PeerSession protocol logic via mocked DataConnections.
 * Validates the P2P message protocol without requiring a real WebRTC stack.
 */
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── minimal EventEmitter shim ────────────────────────────────────────────────

type Handler = (...args: unknown[]) => void;

class FakeEmitter {
  private _h: Record<string, Handler[]> = {};
  on(ev: string, fn: Handler) { (this._h[ev] ??= []).push(fn); return this; }
  off(ev: string, fn: Handler) { this._h[ev] = (this._h[ev] ?? []).filter(f => f !== fn); return this; }
  emit(ev: string, ...args: unknown[]) { for (const fn of [...(this._h[ev] ?? [])]) fn(...args); }
}

// ── Fake DataConnection (bidirectional pipe) ─────────────────────────────────

function makePipe(): [FakeConn, FakeConn] {
  const a = new FakeConn();
  const b = new FakeConn();
  a._peer = b; b._peer = a;
  return [a, b];
}

class FakeConn extends FakeEmitter {
  open = true;
  _peer!: FakeConn;
  _sent: string[] = [];

  send(data: unknown) {
    const s = typeof data === 'string' ? data : JSON.stringify(data);
    this._sent.push(s);
    // Deliver async (microtask) so all synchronous setup finishes first
    if (this._peer?.open) void Promise.resolve().then(() => this._peer.emit('data', s));
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this._peer.open = false;
    void Promise.resolve().then(() => {
      this.emit('close');
      this._peer.emit('close');
    });
  }
}

// ── Fake Peer ─────────────────────────────────────────────────────────────────

class FakePeer extends FakeEmitter {
  id: string;
  destroyed = false;
  _conns: FakeConn[] = [];
  static _registry = new Map<string, FakePeer>();

  constructor(id?: string, _opts?: unknown) {
    super();
    this.id = id ?? `guest-${Math.random().toString(36).slice(2)}`;
    FakePeer._registry.set(this.id, this);
    setTimeout(() => this.emit('open', this.id), 0);
  }

  connect(targetId: string, _opts?: unknown): FakeConn {
    const target = FakePeer._registry.get(targetId);
    const [guestConn, hostConn] = makePipe();
    this._conns.push(guestConn);
    if (target) {
      target._conns.push(hostConn);
      setTimeout(() => {
        // 1. Register host listeners first
        target.emit('connection', hostConn);
        // 2. Open both ends — async delivery means host's data listeners are ready
        hostConn.emit('open');
        guestConn.emit('open');
      }, 5);
    }
    return guestConn;
  }

  destroy() {
    this.destroyed = true;
    FakePeer._registry.delete(this.id);
    for (const c of this._conns) c.close();
  }
}

// ── Vitest mock setup ────────────────────────────────────────────────────────

vi.mock('peerjs', () => ({ default: FakePeer }));
const { PeerSession } = await import('../src/net/peer');

// ── helpers ──────────────────────────────────────────────────────────────────

const until = (ok: () => boolean, ms = 4000) =>
  new Promise<void>((res, rej) => {
    const end = Date.now() + ms;
    const t = setInterval(() => {
      if (ok()) { clearInterval(t); res(); }
      else if (Date.now() > end) { clearInterval(t); rej(new Error(`timeout: ${ok.toString()}`)); }
    }, 10);
  });

// ── tests ────────────────────────────────────────────────────────────────────

describe('PeerSession P2P protocol', () => {
  beforeEach(() => { FakePeer._registry.clear(); });
  afterEach(() => { FakePeer._registry.clear(); vi.restoreAllMocks(); });

  it('host gets a 5-char code after create()', async () => {
    const host = await PeerSession.create({ name: 'Host', assist: 'full' }, 'coop');
    expect(host.code).toMatch(/^[A-Z2-9]{5}$/);
    expect(host.me).toBe(0);
    expect(host.lobby).not.toBeNull();
    host.leave();
  });

  it('guest lobby shows both players after joining', async () => {
    const host = await PeerSession.create({ name: 'Аня', assist: 'full' }, 'coop');
    const guest = await PeerSession.join({ name: 'Боря', assist: 'off' }, host.code);

    // State is set directly on session; check without relying on callback timing
    await until(() => !!guest.lobby && guest.lobby.seats.length >= 2);

    const info = guest.lobby!;
    expect(info.code).toBe(host.code);
    expect(info.seats.map((s) => s.name)).toContain('Боря');
    expect(info.seats.map((s) => s.name)).toContain('Аня');
    expect(info.seats.find((s) => s.you)?.name).toBe('Боря');
    expect(info.seats.find((s) => s.host)?.name).toBe('Аня');

    guest.leave(); host.leave();
  });

  it('host.start() fires start on both sides and sets worlds', async () => {
    const host = await PeerSession.create({ name: 'Аня', assist: 'full' }, 'coop');
    const guest = await PeerSession.join({ name: 'Боря', assist: 'off' }, host.code);

    await until(() => (host.lobby?.seats.length ?? 0) >= 2);

    host.start();

    await until(() => !!host.world && !!guest.world);

    expect(host.world).not.toBeNull();
    expect(guest.world).not.toBeNull();
    expect(host.me).toBe(0);
    expect(guest.me).toBe(1);

    guest.leave(); host.leave();
  });

  it('host ticks advance lastTick and guest catches up after draining buffer', async () => {
    const host = await PeerSession.create({ name: 'P1', assist: 'full' }, 'ffa');
    const guest = await PeerSession.join({ name: 'P2', assist: 'off' }, host.code);

    await until(() => (host.lobby?.seats.length ?? 0) >= 2);
    host.start();
    await until(() => !!host.world && !!guest.world);

    // Pump host ticks (same as GameScene's setInterval 50ms)
    for (let i = 0; i < 10; i++) {
      host.world!.tick(0.05);
      await new Promise((r) => setTimeout(r, 15)); // allow async delivery
      guest.world!.tick(0.05); // drain received buffer
    }

    const hw = host.world as { lastTick: number };
    const gw = guest.world as { lastTick: number };
    expect(hw.lastTick).toBeGreaterThan(0);
    // Guest lastTick catches up (buffer-drained). Allow ±1 for in-flight ticks.
    expect(Math.abs(hw.lastTick - gw.lastTick)).toBeLessThanOrEqual(2);

    guest.leave(); host.leave();
  });

  it('closed fires on guest when host disconnects', async () => {
    const closedCodes: number[] = [];

    const host = await PeerSession.create({ name: 'X', assist: 'full' }, 'coop');
    const guest = await PeerSession.join({ name: 'Y', assist: 'off' }, host.code);
    guest.on({ closed: (code) => closedCodes.push(code) });

    await until(() => (host.lobby?.seats.length ?? 0) >= 2);

    host.leave(); // destroys peer → closes all DataConnections

    await until(() => closedCodes.length > 0, 2000);
    expect(closedCodes.length).toBeGreaterThan(0);
  });
});

// ── Cooperative voting tests ─────────────────────────────────────────────────

describe('PeerSession cooperative voting', () => {
  beforeEach(() => { FakePeer._registry.clear(); });
  afterEach(() => { FakePeer._registry.clear(); vi.restoreAllMocks(); });

  /** Sets up a 2-player session connected and started. */
  async function setupCoop() {
    const host = await PeerSession.create({ name: 'Аня', assist: 'full' }, 'coop');
    const guest = await PeerSession.join({ name: 'Боря', assist: 'off' }, host.code);
    await until(() => (host.lobby?.seats.length ?? 0) >= 2);
    host.start();
    await until(() => !!host.world && !!guest.world);
    return { host, guest };
  }

  it('host openVote broadcasts vote_open to guest; guest fires voteOpen listener', async () => {
    const { host, guest } = await setupCoop();

    const guestOpened: string[] = [];
    guest.on({ voteOpen: (id) => guestOpened.push(id) });

    host.openVote('boss-serafim');

    await until(() => guestOpened.length > 0, 2000);
    expect(guestOpened[0]).toBe('boss-serafim');

    host.leave(); guest.leave();
  });

  it('simple majority (2:0) → winner is a', async () => {
    const { host, guest } = await setupCoop();

    const results: import('../src/net/peer').VoteResult[] = [];
    host.on({ voteResult: (r) => results.push(r) });

    host.openVote('boss-patchwork');

    // Both players vote 'a'; host receives last guest vote and resolves
    host.castVote('a');
    await until(() => !!host['_vote'], 1000); // vote is open
    guest.castVote('a');

    await until(() => results.length > 0, 2000);
    expect(results[0].choice).toBe('a');
    expect(results[0].tally).toEqual({ a: 2, b: 0 });

    host.leave(); guest.leave();
  });

  it('tie (1:1) → host choice wins', async () => {
    const { host, guest } = await setupCoop();

    const results: import('../src/net/peer').VoteResult[] = [];
    host.on({ voteResult: (r) => results.push(r) });

    host.openVote('boss-flow');
    host.castVote('a'); // host picks 'a'
    await until(() => !!host['_vote'], 1000);
    guest.castVote('b'); // guest picks 'b' → 1:1 tie

    await until(() => results.length > 0, 2000);
    expect(results[0].choice).toBe('a'); // host breaks tie
    expect(results[0].tally).toEqual({ a: 1, b: 1 });

    host.leave(); guest.leave();
  });

  it('nobody votes → timeout resolves to b', () => {
    // Test the resolution logic directly without waiting for the real 15s timer.
    // openVote starts the timer; _resolveVote can be called early for the test.
    const results: import('../src/net/peer').VoteResult[] = [];
    // We need a host-only session for this (no guest needed).
    // Create a minimal host session via the public API and test _resolveVote.
    const emptyVotes = new Map<number, 'a' | 'b'>();
    const fakeSession = Object.assign(Object.create(PeerSession.prototype) as PeerSession, {
      _vote: { callId: 'boss-current', votes: emptyVotes, timer: 0 },
      listeners: { voteResult: (r: import('../src/net/peer').VoteResult) => results.push(r) },
      gone: false,
    });
    fakeSession._resolveVote('boss-current', emptyVotes, 2, []);
    expect(results.length).toBe(1);
    expect(results[0].choice).toBe('b'); // nobody voted → timeoutChoice
    expect(results[0].tally).toEqual({ a: 0, b: 0 });
  });
});
