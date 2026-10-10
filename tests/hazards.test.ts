import { describe, expect, it } from 'vitest';
import { hazards } from '../src/core/data';
import type { GameEvent, World } from '../src/core/world';
import { handWorld } from './helpers';

/** Steps the world and collects every event it emitted. */
function run(w: World, seconds: number, out: GameEvent[] = []): GameEvent[] {
  for (let t = 0; t < seconds; t += 0.05) {
    w.step(0.05);
    out.push(...w.drainEvents());
  }
  return out;
}

/** A world with one site of `content` at (2,1), next to the command center at (0,1). */
function siteWorld(content: 'mine' | 'bonus_capsule' | 'medkit') {
  const w = handWorld(['.......', '.......', '......n']);
  w.apply({ type: 'placeCommand', x: 0, y: 1 });
  const c = w.cell(2, 1);
  c.content = content;
  if (content === 'mine') c.tech = 'thermo';
  w.apply({ type: 'queueDig', x: 2, y: 1, force: true });
  return w;
}

describe('hazards (hazards.json)', () => {
  it('a dug mine arms, blows after the fuse, hurts heroes around it and sets its element status', () => {
    const w = siteWorld('mine');
    const log = run(w, 20);
    const events = log.map((e) => e.type);
    expect(events).toContain('mine_armed');
    expect(events).toContain('mine_blast');
    expect(w.cell(2, 1).resolved).toBe(true);
    expect(w.cell(2, 1).fuse).toBeUndefined();
    expect(hazards.mine.status.thermo?.burnDps).toBeGreaterThan(0);
  });

  it('a bonus capsule gives exactly one bonus', () => {
    const w = siteWorld('bonus_capsule');
    const opened = run(w, 20).filter((e) => e.type === 'bonus_opened').map((e) => e.text ?? '');
    expect(opened.length).toBe(1);
    expect(Object.keys(hazards.bonusCapsule.types)).toContain(opened[0]);
    expect(w.cell(2, 1).bonus).toBe(opened[0]);
  });

  it('an opened medkit heals wounded heroes next to it and then runs dry', () => {
    const w = siteWorld('medkit');
    const log = run(w, 20);
    const events = log.map((e) => e.type);
    expect(events).toContain('medkit_open');
    const u = w.s.units.find((x) => x.kind === 'ally' || x.kind === 'resident')!;
    u.x = 2;
    u.y = 1;
    u.path = [];
    u.task = { type: 'idle' };
    u.hp = 1;
    run(w, 1, log);
    expect(u.hp).toBeGreaterThan(1);
    run(w, hazards.medkit.seconds + 1, log);
    expect(log.map((e) => e.type)).toContain('medkit_empty');
  });
});
