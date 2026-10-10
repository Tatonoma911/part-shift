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
    const guest = await PeerSession.join({ name: 'Боря', assist: 'none' }, host.code);

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
    const guest = await PeerSession.join({ name: 'Боря', assist: 'none' }, host.code);

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
    const guest = await PeerSession.join({ name: 'P2', assist: 'none' }, host.code);

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
    const guest = await PeerSession.join({ name: 'Y', assist: 'none' }, host.code);
    guest.on({ closed: (code) => closedCodes.push(code) });

    await until(() => (host.lobby?.seats.length ?? 0) >= 2);

    host.leave(); // destroys peer → closes all DataConnections

    await until(() => closedCodes.length > 0, 2000);
    expect(closedCodes.length).toBeGreaterThan(0);
  });
});
