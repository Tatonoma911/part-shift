import Phaser from 'phaser';
import { buildings as buildingDefs, config, mapgen } from '../core/data';
import { cellKey } from '../core/grid';
import type { Building, Unit } from '../core/state';
import type { GameEvent, World } from '../core/world';
import { animSets, BUILDING_ANCHOR, originOf } from './assets';
import { sound } from './audio';
import { C, CELL, CHANNEL, STEP, TECH_COLOR } from './layout';
import { glyph, TXT } from './ui';

const ME = 0;
const CHANNELS = ['finds', 'threat', 'demon'] as const;
const GROUND = ['ground_0', 'ground_1', 'ground_0', 'ground_grass_0', 'ground_1', 'ground_grass_1', 'ground_0', 'ground_grass_2'];
const FEET = 46;

/** Depths, bottom to top (UI_SPEC §2.3). */
const D = { backdrop: 0, tile: 1, site: 2, film: 3, overlay: 4, clue: 5, building: 10, arc: 11.9, unit: 12, top: 14, float: 15 };

interface UnitView {
  spr: Phaser.GameObjects.Sprite;
  ring?: Phaser.GameObjects.Image;
  set: string;
  lastX: number;
  lastY: number;
  lastCd: number;
  oneShot: boolean;
  windup: boolean;
  anim: string;
}

export interface ViewState {
  /** Building type being placed, to light up cells where it fits. */
  buildType: string | null;
  ghost: { x: number; y: number } | null;
  spotlight: { x: number; y: number } | null;
  focus: { x: number; y: number }[];
  /** Assist mode "full": show the risk glow around visible numbers (UI_SPEC §3.2). */
  showRisk: boolean;
}

function hash(x: number, y: number): number {
  return (Math.imul(x + 17, 73856093) ^ Math.imul(y + 31, 19349663)) >>> 0;
}

