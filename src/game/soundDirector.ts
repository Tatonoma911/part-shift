import { heroes } from '../core/data';
import type { GameEvent, World } from '../core/world';
import { sound } from './audio';

/**
 * Turns core events into sound ids and drives the run music layers
 * (audio/MUSIC.md). Core event names mostly equal sound ids; the rest
 * are mapped here.
 */
const RENAME: Record<string, string> = {
  boss_warning: 'demon_warning',
  boss_awake: 'demon_awake',
  boss_dead: 'demon_die',
  training_up: 'defender_trained',
  hero_warning: 'quarantine_siren',
  // No raid sound yet (sounds.json); the city siren stands in.
  raid_incoming: 'quarantine_siren',
};

/** Events that bring in the "heroes" layer for 20 s. */
const BATTLE = new Set(['nest_open', 'heavy_nest_open', 'nest_destroyed', 'part_attached', 'hero_part_taken', 'hero_spawn', 'hero_defeated']);
/** Events that bring in the "danger" layer for 8 s. */
const ALARM = new Set(['center_hit', 'building_lost', 'raid_incoming']);
const DANGER_RADIUS = 6;
const DANGER_HOLD = 8;

export class SoundDirector {
  private lastBattle = -1e9;
  private lastAlarm = -1e9;
  private dangerUntil = -1e9;
  private tickAt = 0;

  constructor(
    private world: World,
    private me: number,
  ) {}

  /** Starts the right track for a fresh or loaded run. */
  start(): void {
    const s = this.world.s;
    if (s.outcome !== 'playing') return;
    sound.playMusic(s.boss.awake && !s.boss.dead ? 'demon' : 'run');
  }

  onEvent(e: GameEvent): void {
    const now = this.world.s.time;
    if (BATTLE.has(e.type)) this.lastBattle = now;
    if (ALARM.has(e.type)) this.lastAlarm = now;
    switch (e.type) {
      case 'victory':
      case 'defeat':
        sound.playEnd(e.type === 'victory');
        break;
      case 'boss_awake':
        sound.playMusic('demon');
        break;
      case 'boss_dead':
        sound.bossDown();
        break;
    }
    for (const id of this.idsFor(e)) sound.play(id);
  }

  private idsFor(e: GameEvent): string[] {
    const tech = e.text ? heroes[e.text]?.tech : undefined;
    switch (e.type) {
      case 'hero_spawn':
        return [`hero_spawn_${tech ?? 'impact'}`, 'quarantine_siren'];
      case 'hero_ability':
        return [`hero_ability_${tech ?? 'impact'}`];
      case 'hit': {
        // An enemy landing a blow on one of our residents.
        const by = e.unit !== undefined ? this.world.s.units.find((u) => u.id === e.unit) : undefined;
        return by && by.owner < 0 && e.amount !== undefined ? ['defender_hit'] : [];
      }
      default:
        return [RENAME[e.type] ?? e.type];
    }
  }

  /** Twice a second: layer targets from the table in MUSIC.md. */
  tick(): void {
    const s = this.world.s;
    if (s.time - this.tickAt < 0.5 && s.time >= this.tickAt) return;
    this.tickAt = s.time;
    if (s.outcome !== 'playing') return;
    const mine = s.units.filter((u) => u.owner === this.me && u.hp > 0);
    const enemies = s.units.filter((u) => u.owner < 0 && u.hp > 0);
    const fighting = mine.some((u) => u.target !== undefined);
    const heroes = fighting || s.time - this.lastBattle < 20 ? 1 : mine.length ? 0.55 : 0;
    const ours = [...mine, ...s.buildings.filter((b) => b.owner === this.me)];
    const near = enemies.some((v) => ours.some((o) => Math.max(Math.abs(o.x - v.x), Math.abs(o.y - v.y)) < DANGER_RADIUS));
    if (near || s.time - this.lastAlarm < 8 || (s.boss.warned && !s.boss.awake)) this.dangerUntil = s.time + DANGER_HOLD;
    sound.setLayers(heroes, s.time < this.dangerUntil ? 1 : 0);
  }
}
