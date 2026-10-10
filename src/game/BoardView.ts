import Phaser from 'phaser';
import { buildings as buildingDefs, config, heroes as heroDefs, mapgen, parts as partDefs } from '../core/data';
import { cellKey } from '../core/grid';
import type { Building, Unit } from '../core/state';
import type { GameEvent, World } from '../core/world';
import { animSets, BUILDING_ANCHOR, originOf } from './assets';
import { sound } from './audio';
import { C, CELL, STEP, TECH_COLOR } from './layout';
import { buzz, comfort } from './comfort';
import { Quarantine, type RevealKind } from './Quarantine';
import { Bars, drawWeakOrbs, weaknessesOf, type Weakness } from './Vitals';
import { glyph } from './ui';
import { drawMark, drawSensor, sensorTexts, type MarkKind } from './Sensor';

const CHANNELS = ['finds', 'threat', 'demon'] as const;
const GROUND = ['ground_0', 'ground_1', 'ground_0', 'ground_grass_0', 'ground_1', 'ground_grass_1', 'ground_0', 'ground_grass_2'];
const FEET = 46;

/** Depths, bottom to top (UI_SPEC §2.3). */
const D = { backdrop: 0, tile: 1, site: 2, film: 3, overlay: 4, clue: 5, building: 10, arc: 11.9, unit: 12, top: 14, float: 15 };

interface UnitView {
  spr: Phaser.GameObjects.Sprite;
  ring?: Phaser.GameObjects.Image;
  set: string;
  /** Sim positions before and after the last fixed step; the sprite is drawn between them. */
  prevX: number;
  prevY: number;
  curX: number;
  curY: number;
  simT: number;
  lastCd: number;
  oneShot: boolean;
  windup: boolean;
  anim: string;
  /** Element tint that status tints fall back to (stand-in adaptants). */
  tint?: number;
}

export interface ViewState {
  /** Building type being placed, to light up cells where it fits. */
  buildType: string | null;
  ghost: { x: number; y: number } | null;
  spotlight: { x: number; y: number } | null;
  focus: { x: number; y: number }[];
  /** Assist mode "full": show the risk glow around visible numbers (UI_SPEC §3.2). */
  showRisk: boolean;
  /** Light all liberated land for a moment (after a tap outside it). */
  showTerritory?: boolean;
  /** Bouncing arrow over the nearest free liberated cell. */
  pointTo?: { x: number; y: number } | null;
}

function hash(x: number, y: number): number {
  return (Math.imul(x + 17, 73856093) ^ Math.imul(y + 31, 19349663)) >>> 0;
}


/** Residents fight now; their swing, flinch and limb install come from the animator's fighter sheet. */
const RESIDENT_COMBAT_SET = 'defender';
/** Starter heroes (MVP_RULES §4) whose drawn sheets stand in for workers until v0.7 spawns real heroes. */
const STARTER_LOOKS = ['standard', 'patch', 'canopy', 'current'];
/** block_fx / lair_fx are drawn at 2× (a block is ~104 px wide in the frame). */
const FX2 = 0.5;
const BLOCK_EL = ['thermo', 'cryo', 'volt', 'impact', 'toxin'];
const DECOR_EL = ['cryo', 'volt', 'impact'];
const CIVILIANS = ['civilian_office', 'civilian_courier', 'civilian_granny'];
/** Game slot ids → the short names the limb-mask sets use in `slots`. */
const SLOT_SHORT: Record<string, string> = { arm_left: 'arm_l', arm_right: 'arm_r', leg_left: 'leg_l', leg_right: 'leg_r', tail: 'tail', wings: 'wings' };

function elementOf(tech: string | undefined, pool = BLOCK_EL): string {
  if (tech === 'demon') return tech;
  return tech && pool.includes(tech) ? tech : 'impact';
}

function hitOf(tech: string | undefined): string {
  return tech === 'thermo' ? 'hit_thermo' : tech === 'cryo' ? 'hit_cryo' : tech === 'volt' || tech === 'toxin' ? 'hit_volt' : 'hit_impact';
}

/**
 * Draws the board from the artist's tiles and the animator's sheets.
 * Reads World only; input and HUD live in GameScene.
 */
