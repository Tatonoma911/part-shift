// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from '../server/app';
import { OnlineSession, setServerUrl } from '../src/net/online';

const PORT = 2591;
const server = createServer();
const until = async (ok: () => boolean, ms = 5000) => {
  const end = Date.now() + ms;
  while (!ok()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 20));
  }
};
/** Plays received steps the way GameScene does every frame. */
const pump = (s: OnlineSession) => setInterval(() => s.world?.tick(0.05), 50);

describe('match server', () => {
  beforeAll(async () => {
    await server.listen(PORT);
  });
  afterAll(async () => {
    await server.gracefullyShutdown(false);
  });

  it('two players meet by room code, play the same match, and a leaver loses the center', async () => {
    setServerUrl(`ws://localhost:${PORT}`);
    const a = await OnlineSession.create({ name: 'Аня', assist: 'full' }, 'coop');
    await until(() => !!a.lobby);
    expect(a.code).toMatch(/^[A-Z2-9]{5}$/);
    const b = await OnlineSession.join({ name: 'Боря', assist: 'off' }, a.code.toLowerCase());
    await until(() => a.lobby?.seats.length === 2 && b.lobby?.seats.length === 2);
    expect(a.lobby!.seats.map((s) => [s.name, s.host, s.you])).toEqual([['Аня', true, true], ['Боря', false, false]]);

    b.start(); // not the host: ignored
    await new Promise((r) => setTimeout(r, 150));
    expect(a.world).toBeNull();
    a.start();
    await until(() => !!a.world && !!b.world);
    expect([a.me, b.me]).toEqual([0, 1]);
    expect(b.world!.s.players[1].assist.mode).toBe('off');
    const timers = [pump(a), pump(b)];

    const c = a.world!.building(a.world!.s.players[0].command)!;
    expect(a.world!.apply({ type: 'queueDig', x: c.x + 2, y: c.y, force: true }, a.me).ok).toBe(true);
    await until(() => b.world!.s.players[0].queue.length + Number(b.world!.cell(c.x + 2, c.y).revealed) > 0);
    // Both clients see the same match.
    await new Promise((r) => setTimeout(r, 300));
    const at = Math.min(a.world!.lastTick, b.world!.lastTick);
    await until(() => a.world!.lastTick >= at && b.world!.lastTick >= at);
    expect(a.world!.s.cells).toEqual(b.world!.s.cells);

    a.leave();
    await until(() => b.world!.s.players[0].alive === false);
    expect(b.world!.s.outcome).toBe('playing');
    timers.forEach(clearInterval);
    b.leave();
  }, 20000);
});
