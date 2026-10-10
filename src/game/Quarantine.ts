import Phaser from 'phaser';
import type { World } from '../core/world';
import { CELL, STEP } from './layout';

/**
 * City in crisis over the closed blocks (ui/UI_SPEC.md §3.4, Антон 2026-10-09):
 * hazard tape along the quarantine border, red beacons at its corners,
 * burning and smoking roofs deep inside the zone, and the reveal sequence
 * (tape snaps, roof splits into shards, scan line, flash, ring).
 * Pure decoration: nothing here depends on what is under a closed block,
 * and fires never sit next to open ground, so they cannot be read as clues.
 */

/** Depths inside the board band (BoardView D: tile 1, film 3, overlay 4, clue 5). */
const DQ = { damage: 1.5, fire: 3.5, tape: 4.2, beam: 4.25, beacon: 4.3, reveal: 13.5 };
const PAD = 24;
const BEACON_SPIN = 1200;
const BEACON_ALARM = 450;
const MAX_BEACONS = 8;
/** Burning and smoking roofs per field (FEEL_AUDIT F-07: 6–8 hazards in all). */
const MAX_FIRES = 6;
const MAX_SMOKE = 4;

function hash(x: number, y: number): number {
  return (Math.imul(x + 17, 73856093) ^ Math.imul(y + 31, 19349663)) >>> 0;
}

function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type Seg = { x: number; y: number; len: number; vertical: boolean; red: boolean; seed: number };
type Deco = { cx: number; cy: number; seed: number; kind: 'fire' | 'smoke' };

export type RevealKind = 'safe' | 'cache' | 'survivor' | 'nest' | 'hatch';

