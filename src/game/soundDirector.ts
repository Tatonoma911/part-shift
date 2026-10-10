import { buildings, heroes } from '../core/data';
import type { GameEvent, World } from '../core/world';
import { sound } from './audio';

/**
 * Turns core events into sound ids and picks the music for the stage of the
 * run (audio/MUSIC.md, "Стадии"). Core event names mostly equal sound ids;
 * the rest are mapped here.
 */
const RENAME: Record<string, string> = {
  boss_warning: 'demon_warning',
  boss_awake: 'demon_awake',
  boss_dead: 'demon_die',
  training_up: 'defender_trained',
  hero_warning: 'quarantine_siren',
  raid_incoming: 'raid_siren',
};

/**
 * Music stages, calmest first. Escalation switches on the next bar; calming
 * down waits until the lower stage has been wanted for CALM_AFTER seconds
 * and the current one has played at least HOLD seconds.
 */
type Stage = 'ambient' | 'aftermath' | 'run' | 'hero_hunt' | 'raid' | 'last_stand' | 'demon';
const RANK: Record<Stage, number> = { ambient: 0, aftermath: 1, run: 2, hero_hunt: 3, raid: 4, last_stand: 5, demon: 6 };
const AMBIENTS = ['ambient_lumen', 'ambient_glass'];
const HOLD = 12;
const CALM_AFTER = 8;
/** Seconds without enemies, fights or alarms before the safe ambient comes back. */
const QUIET = 25;
/** Raid music from the siren until the raiders arrive (they lose `raid` once our heroes engage). */
const RAID_LEAD = 15;
/** "After the storm" plays this long after the call target falls. */
const AFTERMATH = 50;
/** Command center below this share of its HP with enemies on the board: last stand. */
const LAST_STAND = 0.35;

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
  private lastRaid = -1e9;
  /** Last tick with enemies on the board: the run music stays a while after the last one falls. */
  private lastEnemy = -1e9;
  private bossDeadAt = -1e9;
  private stage: Stage | null = null;
  private stageAt = 0;
  private calmSince: number | null = null;
  private ambient = 0;
  /** Construction progress already voiced per building: 0 = nothing, 1 = hammer, 2..4 = welds at 25/50/75 %. */
  private buildSteps = new Map<number, number>();

  constructor(
    private world: World,
    private me: number,
  ) {}

  /** Starts the right track for a fresh or loaded run. */
  start(): void {
    const s = this.world.s;
    if (s.outcome !== 'playing') return;
    this.ambient = Math.floor(Math.random() * AMBIENTS.length);
    this.go(this.want(), true);
  }

  onEvent(e: GameEvent): void {
    const now = this.world.s.time;
    if (BATTLE.has(e.type)) this.lastBattle = now;
    if (ALARM.has(e.type)) this.lastAlarm = now;
    switch (e.type) {
      case 'victory':
      case 'defeat':
        this.stage = null;
        sound.playEnd(e.type === 'victory');
        break;
      case 'raid_incoming':
        this.lastRaid = now;
        break;
      case 'boss_awake':
        this.go('demon');
        break;
      case 'boss_dead':
        this.bossDeadAt = now;
        this.stage = 'aftermath';
        this.stageAt = now;
        this.calmSince = null;
        sound.bossDown();
        break;
    }
    for (const id of this.idsFor(e)) sound.play(id);
  }

  private idsFor(e: GameEvent): string[] {
    const tech = e.text ? heroes[e.text]?.tech : undefined;
    switch (e.type) {
      case 'hero_spawn':
        // The city siren already sounded on hero_warning (~30 s before); the exit itself is the element hit.
        return [`hero_spawn_${tech ?? 'impact'}`];
      case 'hero_ability':
        return [`hero_ability_${tech ?? 'impact'}`];
      case 'build_place':
        // The dispatcher's radio click as the spot is confirmed, then the foundation clunk.
        return ['radio_click', 'build_place'];
      case 'build_done': {
        // Every building finishes with its own sound (buildings.json feel.sfx.done).
        const own = e.text ? `built_${e.text}` : '';
        return [sound.has(own) ? own : 'build_done'];
      }
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
    if (enemies.length) this.lastEnemy = s.time;
    const fighting = mine.some((u) => u.target !== undefined);
    const heroes = fighting || s.time - this.lastBattle < 20 ? 1 : mine.length ? 0.55 : 0;
    const ours = [...mine, ...s.buildings.filter((b) => b.owner === this.me)];
    const near = enemies.some((v) => ours.some((o) => Math.max(Math.abs(o.x - v.x), Math.abs(o.y - v.y)) < DANGER_RADIUS));
    if (near || s.time - this.lastAlarm < 8 || (s.boss.warned && !s.boss.awake)) this.dangerUntil = s.time + DANGER_HOLD;
    sound.setLayers(heroes, s.time < this.dangerUntil ? 1 : 0);
    this.construction();
    this.pickStage();
  }

  /** Hammer when work on our building starts, a weld at 25, 50 and 75 % (buildings.json feel.sfx). */
  private construction(): void {
    const s = this.world.s;
    for (const b of s.buildings) {
      if (b.owner !== this.me || b.complete || b.hp <= 0) {
        this.buildSteps.delete(b.id);
        continue;
      }
      const p = b.built / Math.max(0.001, this.world.buildSeconds(b));
      const step = p <= 0 ? 0 : 1 + Math.min(3, Math.floor(p * 4));
      const was = this.buildSteps.get(b.id) ?? 0;
      if (step > was) sound.play(was === 0 ? 'hammer' : 'hammer_weld');
      this.buildSteps.set(b.id, Math.max(was, step));
    }
  }

  /** The stage the board calls for right now (MUSIC.md, "Стадии"). */
  private want(): Stage {
    const s = this.world.s;
    if (s.boss.awake && !s.boss.dead) return 'demon';
    const enemies = s.units.filter((u) => u.owner < 0 && u.hp > 0);
    const center = s.buildings.find((b) => b.owner === this.me && b.type === 'command' && b.hp > 0);
    const max = center ? buildings[center.type]?.hp : undefined;
    if (center && max && enemies.length && center.hp / max < LAST_STAND) return 'last_stand';
    if (s.time - this.lastRaid < RAID_LEAD || enemies.some((u) => u.raid !== undefined)) return 'raid';
    if (enemies.some((u) => u.kind === 'hero')) return 'hero_hunt';
    if (s.time - this.bossDeadAt < AFTERMATH) return 'aftermath';
    const fighting = s.units.some((u) => u.owner === this.me && u.hp > 0 && u.target !== undefined);
    const recent = Math.max(this.lastBattle, this.lastAlarm, this.lastEnemy);
    if (enemies.length || fighting || s.time - recent < QUIET || (s.boss.warned && !s.boss.awake)) return 'run';
    return 'ambient';
  }

  private pickStage(): void {
    const s = this.world.s;
    const want = this.want();
    const cur = this.stage;
    if (cur === null || RANK[want] > RANK[cur]) return this.go(want);
    if (want === cur) {
      this.calmSince = null;
      return;
    }
    this.calmSince ??= s.time;
    if (s.time - this.calmSince >= CALM_AFTER && s.time - this.stageAt >= HOLD) this.go(want);
  }

  private go(stage: Stage, first = false): void {
    if (stage === 'ambient' && this.stage !== 'ambient' && !first) this.ambient = (this.ambient + 1) % AMBIENTS.length;
    this.stage = stage;
    this.stageAt = this.world.s.time;
    this.calmSince = null;
    sound.playMusic(stage === 'ambient' ? AMBIENTS[this.ambient] : stage);
  }
}
