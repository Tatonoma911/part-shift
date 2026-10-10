import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Unit } from '../src/core/state';
import { handWorld } from './helpers';

const played: string[] = [];
vi.mock('../src/game/audio', () => ({
  sound: {
    playMusic: (id: string) => played.push(id),
    setLayers: () => {},
    play: () => {},
    playEnd: () => {},
    bossDown: () => played.push('aftermath'),
  },
}));

const { SoundDirector } = await import('../src/game/soundDirector');

function setup() {
  const w = handWorld(['.....', '.....', '.....']);
  const d = new SoundDirector(w, 0);
  const at = (t: number) => {
    // Tick twice a second up to t, like the scene does.
    while (w.s.time < t) {
      w.s.time = Math.min(t, w.s.time + 0.5);
      d.tick();
    }
  };
  const enemy = (extra: Partial<Unit> = {}) => {
    const u = { id: 900 + w.s.units.length, owner: -1, kind: 'adaptant', x: 4, y: 2, hp: 10, ...extra } as Unit;
    w.s.units.push(u);
    return u;
  };
  return { w, d, at, enemy, last: () => played[played.length - 1] };
}

describe('music stages', () => {
  beforeEach(() => (played.length = 0));

  it('starts on a safe ambient and escalates at once', () => {
    const { d, at, enemy, last } = setup();
    d.start();
    expect(last()).toMatch(/^ambient_/);
    enemy();
    at(1);
    expect(last()).toBe('run');
    enemy({ kind: 'hero', hero: 'kiln' } as Partial<Unit>);
    at(2);
    expect(last()).toBe('hero_hunt');
  });

  it('plays the raid from the siren and calms down only after a hold', () => {
    const { d, at, enemy, last } = setup();
    d.start();
    d.onEvent({ type: 'raid_incoming' } as never);
    at(0.5);
    expect(last()).toBe('raid');
    const r = enemy({ raid: 'b1' } as Partial<Unit>);
    at(20);
    expect(last()).toBe('raid');
    r.hp = 0;
    at(21);
    expect(last()).toBe('raid'); // not yet: the lower stage must be wanted a while
    at(35);
    expect(last()).toBe('run');
    const first = played.find((p) => p.startsWith('ambient_'));
    at(80);
    expect(last()).toMatch(/^ambient_/);
    expect(last()).not.toBe(first); // the safe ambients take turns
  });

  it('demon, then the calm after the storm', () => {
    const { w, d, at, last } = setup();
    d.start();
    w.s.boss.awake = true;
    d.onEvent({ type: 'boss_awake' } as never);
    expect(last()).toBe('demon');
    w.s.boss.dead = true;
    d.onEvent({ type: 'boss_dead' } as never);
    at(10);
    expect(last()).toBe('aftermath');
  });
});