function adaptantSet(tech: string | undefined): string {
  if (tech === 'cryo') return 'adaptant_cryo';
  if (tech === 'volt' || tech === 'toxin') return 'adaptant_volt';
  return 'adaptant_thermo';
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
  private readonly sites = new Map<string, Phaser.GameObjects.Sprite>();
  private readonly clueTexts = new Map<number, Phaser.GameObjects.Text[]>();
  private readonly buildingViews = new Map<number, { spr: Phaser.GameObjects.Sprite; state: string; type: string; x: number; y: number }>();
  private readonly units = new Map<number, UnitView>();
  private readonly orbs: Phaser.GameObjects.Sprite[] = [];
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly clueG: Phaser.GameObjects.Graphics;
  private readonly arcG: Phaser.GameObjects.Graphics;
  private readonly topG: Phaser.GameObjects.Graphics;
  private ghostSpr: Phaser.GameObjects.Image | null = null;
  private lost: GameEvent[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: World,
    bx: number,
    by: number,
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

  cellAt(px: number, py: number): { x: number; y: number } | null {
    const x = Math.floor((px - this.bx + (STEP - CELL) / 2) / STEP);
    const y = Math.floor((py - this.by + (STEP - CELL) / 2) / STEP);
    return x >= 0 && y >= 0 && x < this.world.s.width && y < this.world.s.height ? { x, y } : null;
  }

  /** Enemy whose sprite is under the finger (sprites stand taller than a cell). */
  enemyAt(px: number, py: number): Unit | undefined {
    let best: Unit | undefined;
    let bestD = 44;
    for (const u of this.world.s.units) {
      if (u.owner >= 0) continue;
      const c = this.center(u.x, u.y);
      const d = Math.hypot(c.x - px, c.y - 14 - py);
      if (d < bestD) {
        bestD = d;
        best = u;
      }
    }
    return best;
  }

  // ----------------------------------------------------------------- events

  /** One-shot effect from the animator's fx sheet, centered on a board pixel. */
  private fx(anim: string, x: number, y: number, scale = 1, depth = D.top - 0.5): void {
    if (!this.scene.anims.exists(`fx.${anim}`)) return;
    const s = this.scene.add.sprite(x, y, 'fx').setScale(scale).setDepth(depth);
    s.play(`fx.${anim}`).once('animationcomplete', () => s.destroy());
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

  /** Hit effect by the attacker's technology: its first trophy part, or its own kind. */
  private hitAnim(u: Unit, set: string): string {
    const part = Object.values(u.parts).find(Boolean);
    const tech = part ? part.id.split('_')[0] : set.startsWith('adaptant_') ? set.slice('adaptant_'.length) : '';
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
      case 'energy_orb_arrive':
        at('fx.energy_arrive');
        break;
      case 'center_hit':
        this.shake(100, 0.002);
        break;
      case 'demon_blast': {
        this.shake(220, 0.006);
        // Steam blast: a line of explosions in the wind-up direction.
        const demon = this.world.s.units.find((u) => u.kind === 'demon');
        const b = demon?.blast;
        for (let k = 0; k <= 3; k++) {
          const p = this.center(e.x + (b?.dx ?? 0) * k, e.y + (b?.dy ?? 0) * k);
          sc.time.delayedCall(k * 70, () => this.fx('explosion', p.x, p.y, 1.3));
        }
        break;
      }
      case 'building_lost':
        this.lost.push(e);
        this.fxAtCell('explosion', e.x, e.y, 1.8);
        this.shake(160, 0.004);
        break;
      case 'nest_open':
      case 'heavy_nest_open':
        this.fxAtCell('explosion', e.x, e.y, e.type === 'heavy_nest_open' ? 2 : 1.5);
        this.shake(180, 0.004);
        break;
      case 'nest_destroyed':
        this.fxAtCell('explosion', e.x, e.y, 2);
        this.shake(200, 0.005);
        break;
      case 'enemy_die':
        this.fxAtCell('explosion', e.x, e.y, 0.9);
        break;
      case 'demon_die':
        for (let k = 0; k < 5; k++) sc.time.delayedCall(k * 160, () => this.fxAtCell('explosion', e.x! + (k % 2 ? 0.5 : -0.5) * (k > 2 ? 1 : 0.4), e.y! - 0.3 * k, 2.4));
        this.shake(600, 0.008);
        break;
      case 'defender_die':
      case 'resident_die':
        this.fxAtCell('hit_impact', e.x, e.y, 1.2);
        break;
      case 'part_attached': {
        // Instant limb swap: a flash on the defender and the install animation.
        const v = e.unit !== undefined ? this.units.get(e.unit) : undefined;
        if (v && animSets[v.set].anims.install_part) this.oneShot(v, 'install_part');
        const p = this.center(e.x, e.y);
        this.fx('energy_arrive', p.x, p.y - 26, 1.4);
        this.fx('hit_volt', p.x, p.y - 26, 0.9);
        break;
      }
      case 'part_recycled':
        this.fxAtCell('energy_arrive', e.x, e.y, 1.2);
        break;
    }
  }

  /** Shake only the board camera; HUD and dock stay still. */
  private shake(ms: number, intensity: number): void {
    const cams = this.scene.cameras.cameras;
    (cams[1] ?? cams[0]).shake(ms, intensity);
  }

  // ----------------------------------------------------------------- update

  update(now: number, view: ViewState): void {
    const w = this.world;
    const s = w.s;
    const me = w.player(ME);
    const known = w.started ? w.visibleKnowledge(ME) : new Map<string, string>();
    const risk = view.showRisk && w.started ? this.riskMap() : null;
    const og = this.overlay;
    const cg = this.clueG;
    og.clear();
    cg.clear();
    this.topG.clear();
    const frame4 = Math.floor(now / 250) % 4;
    const frame3 = Math.floor(now / 300) % 3;
    const flicker = 0.8 + 0.12 * Math.sin(now / 900);
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
            case 'nest':
            case 'heavy_nest': {
              const dead = c.resolved || w.site(x, y)?.destroyed;
              key = (c.content === 'nest' ? 'nest' : 'nest_heavy') + (dead ? '_dead' : '');
              break;
            }
            case 'demon_hatch':
              key = `hatch_${s.demon.awake || s.demon.dead ? 2 : s.demon.warned ? 1 : 0}`;
              break;
            default:
              key = GROUND[h % 8];
          }
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
        this.updateHot(i, c.hot ?? 0, px, py, now);
        this.updateSite(x, y);

        if (!c.revealed) {
          this.setClues(i, x, y, null);
          this.drawClosed(og, x, y, px, py, known.get(cellKey(x, y)), risk?.get(i), me.queue.includes(cellKey(x, y)), me.autoQueue.includes(cellKey(x, y)), c.marked === true, now);
          continue;
        }
        if (w.started && w.inTerritory(ME, x, y) && c.building === undefined) {
          og.lineStyle(2, C.seam, 0.55);
          og.strokeRect(px + 2, py + 2, CELL - 4, CELL - 4);
        }
        if (view.buildType && w.canBuild(ME, view.buildType, x, y) === null) {
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
    marked: boolean,
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
    } else if (kn === 'safe') {
      g.fillStyle(C.green, 0.16);
      g.fillRect(px, py, CELL, CELL);
      g.lineStyle(6, 0x0b1117, 0.5);
      this.check(g, cx, cy + 1);
      g.lineStyle(5, 0x8fe35a, 1);
      this.check(g, cx, cy);
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
    if (marked) {
      g.fillStyle(0x0b1117, 0.6);
      g.fillRect(cx - 9, cy - 15, 4, 32);
      g.fillStyle(0xffffff, 1);
      g.fillRect(cx - 10, cy - 16, 4, 32);
      g.fillStyle(C.coral, 1);
      g.fillTriangle(cx - 6, cy - 16, cx + 14, cy - 8, cx - 6, cy);
    }
  }

  private check(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
    g.beginPath();
    g.moveTo(cx - 11, cy);
    g.lineTo(cx - 3, cy + 8);
    g.lineTo(cx + 12, cy - 9);
    g.strokePath();
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
    if (!c.revealed || (c.content !== 'nest' && c.content !== 'heavy_nest' && c.content !== 'demon_hatch')) return;
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
      const s = w.s.demon;
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

  // ---------------------------------------------------------------- clues

  /** One channel: a big number with its glyph; several: small numbers in fixed corners (UI_SPEC §3.1). */
  private setClues(i: number, x: number, y: number, clues: Record<(typeof CHANNELS)[number], number> | null): void {
    let texts = this.clueTexts.get(i);
    if (!clues || (!clues.finds && !clues.threat && !clues.demon)) {
      texts?.forEach((t) => t.setVisible(false));
      return;
    }
    if (!texts) {
      texts = CHANNELS.map((ch) =>
        this.scene.add
          .text(0, 0, '', { ...TXT.num(30, CHANNEL[ch].color), stroke: '#ffffff', strokeThickness: 6 })
          .setOrigin(0.5)
          .setDepth(D.clue),
      );
      this.clueTexts.set(i, texts);
    }
    const active = CHANNELS.filter((ch) => clues[ch] > 0);
    const p = this.center(x, y);
    const g = this.clueG;
    CHANNELS.forEach((ch, k) => {
      const t = texts![k];
      const n = clues[ch];
      if (!n) return void t.setVisible(false);
      t.setVisible(true).setText(String(n));
      if (active.length === 1) {
        t.setFontSize(30).setPosition(p.x - 5, p.y + 1);
        glyph(g, ch, p.x + 15, p.y - 11, 6, CHANNEL[ch].num);
      } else {
        const pos = ch === 'finds' ? [-13, -11] : ch === 'threat' ? [13, -11] : [0, 13];
        t.setFontSize(19).setPosition(p.x + pos[0], p.y + pos[1]);
      }
    });
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
    else if (b.type === 'reactor' && b.operators.length > 0) state = 'working';
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
    if (b.owner !== ME) spr.setTint(0xffc2a8);
    const g = this.topG;
    const p = this.center(b.x, b.y);
    if (b.complete && b.hp < def.hp) this.bar(g, p.x - 22, p.y - 40, 44, b.hp / def.hp, b.hp / def.hp > 0.4 ? C.green : C.coralInk);
    if (b.type === 'school' && b.complete && !b.recruit) {
      g.fillStyle(0x5b6b75, 1);
      g.fillCircle(p.x + 20, p.y - 44, 11);
      g.fillStyle(0xffffff, 1);
      g.fillRect(p.x + 15, p.y - 50, 4, 12);
      g.fillRect(p.x + 21, p.y - 50, 4, 12);
    }
    void now;
  }

  private updateGhost(view: ViewState): void {
    if (!view.ghost || !view.buildType) {
      this.ghostSpr?.setVisible(false);
      return;
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

  private setOf(u: Unit): string {
    switch (u.kind) {
      case 'resident':
        return 'resident';
      case 'defender':
        return 'defender';
      case 'heavy_adaptant':
        return 'heavy_adaptant';
      case 'demon':
        return 'demon';
      default: {
        const [nx, ny] = (u.nest ?? '').replace('s:', '').split(',').map(Number);
        const tech = Number.isFinite(nx) && Number.isFinite(ny) && nx >= 0 && ny >= 0 && nx < this.world.s.width && ny < this.world.s.height ? this.world.cell(nx, ny).tech : undefined;
        return adaptantSet(tech);
      }
    }
  }

  private oneShot(v: UnitView, anim: string): void {
    v.oneShot = true;
    v.spr.play(`${v.set}.${anim}`);
    v.spr.once('animationcomplete', () => (v.oneShot = false));
  }

  private updateUnits(): void {
    const w = this.world;
    const g = this.topG;
    const alive = new Set<number>();
    const order = w.player(ME).order;
    for (const u of w.s.units) {
      alive.add(u.id);
      const c = this.center(u.x, u.y);
      const fx = c.x;
      const fy = c.y - CELL / 2 + FEET;
      let v = this.units.get(u.id);
      if (!v) {
        const set = this.setOf(u);
        const spr = this.scene.add.sprite(fx, fy, set).setOrigin(...originOf(set));
        v = { spr, set, lastX: u.x, lastY: u.y, lastCd: u.attackCooldown, oneShot: false, windup: false, anim: '' };
        if (u.kind === 'defender') v.ring = this.scene.add.image(fx, fy, 'tile.defender_ring').setOrigin(0.5, 0.75);
        if (u.owner >= 0 && u.owner !== ME) spr.setTint(0xffb080);
        this.units.set(u.id, v);
        if (u.kind === 'demon') this.oneShot(v, 'emerge');
      }
      const dx = u.x - v.lastX;
      const dy = u.y - v.lastY;
      const moved = Math.abs(dx) + Math.abs(dy) > 0.0005;
      const set = animSets[v.set];
      if (Math.abs(dx) > 0.0005) v.spr.setFlipX(set.faces === 'left' ? dx > 0 : dx < 0);
      // A fresh cooldown means the unit just struck.
      if (u.attackCooldown > v.lastCd + 0.05) {
        if (set.anims.attack && !v.oneShot) this.oneShot(v, 'attack');
        const tp = this.targetPos(u.target ?? (u.owner >= 0 ? w.player(u.owner).order ?? undefined : undefined));
        if (tp) {
          const big = u.kind === 'demon' || u.kind === 'heavy_adaptant';
          this.scene.time.delayedCall(180, () => this.fx(this.hitAnim(u, v!.set), tp.x, tp.y, big ? 1.6 : 1.1));
          if (tp.x !== fx) v.spr.setFlipX(set.faces === 'left' ? tp.x > fx : tp.x < fx);
        }
      }
      // Burning and frozen units show it.
      if (u.burn && Math.random() < 0.06) this.fx('hit_thermo', fx + (Math.random() - 0.5) * 20, fy - 30, 0.6);
      if (u.slow) v.spr.setTint(0x9fdcff);
      else if (!(u.owner >= 0 && u.owner !== ME)) v.spr.clearTint();
      const windup = u.blast?.phase === 'windup';
      if (windup && !v.windup) this.oneShot(v, 'tail_swing');
      v.windup = windup;
      if (!v.oneShot) {
        let anim = 'idle';
        if (u.kind === 'resident') {
          if (u.task.type === 'flee') anim = 'flee';
          else if (moved) anim = dy < -Math.abs(dx) * 0.6 ? 'walk_back' : 'walk';
          else if ((u.task.type === 'dig' || u.task.type === 'harvest') && u.path.length === 0) anim = 'dig';
          else if (u.task.type === 'build' && u.path.length === 0) anim = 'build';
        } else if (moved) anim = 'walk';
        if (anim === 'dig' && v.anim !== 'dig' && u.owner === ME) sound.play('dig_start');
        v.anim = anim;
        v.spr.play(`${v.set}.${anim}`, true);
      }
      v.spr.setPosition(fx, fy).setDepth(D.unit + fy / 4000);
      v.ring?.setPosition(fx, fy).setDepth(D.unit + fy / 4000 - 0.0001);
      v.lastX = u.x;
      v.lastY = u.y;
      v.lastCd = u.attackCooldown;

      const st = w.stats(u);
      const top = fy - (u.kind === 'demon' || u.kind === 'heavy_adaptant' ? 70 : 54);
      // Trophy parts: a colored pip per slot until the artist's overlays exist.
      Object.values(u.parts).forEach((part, k) => {
        if (!part) return;
        g.fillStyle(0x0b1117, 1);
        g.fillCircle(fx - 14 + k * 9, top + 2, 5);
        g.fillStyle(TECH_COLOR[part.id.split('_')[0]] ?? 0xffffff, 1);
        g.fillCircle(fx - 14 + k * 9, top + 2, 3.5);
      });
      if (u.hp < st.hp) this.bar(g, fx - 20, top - 8, 40, u.hp / st.hp, u.owner < 0 ? C.coralInk : C.green);
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
      if (animSets[v.set].anims.death) {
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
      this.bar(g, p.x - 22, p.y - 30, 44, site.hp / site.maxHp, C.coralInk);
    }
  }

  private drawWindup(g: Phaser.GameObjects.Graphics, u: Unit): void {
    const b = u.blast!;
    const from = this.center(u.x, u.y);
    const to = this.center(u.x + b.dx * 3.25, u.y + b.dy * 3.25);
    g.lineStyle(CELL * 0.6, 0xff6b2b, 0.25 + 0.2 * Math.sin(this.scene.time.now / 60));
    g.lineBetween(from.x, from.y, to.x, to.y);
  }

  private updateOrbs(): void {
    const orbs = this.world.s.orbs;
    while (this.orbs.length < orbs.length) this.orbs.push(this.scene.add.sprite(0, 0, 'fx').setDepth(D.unit + 1).play('fx.energy_orb'));
    this.orbs.forEach((spr, k) => {
      const o = orbs[k];
      if (!o) return void spr.setVisible(false);
      const p = this.center(o.x, o.y);
      spr.setVisible(true).setPosition(p.x, p.y - 8).setScale(0.8 + Math.min(0.6, o.amount / 60));
    });
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
      if (!b.complete && b.built > 0) arc(b.x, b.y, 1 - b.built / buildingDefs[b.type].buildSeconds);
    }
  }

  private bar(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, frac: number, color: number): void {
    g.fillStyle(0x0b1117, 0.75);
    g.fillRect(x - 2, y - 2, width + 4, 10);
    g.fillStyle(color, 1);
    g.fillRect(x, y, width * Math.max(0, Math.min(1, frac)), 6);
  }
}