export class BoardView {
  readonly bx: number;
  readonly by: number;
  readonly width: number;
  readonly height: number;
  private readonly tiles: Phaser.GameObjects.Image[] = [];
  private readonly tileKey: string[] = [];
  private readonly film: Phaser.GameObjects.Image[] = [];
  private readonly hot = new Map<number, Phaser.GameObjects.Image>();
  private readonly haze = new Map<number, Phaser.GameObjects.Sprite>();
  private readonly sparks = new Map<number, Phaser.GameObjects.Sprite>();
  /** Pulsing glow over nests that are still alive (nest_live, AR-05). */
  private readonly nestGlow = new Map<number, Phaser.GameObjects.Sprite>();
  private readonly sites = new Map<string, Phaser.GameObjects.Sprite>();
  /** Animated decor over some closed blocks (block_fx loop_*). */
  private readonly decor = new Map<number, Phaser.GameObjects.Sprite>();
  /** Live portal over each open nest / hero lair (lair_fx), keyed by site key. */
  private readonly lairs = new Map<string, { spr: Phaser.GameObjects.Sprite; el: string; busy: boolean; dead: boolean }>();
  /** Trophy limbs drawn over our heroes (ally_*_limbs masks), per unit then per slot. */
  private readonly trophies = new Map<number, Map<string, Phaser.GameObjects.Sprite>>();
  private readonly clueTexts = new Map<number, Phaser.GameObjects.Text[]>();
  private readonly buildingViews = new Map<number, { spr: Phaser.GameObjects.Sprite; state: string; type: string; x: number; y: number }>();
  private readonly units = new Map<number, UnitView>();
  private readonly orbs: Phaser.GameObjects.Sprite[] = [];
  private readonly orbViews = new Map<string, { spr: Phaser.GameObjects.Sprite; trail: number }>();
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly clueG: Phaser.GameObjects.Graphics;
  private readonly arcG: Phaser.GameObjects.Graphics;
  private readonly topG: Phaser.GameObjects.Graphics;
  private ghostSpr: Phaser.GameObjects.Image | null = null;
  private zoneG?: Phaser.GameObjects.Graphics;
  private lost: GameEvent[] = [];
  private readonly quarantine: Quarantine;
  private readonly vitals = new Bars();
  private readonly weakCache = new Map<number, Weakness[]>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: World,
    bx: number,
    by: number,
    /** The player this screen belongs to (online: the server's seat number). */
    private readonly me = 0,
  ) {
    this.bx = bx;
    this.by = by;
    const { width, height } = world.s;
    this.width = width * STEP - (STEP - CELL);
    this.height = height * STEP - (STEP - CELL);

    const back = scene.add.graphics().setDepth(D.backdrop);
    back.fillStyle(C.night, 1);
    back.fillRect(bx - 6, by - 6, this.width + 12, this.height + 12);

    this.makeFilm();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.tiles.push(scene.add.image(bx + x * STEP, by + y * STEP, 'tile.closed_0').setOrigin(0).setDepth(D.tile));
        this.tileKey.push('');
        this.film.push(
          scene.add
            .image(bx, by, 'hexfilm')
            .setOrigin(0)
            .setCrop(x * STEP, y * STEP, CELL, CELL)
            .setDepth(D.film),
        );
      }
    }
    this.overlay = scene.add.graphics().setDepth(D.overlay);
    this.clueG = scene.add.graphics().setDepth(D.clue + 0.1);
    this.arcG = scene.add.graphics().setDepth(D.arc);
    this.topG = scene.add.graphics().setDepth(D.top);
    this.quarantine = new Quarantine(scene, world, bx, by, this.width, this.height);
  }

  /** Quarantine film over closed blocks: one hex pattern across the whole board (BRAND_UI "Поле"). */
  private makeFilm(): void {
    if (this.scene.textures.exists('hexfilm')) this.scene.textures.remove('hexfilm');
    const tex = this.scene.textures.createCanvas('hexfilm', this.width, this.height)!;
    const ctx = tex.getContext();
    const r = 15;
    const w = Math.sqrt(3) * r;
    ctx.strokeStyle = 'rgba(87,216,242,0.30)';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = 'rgba(17,90,128,0.16)';
    ctx.fillRect(0, 0, this.width, this.height);
    for (let row = -1; row * r * 1.5 < this.height + r; row++) {
      for (let col = -1; col * w < this.width + w; col++) {
        const cx = col * w + (row % 2 ? w / 2 : 0);
        const cy = row * r * 1.5;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i + Math.PI / 6;
          const px = cx + r * Math.cos(a);
          const py = cy + r * Math.sin(a);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
    tex.refresh();
  }

  // --------------------------------------------------------------- geometry

  /** Pixel center of a (possibly fractional) cell position. */
  center(x: number, y: number): { x: number; y: number } {
    return { x: this.bx + x * STEP + CELL / 2, y: this.by + y * STEP + CELL / 2 };
  }

  /** Where a speech bubble goes: over a unit's head, else over a cell. */
  speakerAt(at: { unit?: number; x?: number; y?: number }): { x: number; y: number } | null {
    const v = at.unit !== undefined ? this.units.get(at.unit) : undefined;
    if (v) return { x: v.spr.x, y: v.spr.y - v.spr.displayHeight * 0.85 };
    if (at.x === undefined || at.y === undefined) return null;
    const p = this.center(at.x, at.y);
    return { x: p.x, y: p.y - CELL / 2 };
  }

  cellAt(px: number, py: number): { x: number; y: number } | null {
    const x = Math.floor((px - this.bx + (STEP - CELL) / 2) / STEP);
    const y = Math.floor((py - this.by + (STEP - CELL) / 2) / STEP);
    return x >= 0 && y >= 0 && x < this.world.s.width && y < this.world.s.height ? { x, y } : null;
  }

  /** Enemy whose sprite is under the finger (sprites stand taller than a cell). */
  /** The enemy under a tap: generous radius around the drawn sprite (body, not feet), so moving targets are easy to hit (QA). */
  enemyAt(px: number, py: number): Unit | undefined {
    let best: Unit | undefined;
    let bestD = Infinity;
    for (const u of this.world.s.units) {
      if (u.owner >= 0 || u.hp <= 0) continue;
      const v = this.units.get(u.id);
      const c = v ? { x: v.spr.x, y: v.spr.y - v.spr.displayHeight * 0.4 } : { ...this.center(u.x, u.y), y: this.center(u.x, u.y).y - 14 };
      const reach = Math.max(80, (v?.spr.displayHeight ?? 0) * 0.7);
      const d = Math.hypot(c.x - px, c.y - py);
      if (d < reach && d < bestD) {
        bestD = d;
        best = u;
      }
    }
    return best;
  }


  // ----------------------------------------------------------------- events

  /** One-shot effect from the animator's fx sheet, centered on a board pixel. */
  private fx(anim: string, x: number, y: number, scale = 1, depth = D.top - 0.5): void {
    // Combat hits and explosions use the animator's big outlined sheet (2×2 cells, centred; ANIM_SPEC §6, AR-04).
    const big = `fx_big.${anim}_big`;
    if (this.scene.anims.exists(big)) {
      const s = this.scene.add.sprite(x, y, 'fx_big').setScale(Math.max(0.6, scale * 0.55)).setDepth(depth);
      s.play(big).once('animationcomplete', () => s.destroy());
      return;
    }
    if (!this.scene.anims.exists(`fx.${anim}`)) return;
    const s = this.scene.add.sprite(x, y, 'fx').setScale(scale).setDepth(depth);
    s.play(`fx.${anim}`).once('animationcomplete', () => s.destroy());
  }

  /** White flash on the struck target, in time with the attacker's swing. */
  private flash(x: number, y: number, scale: number): void {
    if (!this.scene.anims.exists('fx_big.hit_flash')) return;
    const s = this.scene.add.sprite(x, y, 'fx_big').setScale(scale).setDepth(D.top - 0.4);
    s.play('fx_big.hit_flash').once('animationcomplete', () => s.destroy());
  }

  private fxAtCell(anim: string, x: number, y: number, scale = 1): void {
    const p = this.center(x, y);
    this.fx(anim, p.x, p.y, scale);
  }

  /** Where a target string ("u:id", "s:x,y", "b:id") stands, in board pixels. */
  private targetPos(target: string | undefined): { x: number; y: number } | null {
    if (!target) return null;
    const w = this.world;
    if (target.startsWith('u:')) {
      const u = w.s.units.find((o) => `u:${o.id}` === target);
      return u ? { x: this.center(u.x, u.y).x, y: this.center(u.x, u.y).y - 8 } : null;
    }
    if (target.startsWith('s:')) {
      const [x, y] = target.slice(2).split(',').map(Number);
      return this.center(x, y);
    }
    const b = w.building(Number(target.slice(2)));
    return b ? { x: this.center(b.x, b.y).x, y: this.center(b.x, b.y).y - 20 } : null;
  }

  /** Hit effect by the element the attacker strikes with. */
  private hitAnim(u: Unit, target?: Unit): string {
    const tech = this.world.attackOf(u, target).tech;
    if (tech === 'thermo') return 'hit_thermo';
    if (tech === 'cryo') return 'hit_cryo';
    if (tech === 'volt' || tech === 'toxin') return 'hit_volt';
    return 'hit_impact';
  }

  onEvent(e: GameEvent): void {
    const sc = this.scene;
    if (e.x === undefined || e.y === undefined) {
      if (e.type === 'demon_blast') this.shake(150, 0.004);
      return;
    }
    const at = (anim: string) => {
      const p = { x: this.bx + Math.round(e.x!) * STEP, y: this.by + Math.round(e.y!) * STEP };
      const s = sc.add.sprite(p.x, p.y, 'fx').setOrigin(0).setDepth(D.top - 0.5);
      s.play(anim).once('animationcomplete', () => s.destroy());
    };
    switch (e.type) {
      case 'dig_done': {
        at('fx.dig_dust');
        const content = this.world.cell(e.x, e.y).content;
        const kind: RevealKind =
          content === 'cache' ? 'cache' : content === 'survivor' ? 'survivor' : content === 'nest' || content === 'heavy_nest' ? 'nest' : content === 'boss_hatch' || content === 'hero_lair' ? 'hatch' : 'safe';
        this.quarantine.reveal(e.x, e.y, `closed_${hash(e.x, e.y) % 4}`, kind);
        this.openBlock(e.x, e.y);
        const i = e.y * this.world.s.width + e.x;
        const t = this.tiles[i];
        t.setScale(0.55).setPosition(t.x + CELL * 0.225, t.y + CELL * 0.225);
        sc.tweens.add({ targets: t, scale: 1, x: this.bx + e.x * STEP, y: this.by + e.y * STEP, duration: 350, ease: 'Back.out' });
        break;
      }
      case 'cache_open':
        at('fx.cache_open');
        break;
      case 'resident_born':
        at('fx.resident_born');
        break;
      case 'energy_orb_arrive': {
        if (!animSets.fx_energy) {
          at('fx.energy_arrive');
          break;
        }
        // Absorbed by the command centre: a burst on the roof and a ring at its foot.
        const p = this.center(e.x, e.y);
        const burst = sc.add.sprite(p.x, p.y - 30, 'fx_energy').setScale(0.7).setDepth(D.top - 0.4);
        burst.play('fx_energy.arrive_burst').once('animationcomplete', () => burst.destroy());
        const ring = sc.add.sprite(p.x, p.y + 6, 'fx_energy').setScale(0.7).setDepth(D.building + 0.5);
        ring.play('fx_energy.arrive_ring').once('animationcomplete', () => ring.destroy());
        break;
      }
      case 'center_hit':
        this.shake(100, 0.002);
        buzz(30);
        break;
      case 'demon_blast': {
        this.shake(220, 0.006);
        // Steam blast: a line of explosions in the wind-up direction.
        const demon = this.world.s.units.find((u) => u.id === e.unit);
        const b = demon?.blast;
        const dv = demon && this.units.get(demon.id);
        if (dv && animSets[dv.set].anims.steam) this.oneShot(dv, 'steam');
        for (let k = 0; k <= 3; k++) {
          const p = this.center(e.x + (b?.dx ?? 0) * k, e.y + (b?.dy ?? 0) * k);
          sc.time.delayedCall(k * 70, () => this.fx('explosion', p.x, p.y, 1.3));
        }
        break;
      }
      case 'building_lost':
        this.lost.push(e);
        buzz([40, 40, 80]);
        this.fxAtCell('explosion', e.x, e.y, 1.8);
        this.shake(160, 0.004);
        break;
      case 'nest_open':
      case 'heavy_nest_open':
        this.fxAtCell('explosion', e.x, e.y, e.type === 'heavy_nest_open' ? 2 : 1.5);
        buzz(70);
        this.shake(180, 0.004);
        break;
      case 'nest_destroyed':
        this.fxAtCell('explosion', e.x, e.y, 2);
        this.shake(200, 0.005);
        break;
      case 'enemy_die':
        this.fxAtCell('explosion', e.x, e.y, 0.9);
        break;
      case 'hero_defeated':
        for (let k = 0; k < 5; k++) sc.time.delayedCall(k * 160, () => this.fxAtCell('explosion', e.x! + (k % 2 ? 0.5 : -0.5) * (k > 2 ? 1 : 0.4), e.y! - 0.3 * k, 2.4));
        this.shake(600, 0.008);
        break;
      case 'hero_spawn':
        this.fxAtCell('explosion', e.x, e.y, 2.2);
        this.shake(300, 0.006);
        break;
      case 'hero_ability': {
        const hv = e.unit !== undefined ? this.units.get(e.unit) : undefined;
        if (hv && animSets[hv.set].anims.attack) this.oneShot(hv, 'attack');
        const tech = this.world.unit(e.unit)?.attackTech;
        this.fxAtCell(tech === 'thermo' ? 'hit_thermo' : tech === 'cryo' ? 'hit_cryo' : tech === 'volt' || tech === 'toxin' ? 'hit_volt' : 'hit_impact', e.x, e.y, 2.2);
        break;
      }
      case 'reaction':
      case 'frozen':
        this.fxAtCell(e.type === 'frozen' ? 'hit_cryo' : 'explosion', e.x, e.y - 0.4, 1.4);
        break;
      case 'resident_die':
        this.fxAtCell('hit_impact', e.x, e.y, 1.2);
        break;
      case 'part_attached':
      case 'hero_part_taken': {
        // Instant limb swap: a flash on the resident and the install animation.
        const v = e.unit !== undefined ? this.units.get(e.unit) : undefined;
        if (v) this.oneShot(v, 'install_part', v.set === 'resident' ? RESIDENT_COMBAT_SET : v.set);
        const p = this.center(e.x, e.y);
        this.fx('energy_arrive', p.x, p.y - 26, 1.4);
        this.fx('hit_volt', p.x, p.y - 26, 0.9);
        break;
      }
      case 'part_recycled':
        this.fxAtCell('energy_arrive', e.x, e.y, 1.2);
        break;
      case 'survivor_joined':
        this.rescueRun(e.x, e.y, e.owner ?? this.me);
        break;
      case 'enemy_spawn': {
        const from = e.unit !== undefined ? this.world.unit(e.unit)?.nest : undefined;
        if (from) this.releaseFrom(from);
        break;
      }
    }
    if (e.type === 'hero_spawn') this.releaseFrom(cellKey(Math.round(e.x), Math.round(e.y)));
  }

  /** The block caves in by its element (block_fx open_*), then fades off the freshly revealed tile. */
  private openBlock(x: number, y: number): void {
    const c = this.world.cell(x, y);
    const el = c.tech ? elementOf(c.tech) : BLOCK_EL[hash(x, y) % BLOCK_EL.length];
    const key = `block_fx.open_${el}`;
    if (!this.scene.anims.exists(key)) return;
    const p = this.center(x, y);
    const s = this.scene.add.sprite(p.x, p.y + CELL / 2, 'block_fx').setOrigin(...originOf('block_fx')).setScale(FX2).setDepth(D.site + 0.7);
    s.play(key).once('animationcomplete', () => this.scene.tweens.add({ targets: s, alpha: 0, duration: 220, onComplete: () => s.destroy() }));
  }

  /** A rescued townsperson waves for help, runs to our command centre and cheers there (civilian_* sheets). */
  private rescueRun(x: number, y: number, owner: number): void {
    const kinds = CIVILIANS.filter((k) => animSets[k]);
    if (!kinds.length) return;
    const set = kinds[hash(x, y) % kinds.length];
    const p = this.center(x, y);
    const fy = p.y - CELL / 2 + FEET;
    const spr = this.scene.add.sprite(p.x, fy, set).setOrigin(...originOf(set)).setDepth(D.unit + fy / 4000).play(`${set}.help`);
    const fade = (delay: number) => this.scene.tweens.add({ targets: spr, alpha: 0, delay, duration: 300, onComplete: () => spr.destroy() });
    const cmd = this.world.s.buildings.find((b) => b.owner === owner && b.type === 'command');
    if (!cmd) return void fade(1500);
    const c = this.center(cmd.x, cmd.y);
    const dx = c.x - p.x;
    const dy = c.y - CELL / 2 + FEET - fy;
    const dist = Math.hypot(dx, dy);
    // Stop just short of the building, on the side the runner comes from.
    const stop = dist > 1 ? Math.min(1, (CELL * 0.6) / dist) : 0;
    const tx = c.x - dx * stop;
    const ty = fy + dy * (1 - stop);
    this.scene.time.delayedCall(1100, () => {
      if (!spr.active) return;
      const up = dy < -Math.abs(dx) * 0.6 && animSets[set].anims.run_up;
      spr.play(`${set}.${up ? 'run_up' : 'run'}`).setFlipX(!up && dx < 0);
      this.scene.tweens.add({
        targets: spr,
        x: tx,
        y: ty,
        duration: Math.max(400, (dist / 120) * 1000),
        onUpdate: () => spr.setDepth(D.unit + spr.y / 4000),
        onComplete: () => {
          spr.play(`${set}.cheer`).setFlipX(false);
          if (this.scene.anims.exists('block_fx.rescued')) {
            const f = this.scene.add.sprite(c.x, c.y + CELL / 2, 'block_fx').setOrigin(...originOf('block_fx')).setScale(FX2).setDepth(D.top - 0.4);
            f.play('block_fx.rescued').once('animationcomplete', () => f.destroy());
          }
          fade(1200);
        },
      });
    });
  }

  /** The lair's portal flares as it lets an enemy out, then goes back to idling. */
  private releaseFrom(siteKey: string): void {
    const l = this.lairs.get(siteKey);
    const key = l && `lair_fx.release_${l.el}`;
    if (!l || l.busy || !key || !this.scene.anims.exists(key)) return;
    l.busy = true;
    l.spr.play(key).once('animationcomplete', () => {
      l.busy = false;
      if (l.spr.active) l.spr.play(`lair_fx.idle_${l.el}`);
    });
  }

  /** Shake only the board camera; HUD and dock stay still. */
  private shake(ms: number, intensity: number): void {
    if (!comfort().shake) return;
    const cams = this.scene.cameras.cameras;
    (cams[1] ?? cams[0]).shake(ms, intensity);
  }

  // ----------------------------------------------------------------- update

  update(now: number, view: ViewState): void {
    const w = this.world;
    const s = w.s;
    const me = w.player(this.me);
    const known = w.started ? w.visibleKnowledge(this.me) : new Map<string, string>();
    const risk = view.showRisk && w.started ? this.riskMap() : null;
    const og = this.overlay;
    const cg = this.clueG;
    og.clear();
    cg.clear();
    this.topG.clear();
    const frame4 = Math.floor(now / 250) % 4;
    const frame3 = Math.floor(now / 300) % 3;
    const flicker = 0.8 + 0.12 * Math.sin(now / 900);
    this.quarantine.update(now);
    const veinFull = mapgen.energyVein.energy;

    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        const i = y * s.width + x;
        const c = w.cell(x, y);
        const px = this.bx + x * STEP;
        const py = this.by + y * STEP;
        const h = hash(x, y);
        let key: string;
        if (!c.revealed) key = `closed_${h % 4}`;
        else {
          switch (c.content) {
            case 'water':
              key = `water_${(frame4 + h) % 4}`;
              break;
            case 'rubble':
              key = (c.stock ?? 0) > 0 ? `rubble_${h % 2}` : GROUND[h % 8];
              break;
            case 'energy_vein': {
              const left = (c.stock ?? 0) / veinFull;
              key = left > 0 ? `vein_${left > 0.67 ? 0 : left > 0.34 ? 1 : 2}_${(frame3 + h) % 3}` : GROUND[h % 8];
              break;
            }
            case 'cache':
              key = c.resolved ? GROUND[h % 8] : 'cache';
              break;
            case 'blueprint':
              key = c.resolved ? GROUND[h % 8] : 'cache';
              break;
            case 'armor_crate':
              key = c.resolved ? GROUND[h % 8] : 'cache';
              break;
            case 'lore_record':
              key = c.resolved ? GROUND[h % 8] : 'cache';
              break;
            case 'survivor':
              key = c.resolved ? GROUND[h % 8] : (this.scene.textures.exists('survivor') ? 'survivor' : 'cache');
              break;
            case 'nest':
            case 'heavy_nest': {
              const dead = c.resolved || w.site(x, y)?.destroyed;
              const tech = c.tech;
              // Use elemental nest sprite when art exists (nests_gpt/).
              const nestGptKey = tech ? `nest_gpt.nest_${tech}_0${dead ? '_cleared' : ''}` : null;
              if (nestGptKey && this.scene.textures.exists(nestGptKey)) {
                key = nestGptKey;
              } else {
                key = (c.content === 'nest' ? 'nest' : 'nest_heavy') + (dead ? '_dead' : '');
              }
              break;
            }
            case 'boss_hatch':
              key = `hatch_${s.boss.awake || s.boss.dead ? 2 : s.boss.warned ? 1 : 0}`;
              break;
            case 'hero_lair':
              key = c.resolved ? GROUND[h % 8] : 'hatch_2';
              break;
            default:
              key = GROUND[h % 8];
          }
          // Ruins of a lost building: rubble until it is rebuilt at half price.
          if (c.ruin && c.building === undefined) key = `rubble_${h % 2}`;
        }
        if (this.tileKey[i] !== key) {
          this.tiles[i].setTexture(`tile.${key}`);
          this.tileKey[i] = key;
        }
        this.film[i].setVisible(!c.revealed).setAlpha(flicker);
        const sparking = c.revealed && c.content === 'energy_vein' && (c.stock ?? 0) > 0;
        let spark = this.sparks.get(i);
        if (sparking && !spark) {
          spark = this.scene.add.sprite(px, py, 'fx').setOrigin(0).setDepth(D.site + 0.4).play('fx.vein_spark');
          this.sparks.set(i, spark);
        }
        spark?.setVisible(sparking);
        const living = c.revealed && (c.content === 'nest' || c.content === 'heavy_nest') && !c.resolved && !w.site(x, y)?.destroyed;
        let glow = this.nestGlow.get(i);
        if (living && !glow && this.scene.anims.exists('nest_live.live')) {
          glow = this.scene.add.sprite(px, py, 'nest_live').setOrigin(0).setDepth(D.site + 0.3);
          glow.play({ key: 'nest_live.live', startFrame: h % 6 });
          this.nestGlow.set(i, glow);
        }
        glow?.setVisible(living);
        this.updateHot(i, c.hot ?? 0, px, py, now);
        this.updateSite(x, y);
        this.updateDecor(i, c.revealed, px, py, h);
        this.updateLair(x, y);

        if (!c.revealed) {
          this.setClues(i, x, y, null);
          this.drawClosed(og, x, y, px, py, known.get(cellKey(x, y)), risk?.get(i), me.queue.includes(cellKey(x, y)), me.autoQueue.includes(cellKey(x, y)), c.marked ? (c.markKind ?? 'danger') : null, now);
          continue;
        }
        if (w.started && w.inTerritory(this.me, x, y) && c.building === undefined) {
          og.lineStyle(2, C.seam, 0.55);
          og.strokeRect(px + 2, py + 2, CELL - 4, CELL - 4);
          if (view.showTerritory) {
            og.fillStyle(C.seam, 0.28 + 0.14 * Math.sin(now / 150));
            og.fillRect(px, py, CELL, CELL);
          }
        }
        if (view.buildType && w.canBuild(this.me, view.buildType, x, y) === null) {
          const pulse = 0.35 + 0.25 * Math.sin(now / 200);
          og.fillStyle(C.seam, pulse * 0.6);
          og.fillRect(px, py, CELL, CELL);
          og.lineStyle(3, C.seam, 0.9);
          og.strokeRect(px + 2, py + 2, CELL - 4, CELL - 4);
        }
        const clueCell = c.content === 'ground' || c.content === 'rubble' || c.content === 'energy_vein' || c.resolved;
        this.setClues(i, x, y, clueCell && c.building === undefined ? w.clues(x, y) : null);
      }
    }
    this.drawSpotlight(og, view, now);
    this.drawPointTo(view, now);
    this.updateBuildings(now);
    this.updateGhost(view);
    this.updateUnits();
    this.updateOrbs();
    this.drawArcs();
  }

  /** Red / violet glow on closed blocks next to a visible number (UI_SPEC §3.2 p.2). */
  private riskMap(): Map<number, 'threat' | 'demon'> {
    const w = this.world;
    const s = w.s;
    const out = new Map<number, 'threat' | 'demon'>();
    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        const c = w.cell(x, y);
        if (!c.revealed || c.building !== undefined || !(c.content === 'ground' || c.resolved)) continue;
        const cl = w.clues(x, y);
        if (!cl.threat && !cl.demon) continue;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= s.width || ny >= s.height || w.cell(nx, ny).revealed) continue;
            const i = ny * s.width + nx;
            if (cl.threat) out.set(i, 'threat');
            else if (!out.has(i)) out.set(i, 'demon');
          }
        }
      }
    }
    return out;
  }

  private drawClosed(
    g: Phaser.GameObjects.Graphics,
    _x: number,
    _y: number,
    px: number,
    py: number,
    kn: string | undefined,
    risk: 'threat' | 'demon' | undefined,
    queued: boolean,
    auto: boolean,
    marked: MarkKind | null,
    now: number,
  ): void {
    const cx = px + CELL / 2;
    const cy = py + CELL / 2;
    if (kn === 'threat' || kn === 'demon') {
      const col = kn === 'threat' ? C.coral : C.violet;
      g.fillStyle(col, 0.28);
      g.fillRect(px, py, CELL, CELL);
      g.lineStyle(3, col, 1);
      g.strokeRect(px + 2, py + 2, CELL - 4, CELL - 4);
      glyph(g, kn, cx, cy, 13, kn === 'threat' ? C.coralInk : C.violet);
    } else if (risk) {
      const col = risk === 'threat' ? C.coral : C.violet;
      g.fillStyle(col, 0.14);
      g.fillRect(px, py, CELL, CELL);
      g.lineStyle(3, col, 0.7);
      g.strokeRect(px + 2, py + 2, CELL - 4, CELL - 4);
    }
    if (queued || auto) {
      g.fillStyle(C.seam, queued ? 0.26 : 0.12);
      g.fillRect(px, py, CELL, CELL);
      // Dashed outline running around the block (1 s per lap).
      const dash = 8;
      const per = (CELL - 4) * 4;
      const off = ((now / 1000) * per) % (dash * 2);
      g.lineStyle(queued ? 3 : 2, C.seam, queued ? 1 : 0.6);
      for (let d = -off; d < per; d += dash * 2) this.perimeterDash(g, px + 2, py + 2, CELL - 4, Math.max(0, d), Math.min(per, d + dash));
      if (queued) {
        g.fillStyle(C.glow, 1);
        g.fillPoints([new Phaser.Math.Vector2(cx, cy - 7), new Phaser.Math.Vector2(cx + 7, cy), new Phaser.Math.Vector2(cx, cy + 7), new Phaser.Math.Vector2(cx - 7, cy)], true);
      }
    }
    if (marked) drawMark(g, cx, cy, marked);
  }

  /** One dash of a square's perimeter, from distance a to b (clockwise from top-left). */
  private perimeterDash(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number, a: number, b: number): void {
    const pt = (d: number) => {
      const side = Math.floor(d / size);
      const t = d - side * size;
      if (side === 0) return [x + t, y];
      if (side === 1) return [x + size, y + t];
      if (side === 2) return [x + size - t, y + size];
      return [x, y + size - t];
    };
    if (b <= a) return;
    const corners = [size, size * 2, size * 3].filter((c) => c > a && c < b);
    const pts = [a, ...corners, b].map(pt);
    for (let k = 0; k < pts.length - 1; k++) g.lineBetween(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]);
  }

  private drawSpotlight(g: Phaser.GameObjects.Graphics, view: ViewState, now: number): void {
    const pulse = 0.5 + 0.5 * Math.sin(now / 180);
    for (const f of view.focus) {
      g.lineStyle(5, C.amber, 0.45 + 0.55 * pulse);
      g.strokeRect(this.bx + f.x * STEP - 2, this.by + f.y * STEP - 2, CELL + 4, CELL + 4);
    }
    const sp = view.spotlight;
    if (!sp) return;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = sp.x + dx;
        const ny = sp.y + dy;
        if (nx < 0 || ny < 0 || nx >= this.world.s.width || ny >= this.world.s.height) continue;
        const px = this.bx + nx * STEP;
        const py = this.by + ny * STEP;
        if (dx || dy) {
          g.fillStyle(0xffffff, 0.14);
          g.fillRect(px, py, CELL, CELL);
          g.lineStyle(3, 0xffffff, 0.95);
        } else g.lineStyle(4, C.amber, 1);
        g.strokeRect(px + 1, py + 1, CELL - 2, CELL - 2);
      }
    }
  }

  private arrowG?: Phaser.GameObjects.Graphics;

  /** Teal arrow bobbing above the target cell, with its outline (MVP_RULES §7.1). */
  private drawPointTo(view: ViewState, now: number): void {
    this.arrowG ??= this.scene.add.graphics().setDepth(D.top + 0.5);
    const g = this.arrowG;
    g.clear();
    const to = view.pointTo;
    if (!to) return;
    const px = this.bx + to.x * STEP;
    const py = this.by + to.y * STEP;
    const pulse = 0.5 + 0.5 * Math.sin(now / 140);
    g.fillStyle(C.seam, 0.25 + 0.2 * pulse);
    g.fillRect(px, py, CELL, CELL);
    g.lineStyle(5, C.seam, 1);
    g.strokeRect(px + 2, py + 2, CELL - 4, CELL - 4);
    const cx = px + CELL / 2;
    const tip = py - 6 - 10 * pulse;
    const s = CELL * 0.32;
    const pts = [
      new Phaser.Math.Vector2(cx, tip),
      new Phaser.Math.Vector2(cx + s, tip - s),
      new Phaser.Math.Vector2(cx + s * 0.38, tip - s),
      new Phaser.Math.Vector2(cx + s * 0.38, tip - s * 2.1),
      new Phaser.Math.Vector2(cx - s * 0.38, tip - s * 2.1),
      new Phaser.Math.Vector2(cx - s * 0.38, tip - s),
      new Phaser.Math.Vector2(cx - s, tip - s),
    ];
    g.fillStyle(C.graphite, 0.35);
    g.fillPoints(pts.map((v) => new Phaser.Math.Vector2(v.x + 3, v.y + 4)), true);
    g.fillStyle(C.seam, 1);
    g.fillPoints(pts, true);
    g.lineStyle(3, C.graphite, 1);
    g.strokePoints(pts, true);
  }

  private updateHot(i: number, hot: number, px: number, py: number, now: number): void {
    let img = this.hot.get(i);
    let haze = this.haze.get(i);
    if (hot <= 0) {
      img?.setVisible(false);
      haze?.setVisible(false);
      return;
    }
    if (!img) {
      img = this.scene.add.image(px, py, 'tile.hot_0').setOrigin(0).setDepth(D.site + 0.5);
      this.hot.set(i, img);
    }
    if (!haze) {
      haze = this.scene.add.sprite(px, py, 'fx').setOrigin(0).setDepth(D.site + 0.6).play('fx.heat_haze');
      this.haze.set(i, haze);
    }
    haze.setVisible(true);
    img.setVisible(true).setTexture(`tile.hot_${Math.floor(now / 400) % 2}`).setAlpha(Math.min(1, 0.4 + hot / 10));
  }

  /** Live nests pulse; destroyed ones play their crumble once. */
  private updateSite(x: number, y: number): void {
    const w = this.world;
    const c = w.cell(x, y);
    if (!c.revealed || (c.content !== 'nest' && c.content !== 'heavy_nest' && c.content !== 'boss_hatch')) return;
    const k = cellKey(x, y);
    const site = w.site(x, y);
    const set = c.content === 'heavy_nest' ? 'heavy_nest' : c.content === 'nest' ? 'nest' : 'demon_hatch';
    let spr = this.sites.get(k);
    const dead = c.resolved || site?.destroyed;
    if (!spr) {
      if (dead) return;
      spr = this.scene.add.sprite(this.bx + x * STEP, this.by + y * STEP, set).setOrigin(0).setDepth(D.site);
      this.sites.set(k, spr);
      if (set === 'demon_hatch') spr.setFrame(0);
      else spr.play(`${set}.pulse`);
      return;
    }
    if (set === 'demon_hatch') {
      const s = w.s.boss;
      if ((s.awake || s.dead) && spr.getData('open') !== true) {
        spr.setData('open', true);
        spr.play('demon_hatch.open');
      } else if (s.warned && !s.awake && !spr.anims.isPlaying) spr.play('demon_hatch.steam');
      return;
    }
    if (dead && spr.getData('dead') !== true) {
      spr.setData('dead', true);
      spr.play(`${set}.destroy`).once('animationcomplete', () => spr!.setVisible(false));
    }
  }

  /** Every seventh-ish closed block carries a live hazard: ice, arcing wires or smoke (block_fx loop_*). */
  private updateDecor(i: number, revealed: boolean, px: number, py: number, h: number): void {
    const spr = this.decor.get(i);
    if (revealed) {
      if (spr) {
        spr.destroy();
        this.decor.delete(i);
      }
      return;
    }
    if (spr || (h >>> 4) % 7 !== 3) return;
    const key = `block_fx.loop_${DECOR_EL[(h >>> 8) % DECOR_EL.length]}`;
    if (!this.scene.anims.exists(key)) return;
    const s = this.scene.add.sprite(px + CELL / 2, py + CELL, 'block_fx').setOrigin(...originOf('block_fx')).setScale(FX2).setDepth(D.film + 0.5).setAlpha(0.9);
    s.play({ key, startFrame: h % 6 });
    this.decor.set(i, s);
  }

  /** Live portal over an open nest or hero lair: idles, flares on release (releaseFrom), collapses when destroyed. */
  private updateLair(x: number, y: number): void {
    const w = this.world;
    const c = w.cell(x, y);
    if (!c.revealed || (c.content !== 'nest' && c.content !== 'heavy_nest' && c.content !== 'hero_lair')) return;
    const k = cellKey(x, y);
    const dead = c.resolved || w.site(x, y)?.destroyed;
    let l = this.lairs.get(k);
    if (!l) {
      if (dead || !w.site(x, y)) return;
      const el = elementOf(c.content === 'hero_lair' ? heroDefs[c.hero!]?.tech : c.tech, [...BLOCK_EL]);
      if (!this.scene.anims.exists(`lair_fx.idle_${el}`)) return;
      const p = this.center(x, y);
      const spr = this.scene.add
        .sprite(p.x, p.y + CELL * 0.4, 'lair_fx')
        .setOrigin(...originOf('lair_fx'))
        .setScale(c.content === 'heavy_nest' ? FX2 * 1.25 : FX2)
        .setDepth(D.site + 0.35);
      spr.play({ key: `lair_fx.idle_${el}`, startFrame: hash(x, y) % 5 });
      l = { spr, el, busy: false, dead: false };
      this.lairs.set(k, l);
      return;
    }
    if (dead && !l.dead) {
      const spr = l.spr;
      l.dead = true;
      l.busy = true;
      spr.play(`lair_fx.destroy_${l.el}`).once('animationcomplete', () => this.scene.tweens.add({ targets: spr, alpha: 0, delay: 400, duration: 500, onComplete: () => spr.destroy() }));
    }
  }

  // ---------------------------------------------------------------- clues

  /** HeroOut sensor sign with up to three windows: beacon, target, box (MVP_RULES §3.1а, Sensor.ts). */
  private setClues(i: number, x: number, y: number, clues: Record<(typeof CHANNELS)[number], number> | null): void {
    let texts = this.clueTexts.get(i);
    if (!clues || (!clues.finds && !clues.threat && !clues.demon)) {
      texts?.forEach((t) => t.setVisible(false));
      return;
    }
    if (!texts) {
      texts = sensorTexts(this.scene, D.clue + 0.2);
      this.clueTexts.set(i, texts);
    }
    const p = this.center(x, y);
    drawSensor(this.clueG, texts, p.x, p.y, clues);
  }

  // -------------------------------------------------------------- buildings

  private updateBuildings(now: number): void {
    const s = this.world.s;
    const alive = new Set<number>();
    for (const b of s.buildings) {
      alive.add(b.id);
      let v = this.buildingViews.get(b.id);
      const p = this.center(b.x, b.y);
      if (!v) {
        const spr = this.scene.add.sprite(p.x, p.y, `building.${b.type}`).setDepth(D.building + p.y / 4000);
        v = { spr, state: '', type: b.type, x: b.x, y: b.y };
        this.buildingViews.set(b.id, v);
      }
      this.styleBuilding(v, b, now);
    }
    for (const [id, v] of this.buildingViews) {
      if (alive.has(id)) continue;
      this.buildingViews.delete(id);
      const lost = this.lost.find((e) => e.x === v.x && e.y === v.y);
      const sheet = `bld_${v.type}`;
      if (lost && animSets[sheet]) {
        v.spr.setOrigin(...originOf(sheet)).play(`${sheet}.destroy`);
        this.scene.tweens.add({ targets: v.spr, alpha: 0, delay: 1400, duration: 600, onComplete: () => v.spr.destroy() });
      } else v.spr.destroy();
    }
    this.lost = [];
  }

  private styleBuilding(v: { spr: Phaser.GameObjects.Sprite; state: string }, b: Building, now: number): void {
    const def = buildingDefs[b.type];
    const sheet = `bld_${b.type}`;
    const hasSheet = animSets[sheet] !== undefined;
    const spr = v.spr;
    let state: string;
    if (!b.complete) state = 'construct';
    else if (b.hp < def.hp / 2 && hasSheet) state = 'damaged';
    else if (b.type === 'reactor') state = 'working';
    else state = 'idle';
    if (state !== v.state) {
      v.state = state;
      spr.stop();
      if (state === 'idle' || !hasSheet) {
        spr.setTexture(`building.${b.type}`);
        const a = BUILDING_ANCHOR[b.type] ?? [36, 78, 72, 96];
        spr.setOrigin(a[0] / a[2], a[1] / a[3]);
      } else {
        spr.setOrigin(...originOf(sheet));
        if (state === 'construct') spr.setTexture(sheet, 0);
        else spr.play(`${sheet}.${state}`);
      }
    }
    if (state === 'construct' && hasSheet) spr.setFrame(Math.min(6, Math.floor((b.built / def.buildSeconds) * 6)));
    spr.setAlpha(b.complete ? 1 : 0.85);
    if (b.owner !== this.me) spr.setTint(0xffc2a8);
    const g = this.topG;
    const p = this.center(b.x, b.y);
    if (b.complete && b.hp < def.hp) this.vitals.draw(g, `b:${b.id}`, p.x - 28, p.y - 46, 56, b.hp / def.hp, 'building', this.scene.time.now);
    void now;
  }

  private updateGhost(view: ViewState): void {
    this.zoneG ??= this.scene.add.graphics().setDepth(D.overlay + 0.2);
    this.zoneG.clear();
    if (!view.ghost || !view.buildType) {
      this.ghostSpr?.setVisible(false);
      return;
    }
    // The land this building will free: a dashed square of its territory radius around the ghost.
    const r = buildingDefs[view.buildType]?.territoryRadius ?? 0;
    if (r > 0) {
      const w = this.world.s;
      const x0 = Math.max(0, view.ghost.x - r);
      const y0 = Math.max(0, view.ghost.y - r);
      const x1 = Math.min(w.width - 1, view.ghost.x + r);
      const y1 = Math.min(w.height - 1, view.ghost.y + r);
      const a = this.center(x0, y0);
      const b = this.center(x1, y1);
      const L = a.x - CELL / 2;
      const T = a.y - CELL / 2;
      const R = b.x + CELL / 2;
      const B = b.y + CELL / 2;
      const zg = this.zoneG;
      zg.fillStyle(C.seam, 0.12);
      zg.fillRect(L, T, R - L, B - T);
      zg.lineStyle(3, C.seam, 0.95);
      const dash = (ax: number, ay: number, bx: number, by: number) => {
        const len = Math.hypot(bx - ax, by - ay);
        for (let d = 0; d < len; d += 14) {
          const e = Math.min(len, d + 8);
          zg.lineBetween(ax + ((bx - ax) * d) / len, ay + ((by - ay) * d) / len, ax + ((bx - ax) * e) / len, ay + ((by - ay) * e) / len);
        }
      };
      dash(L, T, R, T);
      dash(R, T, R, B);
      dash(R, B, L, B);
      dash(L, B, L, T);
    }
    const p = this.center(view.ghost.x, view.ghost.y);
    if (!this.ghostSpr) this.ghostSpr = this.scene.add.image(0, 0, `building.${view.buildType}`).setDepth(D.building + 1);
    const a = BUILDING_ANCHOR[view.buildType] ?? [36, 78, 72, 96];
    this.ghostSpr
      .setVisible(true)
      .setTexture(`building.${view.buildType}`)
      .setOrigin(a[0] / a[2], a[1] / a[3])
      .setPosition(p.x, p.y)
      .setAlpha(0.6)
      .setTint(0xbff6ff);
  }

  // ------------------------------------------------------------------ units

  /** What this enemy is weak to: heroes by their hero entry, adaptants by their nest technology. */
  private weakOf(u: Unit): Weakness[] {
    let w = this.weakCache.get(u.id);
    if (w) return w;
    if (u.kind === 'hero') w = weaknessesOf({ heroId: u.hero });
    else if (u.kind === 'heavy_adaptant') w = weaknessesOf({ tech: 'impact' });
    else w = weaknessesOf({ tech: u.tech });
    this.weakCache.set(u.id, w);
    return w;
  }

  private setOf(u: Unit): string {
    switch (u.kind) {
      case 'resident': {
        // v0.7: no plain residents on screen, our workers are the starter heroes (Антон, 2026-10-10).
        const set = `ally_${STARTER_LOOKS[u.id % STARTER_LOOKS.length]}`;
        return animSets[set] ? set : 'resident';
      }
      case 'hero':
        return animSets[u.hero!] ? u.hero! : 'patch';
      case 'heavy_adaptant':
        return 'heavy_adaptant';
      case 'ally':
        // The hero's own team look (animator's ally_<id> sheets), else the enemy sheet.
        return animSets[`ally_${u.hero}`] ? `ally_${u.hero}` : animSets[u.hero!] ? u.hero! : 'ally_patch';
      default: {
        // The animator's redrawn sheets, one per nest element, no shields (AR-18).
        const set = `adaptant_${u.tech ?? 'thermo'}`;
        return animSets[set] ? set : 'adaptant_thermo';
      }
    }
  }

  /** Plays `anim` once from this unit's sheet (or `from`, e.g. the resident's fighter sheet), if it exists. */
  private oneShot(v: UnitView, anim: string, from = v.set): void {
    if (!animSets[from]?.anims[anim]) return;
    v.oneShot = true;
    v.spr.anims.timeScale = 1;
    v.spr.play(`${from}.${anim}`);
    v.spr.once('animationcomplete', () => (v.oneShot = false));
  }

  private updateUnits(): void {
    const w = this.world;
    const g = this.topG;
    const alive = new Set<number>();
    const order = w.player(this.me).order;
    for (const u of w.s.units) {
      alive.add(u.id);
      let v = this.units.get(u.id);
      if (v && v.simT !== w.s.time) {
        v.prevX = v.curX;
        v.prevY = v.curY;
        v.curX = u.x;
        v.curY = u.y;
        v.simT = w.s.time;
      }
      // The sim moves units in 50 ms steps; draw between the last two so walking is smooth at any frame rate.
      const a = w.stepAlpha;
      const c = v ? this.center(v.prevX + (v.curX - v.prevX) * a, v.prevY + (v.curY - v.prevY) * a) : this.center(u.x, u.y);
      const fx = c.x;
      const fy = c.y - CELL / 2 + FEET;
      if (!v) {
        const set = this.setOf(u);
        const spr = this.scene.add.sprite(fx, fy, set).setOrigin(...originOf(set));
        v = { spr, set, prevX: u.x, prevY: u.y, curX: u.x, curY: u.y, simT: w.s.time, lastCd: u.attackCooldown, oneShot: false, windup: false, anim: '' };
        // The call target stands a size bigger: it must read as the one to beat (QA-014).
        if (u.kind === 'hero' && u.nest && w.cell(...(u.nest.slice(2).split(',').map(Number) as [number, number])).content === 'boss_hatch') {
          spr.setScale(1.3);
          v.ring = this.scene.add.image(fx, fy, 'tile.defender_ring').setOrigin(0.5, 0.75).setScale(1.6).setTint(C.violet);
        }
        if (u.owner >= 0 && u.owner !== this.me) spr.setTint(0xffb080);
        this.units.set(u.id, v);
        this.oneShot(v, 'emerge');
      }
      // Movement over the last sim step, not this render frame: frames between steps would read as
      // "stopped" and restart the walk cycle every time.
      const dx = v.curX - v.prevX;
      const dy = v.curY - v.prevY;
      const moved = Math.abs(dx) + Math.abs(dy) > 0.0005;
      const set = animSets[v.set];
      if (Math.abs(dx) > 0.0005) v.spr.setFlipX(set.faces === 'left' ? dx > 0 : dx < 0);
      // A fresh cooldown means the unit just struck.
      if (u.attackCooldown > v.lastCd + 0.05) {
        if (!v.oneShot) this.oneShot(v, 'attack', u.kind === 'resident' && v.set === 'resident' ? RESIDENT_COMBAT_SET : v.set);
        const tp = this.targetPos(u.target ?? (u.owner >= 0 ? w.player(u.owner).order ?? undefined : undefined));
        if (tp) {
          const big = u.kind === 'hero' || u.kind === 'heavy_adaptant';
          const victim = u.target?.startsWith('u:') ? w.unit(Number(u.target.slice(2))) : undefined;
          const anim = this.hitAnim(u, victim);
          this.scene.time.delayedCall(180, () => {
            this.flash(tp.x, tp.y, big ? 0.8 : 0.55);
            this.fx(anim, tp.x, tp.y, big ? 1.6 : 1.1);
          });
          if (tp.x !== fx) v.spr.setFlipX(set.faces === 'left' ? tp.x > fx : tp.x < fx);
        }
      }
      // Burning and frozen units show it.
      if (u.burn && Math.random() < 0.06) this.fx('hit_thermo', fx + (Math.random() - 0.5) * 20, fy - 30, 0.6);
      if (u.stun && u.slow) v.spr.setTint(0x7fd0ff);
      else if (u.slow) v.spr.setTint(0x9fdcff);
      else if (u.poison) v.spr.setTint(0xb8f08a);
      else if (v.tint !== undefined) v.spr.setTint(v.tint);
      else if (!(u.owner >= 0 && u.owner !== this.me)) v.spr.clearTint();
      const windup = u.blast?.phase === 'windup';
      if (windup && !v.windup) this.oneShot(v, 'tail_swing');
      v.windup = windup;
      if (!v.oneShot) {
        let anim = 'idle';
        if (u.kind === 'resident' || u.kind === 'ally') {
          if (moved) anim = dy < -Math.abs(dx) * 0.6 ? 'walk_back' : 'walk';
          else if ((u.task.type === 'dig' || u.task.type === 'harvest') && u.path.length === 0) anim = 'dig';
          else if (u.task.type === 'build' && u.path.length === 0) anim = 'build';
        } else if (moved) anim = 'walk';
        // A maddened hero with nobody to chase keeps its nervous tic.
        else if (u.kind === 'hero' && !u.target && set.anims.tic) anim = 'tic';
        if (anim === 'dig' && v.anim !== 'dig' && u.owner === this.me) sound.play('dig_start');
        v.anim = anim;
        // Ally sheets may not have every resident action yet; fall back gracefully.
        const playAnim = set.anims[anim] ? anim : ({ walk_back: 'walk', dig: 'walk', build: 'idle', flee: 'walk' }[anim] ?? 'idle');
        v.spr.play(`${v.set}.${playAnim}`, true);
        // Runs carry the distance one cycle covers; match it to the unit's real speed so feet don't slide.
        const stride = set.anims[playAnim]?.pxPerCycle;
        const def = set.anims[playAnim];
        v.spr.anims.timeScale = stride && def ? Phaser.Math.Clamp((w.stats(u).speed * CELL) / ((stride * def.fps) / def.frames.length), 0.5, 2) : 1;
      }
      v.spr.setPosition(fx, fy).setDepth(D.unit + fy / 4000);
      v.ring?.setPosition(fx, fy).setDepth(D.unit + fy / 4000 - 0.0001);
      v.lastCd = u.attackCooldown;

      const st = w.stats(u);
      const top = fy - (u.kind === 'hero' ? (v.spr.scaleX > 1 ? 104 : 74) : u.kind === 'heavy_adaptant' ? 70 : 54);
      // Trophy parts: drawn limbs tinted by element where the animator made masks, else a coloured pip per slot.
      const masked = this.updateTrophies(u, v);
      Object.entries(u.parts).forEach(([slot, part], k) => {
        if (!part || masked.has(slot)) return;
        g.fillStyle(0x0b1117, 1);
        g.fillCircle(fx - 14 + k * 9, top + 2, 5);
        g.fillStyle(TECH_COLOR[partDefs[part.id]?.tech] ?? 0xffffff, 1);
        g.fillCircle(fx - 14 + k * 9, top + 2, 3.5);
      });
      // Health bar: enemies always, our units when hurt or fighting; weakness orbs above enemies (UI_SPEC §3.5).
      const enemy = u.owner < 0;
      if (enemy || u.hp < st.hp || u.target !== undefined) this.vitals.draw(g, `u:${u.id}`, fx - 24, top - 12, 48, u.hp / st.hp, enemy ? 'enemy' : 'ally', this.scene.time.now);
      if (enemy) drawWeakOrbs(g, fx, top - 30, this.weakOf(u));
      if (order === `u:${u.id}`) {
        g.lineStyle(3, C.coral, 1);
        g.strokeEllipse(fx, fy - 2, 46, 18);
      }
      if (windup) this.drawWindup(g, u);
    }
    for (const [id, v] of this.units) {
      if (alive.has(id)) continue;
      this.units.delete(id);
      v.ring?.destroy();
      this.trophies.get(id)?.forEach((s) => s.destroy());
      this.trophies.delete(id);
      if (animSets[v.set].anims.death) {
        v.spr.anims.timeScale = 1;
        v.spr.play(`${v.set}.death`).once('animationcomplete', () => v.spr.destroy());
      } else v.spr.destroy();
    }
    // Attack order on a nest.
    if (order?.startsWith('s:')) {
      const [x, y] = order.slice(2).split(',').map(Number);
      const p = this.center(x, y);
      g.lineStyle(4, C.coral, 1);
      g.strokeCircle(p.x, p.y, CELL * 0.55);
    }
    for (const site of w.s.sites) {
      if (site.destroyed || site.hp >= site.maxHp) continue;
      const p = this.center(site.x, site.y);
      this.vitals.draw(g, `s:${site.x},${site.y}`, p.x - 26, p.y - 34, 52, site.hp / site.maxHp, 'enemy', this.scene.time.now);
    }
  }

  /**
   * A second sprite per trophy slot plays the same frame from the hero's limb-mask set (`<set>_limbs`,
   * anims `<anim>@<mask slot>`), tinted with the trophy's element; hit/death/knockout have no masks, so it hides.
   * Returns the slots drawn this way.
   */
  private updateTrophies(u: Unit, v: UnitView): Set<string> {
    const done = new Set<string>();
    const limbsKey = `${v.set}_limbs`;
    const ls = animSets[limbsKey] as (typeof animSets)[string] & { slots?: Record<string, string> };
    let mine = this.trophies.get(u.id);
    if (!ls?.slots) return done;
    const cur = v.spr.anims.currentAnim;
    const anim = cur ? cur.key.slice(v.set.length + 1) : 'idle';
    const idx = (v.spr.anims.currentFrame?.index ?? 1) - 1;
    for (const [slot, part] of Object.entries(u.parts)) {
      const mask = part && ls.slots[SLOT_SHORT[slot]];
      if (!mask) continue;
      done.add(slot);
      mine ??= new Map();
      this.trophies.set(u.id, mine);
      let s = mine.get(slot);
      if (!s) {
        s = this.scene.add.sprite(0, 0, limbsKey);
        mine.set(slot, s);
      }
      const a = ls.anims[`${anim}@${mask}`];
      if (!a || !v.spr.visible) {
        s.setVisible(false);
        continue;
      }
      const tech = partDefs[part!.id]?.tech;
      s.setVisible(true)
        .setFrame(a.frames[Math.min(idx, a.frames.length - 1)])
        .setOrigin(v.spr.originX, v.spr.originY)
        .setPosition(v.spr.x, v.spr.y)
        .setScale(v.spr.scaleX, v.spr.scaleY)
        .setFlipX(v.spr.flipX)
        .setDepth(v.spr.depth + 0.00005)
        .setTint(TECH_COLOR[tech] ?? 0xffffff)
        .setAlpha(0.9);
      if (Math.random() < 0.02) this.fx(hitOf(tech), v.spr.x + (Math.random() - 0.5) * 24, v.spr.y - v.spr.displayHeight * 0.45, 0.35);
    }
    if (mine) {
      for (const [slot, s] of mine) {
        if (done.has(slot)) continue;
        s.destroy();
        mine.delete(slot);
      }
    }
    return done;
  }

  private drawWindup(g: Phaser.GameObjects.Graphics, u: Unit): void {
    const b = u.blast!;
    const from = this.center(u.x, u.y);
    const to = this.center(u.x + b.dx * 3.25, u.y + b.dy * 3.25);
    g.lineStyle(CELL * 0.6, 0xff6b2b, 0.25 + 0.2 * Math.sin(this.scene.time.now / 60));
    g.lineBetween(from.x, from.y, to.x, to.y);
  }

  /**
   * Energy orbs: drawn frames only (fx_energy, sheets 071/075). A flash where the orb is born, the orb flies to the
   * command centre on an arc and leaves sparks behind; the ring and burst on arrival play in onEvent.
   * Orbs are matched by where they were born (online snapshots may replace the objects).
   */
  private updateOrbs(): void {
    const orbs = this.world.s.orbs;
    if (!animSets.fx_energy) {
      while (this.orbs.length < orbs.length) this.orbs.push(this.scene.add.sprite(0, 0, 'fx').setDepth(D.unit + 1).play('fx.energy_orb'));
      this.orbs.forEach((spr, k) => {
        const o = orbs[k];
        if (!o) return void spr.setVisible(false);
        const p = this.center(o.x, o.y);
        spr.setVisible(true).setPosition(p.x, p.y - 8).setScale(0.8 + Math.min(0.6, o.amount / 60));
      });
      return;
    }
    const now = this.scene.time.now;
    const seen = new Set<string>();
    const dup = new Map<string, number>();
    for (const o of orbs) {
      const x0 = o.x0 ?? o.x;
      const y0 = o.y0 ?? o.y;
      const base = `${o.owner}:${x0.toFixed(2)}:${y0.toFixed(2)}:${o.amount}`;
      const n = dup.get(base) ?? 0;
      dup.set(base, n + 1);
      const key = `${base}#${n}`;
      seen.add(key);
      let v = this.orbViews.get(key);
      if (!v) {
        v = { spr: this.scene.add.sprite(0, 0, 'fx_energy').setDepth(D.top - 0.4).play('fx_energy.fly'), trail: now };
        this.orbViews.set(key, v);
        const b = this.center(x0, y0);
        const f = this.scene.add.sprite(b.x, b.y - 10, 'fx_energy').setScale(0.55).setDepth(D.top - 0.4);
        f.play('fx_energy.spawn').once('animationcomplete', () => f.destroy());
      }
      const cmd = this.world.building(this.world.s.players[o.owner]?.command);
      const total = cmd ? Math.hypot(cmd.x - x0, cmd.y - y0) : 0;
      const left = cmd ? Math.hypot(cmd.x - o.x, cmd.y - o.y) : 0;
      const t = total > 0 ? Phaser.Math.Clamp(1 - left / total, 0, 1) : 1;
      const lift = Math.min(CELL * 2.2, total * STEP * 0.35) * Math.sin(Math.PI * t);
      const p = this.center(o.x, o.y);
      const size = 0.8 + Math.min(0.6, o.amount / 60);
      const x = p.x;
      const y = p.y - 10 - lift;
      if (now - v.trail > 70) {
        v.trail = now;
        const s = this.scene.add.sprite(x, y, 'fx_energy').setScale(0.22 * size).setDepth(D.top - 0.45);
        s.play('fx_energy.trail').once('animationcomplete', () => s.destroy());
      }
      v.spr.setPosition(x, y).setScale(0.38 * size);
    }
    for (const [key, v] of this.orbViews) {
      if (seen.has(key)) continue;
      v.spr.destroy();
      this.orbViews.delete(key);
    }
  }

  /** Big work arc almost the size of the cell, running down clockwise (UI_SPEC §3). */
  private drawArcs(): void {
    const g = this.arcG;
    g.clear();
    const w = this.world;
    const arc = (x: number, y: number, left: number) => {
      const p = this.center(x, y);
      const r = 21;
      g.lineStyle(7, 0x0b1117, 0.35);
      g.strokeCircle(p.x, p.y, r);
      if (left <= 0) return;
      const a0 = -Math.PI / 2;
      g.lineStyle(12, C.seam, 0.25);
      g.beginPath();
      g.arc(p.x, p.y, r, a0, a0 + Math.PI * 2 * left, false);
      g.strokePath();
      g.lineStyle(7, C.glow, 1);
      g.beginPath();
      g.arc(p.x, p.y, r, a0, a0 + Math.PI * 2 * left, false);
      g.strokePath();
    };
    for (const u of w.s.units) {
      if (u.task.type === 'dig' && u.path.length === 0) arc(u.task.x, u.task.y, 1 - u.task.progress / config.dig.digSeconds);
    }
    for (const b of w.s.buildings) {
      if (!b.complete && b.built > 0) arc(b.x, b.y, 1 - b.built / w.buildSeconds(b));
    }
  }
}
