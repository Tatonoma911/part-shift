import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Unit } from '../src/core/state';
import { handWorld } from './helpers';

const played: string[] = [];
const sfx: string[] = [];
vi.mock('../src/game/audio', () => ({
  sound: {
    playMusic: (id: string) => played.push(id),
    setLayers: () => {},
    has: () => false,
    play: (id: string) => sfx.push(id),
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

  it('voices construction: hammer at the start, welds at 25/50/75 %', () => {
    const { w, d, at } = setup();
    d.start();
    sfx.length = 0;
    const b = { id: 77, type: 'home', owner: 0, x: 1, y: 1, hp: 50, built: 0, complete: false } as never as (typeof w.s.buildings)[number];
    w.s.buildings.push(b);
    const total = w.buildSeconds(b);
    for (const p of [0.05, 0.2, 0.3, 0.6, 0.8, 0.9]) {
      b.built = p * total;
      at(w.s.time + 0.5);
    }
    expect(sfx.filter((id) => id === 'hammer' || id === 'hammer_weld')).toEqual(['hammer', 'hammer_weld', 'hammer_weld', 'hammer_weld']);
  });
});

describe('event sounds from the wishlist audit', () => {
  // Every sound the audit asked for is in the manifest and plays for its event (or its rename).
  const WISH: [string, string][] = [
    ['mine_armed', 'mine_armed'],
    ['mine_blast', 'mine_blast'],
    ['mine_defused', 'mine_defused'],
    ['medkit_open', 'medkit_open'],
    ['medkit_use', 'medkit_use'],
    ['medkit_empty', 'medkit_empty'],
    ['bonus_opened', 'bonus_opened'],
    ['building_demolished', 'building_demolished'],
    ['building_boosted', 'building_boosted'],
    ['build_cancelled', 'build_cancelled'],
    ['building_upgraded', 'upgrade_chime'],
    ['call_incoming', 'control_call'],
    ['call_answered', 'call_answered'],
    ['call_complied', 'call_complied'],
    ['super_charged', 'super_charged'],
    ['tempo_level_up', 'tempo_up'],
  ];

  it('plays the sound for each event', () => {
    const { d } = setup();
    for (const [type, sound] of WISH) {
      sfx.length = 0;
      d.onEvent({ type } as never);
      expect(sfx, type).toContain(sound);
    }
  });

  it('every sound it names is in the manifest', async () => {
    const manifest = (await import('../src/assets/audio/sounds.json')).default as unknown as { sfx: Record<string, unknown> };
    for (const [, sound] of WISH) expect(manifest.sfx[sound], sound).toBeDefined();
  });
});

describe('event sounds from the long-run audit', () => {
  // Events that fired with no sound on the long run, and the sound each one gets now.
  const AUDIT: [string, string][] = [
    ['raid_cleared', 'wave_clear'],
    ['armor_crate_open', 'cache_open'],
    ['civilian_rescued', 'survivor_joined'],
    ['civilians_balance_lost', 'resident_die'],
    ['resident_limb_lost', 'defender_hit'],
    ['ally_limb_lost', 'defender_hit'],
    ['enemy_limb_lost', 'hero_part_taken'],
    ['limb_made', 'part_attached'],
    ['limb_regrown', 'healed'],
    ['blueprint_found', 'find_chime'],
    ['lore_found', 'find_chime'],
    ['boss_wake', 'demon_warning'],
  ];
  const SILENT = ['heal', 'hint', 'boss_call_fork', 'trophy_moved', 'trophy_recolored'];

  it('plays the sound for each event', () => {
    const { d } = setup();
    for (const [type, sound] of AUDIT) {
      sfx.length = 0;
      d.onEvent({ type } as never);
      expect(sfx, type).toContain(sound);
    }
  });

  it('keeps the silent events silent', () => {
    const { d } = setup();
    for (const type of SILENT) {
      sfx.length = 0;
      d.onEvent({ type } as never);
      expect(sfx, type).toEqual([]);
    }
  });

  it('every sound it names is in the manifest', async () => {
    const manifest = (await import('../src/assets/audio/sounds.json')).default as unknown as { sfx: Record<string, unknown> };
    for (const [, sound] of AUDIT) expect(manifest.sfx[sound], sound).toBeDefined();
  });
});