export class Quarantine {
  private readonly tapeTex: Phaser.Textures.CanvasTexture;
  private readonly dmgTex: Phaser.Textures.CanvasTexture;
  private readonly fireG: Phaser.GameObjects.Graphics;
  private readonly glowG: Phaser.GameObjects.Graphics;
  private readonly haze: Phaser.GameObjects.Image;
  private beacons: { dome: Phaser.GameObjects.Image; beam: Phaser.GameObjects.Image; phase: number }[] = [];
  private decos: Deco[] = [];
  private sig = '';
  private alarmUntil = 0;
  private spin = 0;
  private lastNow = 0;
  private readonly still = reducedMotion();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: World,
    private readonly bx: number,
    private readonly by: number,
    private readonly bw: number,
    private readonly bh: number,
  ) {
    this.makeTextures();
    const tex = scene.textures;
    for (const k of ['q.tape', 'q.dmg']) if (tex.exists(k)) tex.remove(k);
    this.tapeTex = tex.createCanvas('q.tape', bw + PAD * 2, bh + PAD * 2)!;
    this.dmgTex = tex.createCanvas('q.dmg', bw, bh)!;
    scene.add.image(bx, by, 'q.dmg').setOrigin(0).setDepth(DQ.damage);
    scene.add.image(bx - PAD, by - PAD, 'q.tape').setOrigin(0).setDepth(DQ.tape);
    this.haze = scene.add.image(bx + bw / 2, by + bh, 'q.haze').setOrigin(0.5, 1).setDepth(DQ.fire - 0.05).setBlendMode(Phaser.BlendModes.ADD);
    this.haze.setDisplaySize(bw * 1.1, bh * 0.32);
    this.glowG = scene.add.graphics().setDepth(DQ.fire - 0.02).setBlendMode(Phaser.BlendModes.ADD);
    this.fireG = scene.add.graphics().setDepth(DQ.fire);
  }

  // -------------------------------------------------------------- textures

  private canvas(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): void {
    const tex = this.scene.textures;
    if (tex.exists(key)) return;
    const t = tex.createCanvas(key, w, h)!;
    draw(t.getContext());
    t.refresh();
  }

  private makeTextures(): void {
    this.canvas('q.dome', 22, 22, (c) => {
      c.fillStyle = '#14181c';
      c.beginPath();
      c.arc(11, 11, 10, 0, Math.PI * 2);
      c.fill();
      const g = c.createRadialGradient(9, 8, 1, 11, 11, 8);
      g.addColorStop(0, '#ffe1e5');
      g.addColorStop(0.35, '#ff2a44');
      g.addColorStop(1, '#8c0717');
      c.fillStyle = g;
      c.beginPath();
      c.arc(11, 11, 7.5, 0, Math.PI * 2);
      c.fill();
    });
    // Two light wedges like a rotating emergency lamp, fading outward.
    this.canvas('q.beam', 170, 170, (c) => {
      const r = 85;
      for (const a0 of [0, Math.PI]) {
        const g = c.createRadialGradient(r, r, 4, r, r, r);
        g.addColorStop(0, 'rgba(255,50,70,0.75)');
        g.addColorStop(0.45, 'rgba(255,40,64,0.32)');
        g.addColorStop(1, 'rgba(255,40,64,0)');
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(r, r);
        c.arc(r, r, r, a0 - 0.32, a0 + 0.32);
        c.closePath();
        c.fill();
      }
      const h = c.createRadialGradient(r, r, 0, r, r, 26);
      h.addColorStop(0, 'rgba(255,60,80,0.55)');
      h.addColorStop(1, 'rgba(255,60,80,0)');
      c.fillStyle = h;
      c.fillRect(0, 0, 170, 170);
    });
    this.canvas('q.haze', 256, 128, (c) => {
      const g = c.createRadialGradient(128, 150, 10, 128, 150, 150);
      g.addColorStop(0, 'rgba(255,96,40,0.55)');
      g.addColorStop(0.5, 'rgba(255,70,40,0.18)');
      g.addColorStop(1, 'rgba(255,60,40,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 256, 128);
    });
    this.canvas('q.bit', 30, 8, (c) => this.stripes(c, 0, 0, 30, 8, false));
    this.canvas('q.scan', 64, 6, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 6);
      g.addColorStop(0, 'rgba(87,216,242,0)');
      g.addColorStop(0.5, 'rgba(210,252,255,1)');
      g.addColorStop(1, 'rgba(87,216,242,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 6);
    });
    this.canvas('q.flash', 96, 96, (c) => {
      const g = c.createRadialGradient(48, 48, 0, 48, 48, 48);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 96, 96);
    });
    this.canvas('q.ring', 72, 72, (c) => {
      c.strokeStyle = '#ffffff';
      c.lineWidth = 4;
      c.beginPath();
      c.arc(36, 36, 33, 0, Math.PI * 2);
      c.stroke();
    });
    this.canvas('q.pillar', 24, 160, (c) => {
      const g = c.createLinearGradient(0, 160, 0, 0);
      g.addColorStop(0, 'rgba(255,214,110,1)');
      g.addColorStop(1, 'rgba(255,214,110,0)');
      c.fillStyle = g;
      c.fillRect(4, 0, 16, 160);
    });
  }

  /** Black-yellow (or red-white) diagonal stripes in a w × h box. */
  private stripes(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, red: boolean): void {
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    c.fillStyle = red ? '#ffffff' : '#f5c331';
    c.fillRect(x, y, w, h);
    c.fillStyle = red ? '#e03552' : '#14181c';
    const span = Math.max(w, h);
    for (let s = -span; s < span * 2; s += 12) {
      c.beginPath();
      c.moveTo(x + s, y + h);
      c.lineTo(x + s + 6, y + h);
      c.lineTo(x + s + 6 + h, y);
      c.lineTo(x + s + h, y);
      c.closePath();
      c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fillRect(x, y, w, 1);
    c.restore();
  }

  // ------------------------------------------------------- static decor

  private isOpen(x: number, y: number): boolean {
    const s = this.world.s;
    return x >= 0 && y >= 0 && x < s.width && y < s.height && this.world.cell(x, y).revealed;
  }

  private awakeNest(x: number, y: number): boolean {
    const c = this.world.cell(x, y);
    return c.revealed && (c.content === 'nest' || c.content === 'heavy_nest') && !(c.resolved || this.world.site(x, y)?.destroyed);
  }

  private signature(): string {
    const s = this.world.s;
    let open = 0;
    let nests = '';
    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        if (!this.world.cell(x, y).revealed) continue;
        open++;
        if (this.awakeNest(x, y)) nests += `${x},${y};`;
      }
    }
    return `${open}|${nests}|${Math.min(6, this.world.threatLevel)}|${this.world.started}`;
  }

  private rebuild(): void {
    const w = this.world;
    const s = w.s;
    const segs: Seg[] = [];
    const hp = new Set<string>();
    const vp = new Set<string>();
    this.decos = [];
    const dmg = this.dmgTex.getContext();
    dmg.clearRect(0, 0, this.bw, this.bh);
    const fires = Math.min(15, 3 + 2 * w.threatLevel);
    const fireAt: Deco[] = [];
    const smokeAt: Deco[] = [];

    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        const seed = hash(x, y);
        if (this.isOpen(x, y)) {
          if (this.awakeNest(x, y)) {
            segs.push({ x, y, len: 1, vertical: false, red: true, seed }, { x, y: y + 1, len: 1, vertical: false, red: true, seed: seed >> 3 });
            segs.push({ x, y, len: 1, vertical: true, red: true, seed: seed >> 5 }, { x: x + 1, y, len: 1, vertical: true, red: true, seed: seed >> 7 });
          }
          continue;
        }
        if (!w.started) continue;
        // Tape on the border between this closed block and open ground.
        if (this.isOpen(x, y - 1)) segs.push({ x, y, len: 1, vertical: false, red: false, seed });
        if (this.isOpen(x, y + 1)) segs.push({ x, y: y + 1, len: 1, vertical: false, red: false, seed: seed >> 3 });
        if (this.isOpen(x - 1, y)) segs.push({ x, y, len: 1, vertical: true, red: false, seed: seed >> 5 });
        if (this.isOpen(x + 1, y)) segs.push({ x: x + 1, y, len: 1, vertical: true, red: false, seed: seed >> 7 });

        // Damage only deep inside the zone.
        // F-07: two blocks clear of the frontier, and only a handful per field, so the closed field stays calm.
        let near = false;
        for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) if (this.isOpen(x + dx, y + dy)) near = true;
        if (near) continue;
        const v = seed % 100;
        const px = x * STEP;
        const py = y * STEP;
        if (v < fires + 7) this.scorch(dmg, px + CELL / 2, py + CELL / 2);
        if (v < fires) fireAt.push({ cx: this.bx + px + CELL / 2, cy: this.by + py + CELL / 2, seed, kind: 'fire' });
        else if (v < fires + 7) smokeAt.push({ cx: this.bx + px + CELL / 2, cy: this.by + py + CELL / 2, seed, kind: 'smoke' });
        else if (v < fires + 20) this.crack(dmg, px, py, seed);
      }
    }
    // Scattered over the whole zone (by seed), not the first rows.
    const pick = (list: Deco[], n: number) => list.sort((a, b) => (a.seed % 9973) - (b.seed % 9973)).slice(0, n);
    this.decos.push(...pick(fireAt, MAX_FIRES), ...pick(smokeAt, MAX_SMOKE));
    this.dmgTex.refresh();

    const tape = this.tapeTex.getContext();
    tape.clearRect(0, 0, this.bw + PAD * 2, this.bh + PAD * 2);
    for (const sg of segs) {
      // Grid line between cells sits in the middle of the 2 px gap.
      const gx = PAD + sg.x * STEP - (STEP - CELL) / 2;
      const gy = PAD + sg.y * STEP - (STEP - CELL) / 2;
      const len = STEP + 4;
      tape.save();
      tape.translate(sg.vertical ? gx : gx + STEP / 2, sg.vertical ? gy + STEP / 2 : gy);
      tape.rotate((((sg.seed % 7) - 3) * 0.45 * Math.PI) / 180 + (sg.vertical ? Math.PI / 2 : 0));
      tape.fillStyle = 'rgba(0,0,0,0.45)';
      tape.fillRect(-len / 2, -2, len, 10);
      this.stripes(tape, -len / 2, -4, len, 8, sg.red);
      tape.restore();
      if (sg.red) continue;
      if (sg.vertical) {
        vp.add(`${sg.x},${sg.y}`);
        vp.add(`${sg.x},${sg.y + 1}`);
      } else {
        hp.add(`${sg.x},${sg.y}`);
        hp.add(`${sg.x + 1},${sg.y}`);
      }
    }
    this.tapeTex.refresh();

    // Beacons on tape corners, spread out.
    for (const b of this.beacons) {
      b.dome.destroy();
      b.beam.destroy();
    }
    this.beacons = [];
    const corners = [...hp].filter((k) => vp.has(k)).map((k) => k.split(',').map(Number));
    corners.sort((a, b) => (hash(a[0], a[1]) % 97) - (hash(b[0], b[1]) % 97));
    const placed: number[][] = [];
    for (const [gx, gy] of corners) {
      if (placed.length >= MAX_BEACONS || placed.some(([a, b]) => Math.max(Math.abs(a - gx), Math.abs(b - gy)) < 3)) continue;
      placed.push([gx, gy]);
      const px = this.bx + gx * STEP - (STEP - CELL) / 2;
      const py = this.by + gy * STEP - (STEP - CELL) / 2;
      const beam = this.scene.add.image(px, py, 'q.beam').setDepth(DQ.beam).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.8);
      const dome = this.scene.add.image(px, py, 'q.dome').setDepth(DQ.beacon);
      this.beacons.push({ dome, beam, phase: (hash(gx, gy) % 1000) / 1000 });
    }
  }

  private scorch(c: CanvasRenderingContext2D, cx: number, cy: number): void {
    const g = c.createRadialGradient(cx + 2, cy, 2, cx + 2, cy, 24);
    g.addColorStop(0, 'rgba(8,6,6,0.8)');
    g.addColorStop(0.4, 'rgba(40,18,10,0.5)');
    g.addColorStop(1, 'rgba(40,18,10,0)');
    c.fillStyle = g;
    c.fillRect(cx - 26, cy - 26, 52, 52);
  }

  private crack(c: CanvasRenderingContext2D, px: number, py: number, seed: number): void {
    c.save();
    c.translate(px + CELL / 2, py + CELL / 2);
    c.rotate(((seed % 4) * Math.PI) / 2);
    c.strokeStyle = 'rgba(6,9,12,0.85)';
    c.lineWidth = 2.4;
    c.lineJoin = 'bevel';
    c.beginPath();
    c.moveTo(-20, -14);
    c.lineTo(-6, -4);
    c.lineTo(-10, 6);
    c.lineTo(2, 12);
    c.lineTo(0, 22);
    c.moveTo(-6, -4);
    c.lineTo(8, -8);
    c.lineTo(18, 0);
    c.stroke();
    c.restore();
  }

  // -------------------------------------------------------------- per frame

  update(now: number): void {
    const sig = this.signature();
    if (sig !== this.sig) {
      this.sig = sig;
      this.rebuild();
    }
    const dt = this.lastNow ? Math.min(100, now - this.lastNow) : 0;
    this.lastNow = now;
    if (this.still) return this.drawStill();
    const period = now < this.alarmUntil ? BEACON_ALARM : BEACON_SPIN;
    this.spin = (this.spin + dt / period) % 1;
    for (const b of this.beacons) {
      const a = (this.spin + b.phase) % 1;
      b.beam.setRotation(a * Math.PI * 2);
      b.dome.setAlpha(0.75 + 0.25 * Math.abs(Math.cos(a * Math.PI * 2)));
    }
    this.haze.setAlpha(0.75 + 0.25 * Math.sin(now / 540));
    this.drawFires(now);
  }

  private drawStill(): void {
    for (const b of this.beacons) b.beam.setRotation(b.phase * Math.PI);
    this.drawFires(0);
  }

  private drawFires(now: number): void {
    const g = this.fireG;
    const glow = this.glowG;
    g.clear();
    glow.clear();
    for (const d of this.decos) {
      const ph = (d.seed % 1000) / 1000;
      // Smoke: three puffs rising and drifting with the wind.
      for (let k = 0; k < 3; k++) {
        const t = (now / 3200 + ph + k / 3) % 1;
        const a = (t < 0.15 ? t / 0.15 : 1) * (1 - t) * (d.kind === 'fire' ? 0.7 : 0.6);
        g.fillStyle(0x4a5058, a);
        g.fillCircle(d.cx + t * 24 - 4, d.cy - 14 - t * 80, 9 + t * 20);
      }
      if (d.kind !== 'fire') continue;
      const f = (k: number, speed: number) => 0.85 + 0.2 * Math.sin(now / speed + ph * 9 + k * 2.1);
      // Soft firelight on the neighbouring roofs.
      const gl = 0.05 + 0.02 * Math.sin(now / 260 + ph * 7);
      for (const r of [44, 34, 24, 14]) {
        glow.fillStyle(0xff6a28, gl);
        glow.fillCircle(d.cx, d.cy + 6, r);
      }
      // Flames rise above the roof line, taller in the middle.
      const base = d.cy + 20;
      for (const [ox, h, sp] of [
        [-12, 26, 90],
        [0, 44, 70],
        [12, 22, 110],
        [-5, 32, 80],
      ] as const) {
        const hh = h * f(ox, sp);
        const sway = 3 * Math.sin(now / (sp * 1.7) + ox);
        g.fillStyle(0xc81e18, 0.95);
        g.fillTriangle(d.cx + ox - 9, base, d.cx + ox + 9, base, d.cx + ox + sway, base - hh);
        g.fillEllipse(d.cx + ox, base - 5, 18, 12);
        g.fillStyle(0xff7a1a, 1);
        g.fillTriangle(d.cx + ox - 6, base - 2, d.cx + ox + 6, base - 2, d.cx + ox + sway * 1.2, base - hh * 0.72);
        g.fillStyle(0xffcd3a, 1);
        g.fillTriangle(d.cx + ox - 3.5, base - 3, d.cx + ox + 3.5, base - 3, d.cx + ox + sway * 1.4, base - hh * 0.42);
      }
      g.fillStyle(0xfff6c2, 1);
      g.fillEllipse(d.cx, base - 6, 12, 6);
      // Embers.
      for (let k = 0; k < 2; k++) {
        const t = (now / 1500 + ph + k / 2) % 1;
        g.fillStyle(0xffb04a, 1 - t);
        g.fillRect(d.cx - 8 + k * 14 + t * 10, base - 20 - t * 46, 3, 3);
      }
    }
  }

  // ---------------------------------------------------------------- reveal

  /** Beacons spin fast for a while after a nest or hatch opens. */
  alarm(ms = 3500): void {
    this.alarmUntil = this.lastNow + ms;
  }

  /** A roof quarter cut from the closed tile, made once per tile and quarter. */
  private shardKey(tileKey: string, q: number): string {
    const key = `q.shard.${tileKey}.${q}`;
    const tex = this.scene.textures;
    if (tex.exists(key) || !tex.exists(`tile.${tileKey}`)) return key;
    const src = tex.get(`tile.${tileKey}`).getSourceImage() as CanvasImageSource;
    const t = tex.createCanvas(key, CELL, CELL)!;
    const c = t.getContext();
    const m = CELL / 2;
    const pts = [
      [0, 0, CELL, 0],
      [CELL, 0, CELL, CELL],
      [CELL, CELL, 0, CELL],
      [0, CELL, 0, 0],
    ][q];
    c.beginPath();
    c.moveTo(pts[0], pts[1]);
    c.lineTo(pts[2], pts[3]);
    c.lineTo(m + 3, m - 2);
    c.closePath();
    c.save();
    c.clip();
    c.drawImage(src, 0, 0, CELL, CELL);
    c.fillStyle = 'rgba(17,90,128,0.25)';
    c.fillRect(0, 0, CELL, CELL);
    c.restore();
    c.strokeStyle = 'rgba(87,216,242,0.85)';
    c.lineWidth = 1.5;
    c.stroke();
    t.refresh();
    return key;
  }

  reveal(x: number, y: number, tileKey: string, kind: RevealKind): void {
    const sc = this.scene;
    const px = this.bx + x * STEP;
    const py = this.by + y * STEP;
    const cx = px + CELL / 2;
    const cy = py + CELL / 2;
    const rnd = (n: number) => (hash(x * 7 + n, y * 13 + n) % 1000) / 1000;
    const tw = (cfg: Phaser.Types.Tweens.TweenBuilderConfig) => sc.tweens.add(cfg);
    const kill = (o: Phaser.GameObjects.GameObject) => () => o.destroy();

    if (!this.still) {
      // 1. Roof splits into four shards that fly out and fall.
      const centroids = [
        [CELL / 2, CELL * 0.22],
        [CELL * 0.78, CELL / 2],
        [CELL / 2, CELL * 0.78],
        [CELL * 0.22, CELL / 2],
      ];
      const dirs = [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ];
      for (let q = 0; q < 4; q++) {
        const [ox, oy] = centroids[q];
        const sh = sc.add
          .image(px + ox, py + oy, this.shardKey(tileKey, q))
          .setOrigin(ox / CELL, oy / CELL)
          .setDepth(DQ.reveal);
        const k = 30 + rnd(q) * 18;
        tw({
          targets: sh,
          x: { value: sh.x + dirs[q][0] * k + (rnd(q + 9) - 0.5) * 12, ease: 'Cubic.easeOut' },
          y: { value: sh.y + dirs[q][1] * k + 40, ease: 'Back.easeIn' },
          angle: (rnd(q + 4) - 0.5) * 150,
          scale: 0.6,
          alpha: { value: 0, ease: 'Quad.easeIn' },
          duration: 640,
          onComplete: kill(sh),
        });
      }
      // 2. The tape on this block's border snaps and curls away.
      const sides: [number, number, number, number, boolean][] = [
        [0, -1, cx, py - 1, false],
        [0, 1, cx, py + CELL + 1, false],
        [-1, 0, px - 1, cy, true],
        [1, 0, px + CELL + 1, cy, true],
      ];
      for (const [dx, dy, sx, sy, vert] of sides) {
        if (!this.isOpen(x + dx, y + dy)) continue;
        for (const side of [-1, 1]) {
          const bit = sc.add
            .image(vert ? sx : sx + side * 14, vert ? sy + side * 14 : sy, 'q.bit')
            .setAngle(vert ? 90 : 0)
            .setDepth(DQ.reveal + 0.1);
          tw({
            targets: bit,
            x: bit.x + (vert ? dx * 10 : side * 34),
            y: bit.y + (vert ? side * 34 : dy * 10 - 18),
            angle: bit.angle + side * 120,
            scaleX: 0.4,
            alpha: 0,
            duration: 440,
            ease: 'Cubic.easeOut',
            onComplete: kill(bit),
          });
        }
      }
      // 3. Quarantine film dissolves: a scan line runs down the block.
      const scan = sc.add.image(cx, py, 'q.scan').setDepth(DQ.reveal + 0.2).setBlendMode(Phaser.BlendModes.ADD);
      tw({ targets: scan, y: py + CELL, alpha: 0.2, duration: 240, delay: 60, ease: 'Quad.easeIn', onComplete: kill(scan) });
    }

    // 4. Outcome: flash and ring in the colour of what was found.
    const color = { safe: 0xdcfcff, cache: 0xffd66e, survivor: 0xa0ff8c, nest: 0xff3246, hatch: 0xa05aff }[kind];
    const ringColor = { safe: 0x57d8f2, cache: 0xe8a33a, survivor: 0x6fbf3a, nest: 0xef5c73, hatch: 0x8a4dff }[kind];
    const danger = kind === 'nest' || kind === 'hatch';
    const flash = sc.add.image(cx, cy, 'q.flash').setTint(color).setDepth(DQ.reveal + 0.3).setBlendMode(Phaser.BlendModes.ADD).setScale(danger ? 1.6 : 1);
    tw({ targets: flash, alpha: 0, scale: flash.scale * 1.4, duration: danger ? 420 : 220, onComplete: kill(flash) });
    if (!this.still) {
      const ring = sc.add.image(cx, cy, 'q.ring').setTint(ringColor).setDepth(DQ.reveal + 0.3).setScale(0.3);
      tw({ targets: ring, scale: danger ? 2.6 : 1.9, alpha: 0, duration: 560, delay: 180, ease: 'Cubic.easeOut', onComplete: kill(ring) });
    }
    if (kind === 'cache' && !this.still) {
      const pillar = sc.add.image(cx, py + CELL - 6, 'q.pillar').setOrigin(0.5, 1).setDepth(DQ.reveal + 0.2).setBlendMode(Phaser.BlendModes.ADD).setScale(1, 0);
      tw({ targets: pillar, scaleY: 1, duration: 360, delay: 150, ease: 'Cubic.easeOut', yoyo: false, onComplete: () => tw({ targets: pillar, alpha: 0, duration: 500, onComplete: kill(pillar) }) });
    }
    if (danger) this.alarm();
  }
}
