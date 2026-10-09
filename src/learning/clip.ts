import { animSets, art, BUILDING_ANCHOR, drawFrame, drawImage, frameAt } from './art';
import { tr } from './text';

/**
 * Tiny engine for the teaching clips: a few board cells drawn with the game's
 * own tiles and sprites, actors moved along a scripted timeline, a finger that
 * taps and swipes, and one caption at a time. Every clip is a pure script
 * (clips.ts), so it replays identically and loops.
 */

export const CELL = 52;
export const STEP = 54;
const PAD = 10;
const HUD_H = 58;
const DOCK_H = 74;

export const COL = {
  night: '#0B1117',
  board: '#13222C',
  paper: '#F4F7F7',
  graphite: '#10171C',
  seam: '#57D8F2',
  glow: '#9FF4FF',
  deep: '#115A80',
  teal: '#007E89',
  cobalt: '#2E55C8',
  coral: '#EF5C73',
  coralInk: '#E03552',
  amber: '#E8A33A',
  violet: '#8A4DFF',
  green: '#6FBF3A',
  check: '#8FE35A',
};
const FONT_NUM = 'Unbounded, "Golos Text", system-ui, sans-serif';
const FONT = '"Golos Text", system-ui, sans-serif';

export type Channel = 'threat' | 'finds' | 'demon';
export type Clue = Partial<Record<Channel, number>>;

export interface Cell {
  open: boolean;
  tile?: string;
  clue?: Clue;
  mark?: 'safe' | 'threat' | 'demon' | 'caution';
  markT?: number;
  queued?: boolean;
  auto?: boolean;
  arc?: number;
  glow?: string;
  openT?: number;
  hot?: boolean;
}

export interface Actor {
  set: string;
  anim: string;
  t0: number;
  x: number;
  y: number;
  flip: boolean;
  alpha: number;
  scale: number;
  hp?: number;
  ring?: boolean;
  glow?: string;
}

interface Building {
  type: string;
  x: number;
  y: number;
  anim?: string;
  t0: number;
  frame?: number;
  alpha: number;
  ghost?: boolean;
}

interface Fx {
  set: string;
  anim: string;
  t0: number;
  x: number;
  y: number;
  scale: number;
  len: number;
}

interface Orb {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t0: number;
  dur: number;
  icon?: string;
}

type Ease = (k: number) => number;
export const ease = {
  linear: (k: number) => k,
  out: (k: number) => 1 - (1 - k) * (1 - k),
  inOut: (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2),
};

/** Scripted events and tweens on the clip clock. */
export class Timeline {
  items: { t: number; d: number; fn: (k: number) => void; ease: Ease }[] = [];

  at(t: number, fn: () => void): void {
    this.items.push({ t, d: 0, fn: () => fn(), ease: ease.linear });
  }

  tween(t: number, d: number, fn: (k: number) => void, e: Ease = ease.inOut): void {
    this.items.push({ t, d, fn, ease: e });
  }
}

/** Everything a clip draws. Scripts change it through the helpers below. */
export class Stage {
  cells: Cell[] = [];
  actors: Actor[] = [];
  buildings: Building[] = [];
  fx: Fx[] = [];
  orbs: Orb[] = [];
  finger = { x: 0, y: 0, visible: false, down: false, tapT: -9, holdT: -9, holdLen: 0, trail: [] as { x: number; y: number; t: number }[] };
  frame: { x: number; y: number; color: string; t0: number } | null = null;
  target: { x: number; y: number; t0: number } | null = null;
  lane: { x0: number; y: number; x1: number; t0: number } | null = null;
  hud: { energy: number; bumpT: number; threat: number; frac: number; threatBumpT: number } | null = null;
  dock: { active: 'dig' | 'build'; picker: boolean; sel: string | null; t0: number } | null = null;
  chip: { text: string; x: number; y: number; t0: number; pressT: number } | null = null;
  card: { caps: string; title: string; sub?: string; color: string; t0: number } | null = null;
  cap = { key: '', t0: 0 };

  constructor(
    readonly cols: number,
    readonly rows: number,
    readonly tl: Timeline,
    readonly opts: { hud?: boolean; dock?: boolean; zoom?: number },
  ) {
    for (let i = 0; i < cols * rows; i++) this.cells.push({ open: false });
  }

  // ------------------------------------------------------------ geometry

  get boardX(): number {
    return PAD;
  }

  get boardY(): number {
    return PAD + (this.opts.hud ? HUD_H : 0);
  }

  get width(): number {
    return this.cols * STEP - (STEP - CELL) + PAD * 2;
  }

  get height(): number {
    return this.rows * STEP - (STEP - CELL) + PAD * 2 + (this.opts.hud ? HUD_H : 0) + (this.opts.dock ? DOCK_H : 0);
  }

  /** Pixel center of a (fractional) cell. */
  px(x: number, y: number): { x: number; y: number } {
    return { x: this.boardX + x * STEP + CELL / 2, y: this.boardY + y * STEP + CELL / 2 };
  }

  cell(x: number, y: number): Cell {
    return this.cells[y * this.cols + x];
  }

  // ------------------------------------------------------- board helpers

  /** Opens cells right away (no animation), e.g. the starting layout. */
  openNow(cells: [number, number][], tile?: string): void {
    for (const [x, y] of cells) Object.assign(this.cell(x, y), { open: true, tile: tile ?? groundTile(x, y), openT: -9 });
  }

  openRect(x0: number, y0: number, x1: number, y1: number): void {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.openNow([[x, y]]);
  }

  /** Opens a cell at time t with the pop and dust of a finished dig. */
  open(t: number, x: number, y: number, patch: Partial<Cell> = {}, dust = true): void {
    this.tl.at(t, () => {
      Object.assign(this.cell(x, y), { open: true, tile: groundTile(x, y), openT: t, queued: false, auto: false, arc: undefined, mark: undefined, glow: undefined }, patch);
      if (dust) this.spawnFx(t, 'fx', 'dig_dust', x, y);
    });
  }

  set(t: number, x: number, y: number, patch: Partial<Cell>): void {
    this.tl.at(t, () => Object.assign(this.cell(x, y), patch));
  }

  mark(t: number, x: number, y: number, mark: Cell['mark']): void {
    this.tl.at(t, () => Object.assign(this.cell(x, y), { mark, markT: t }));
  }

  /** The work ring closing on a cell from t to t + d. */
  work(t: number, d: number, x: number, y: number): void {
    this.tl.tween(t, d, (k) => (this.cell(x, y).arc = k >= 1 ? undefined : 1 - k), ease.linear);
  }

  // ------------------------------------------------------------- actors

  actor(set: string, x: number, y: number, anim = 'idle', patch: Partial<Actor> = {}): Actor {
    const a: Actor = { set, anim, t0: 0, x, y, flip: false, alpha: 1, scale: 1, ...patch };
    this.actors.push(a);
    return a;
  }

  /** Actor appears at time t. */
  spawn(t: number, set: string, x: number, y: number, anim = 'idle', patch: Partial<Actor> = {}): Actor {
    const a = this.actor(set, x, y, anim, { alpha: 0, t0: t, ...patch });
    this.tl.at(t, () => {
      a.alpha = patch.alpha ?? 1;
      a.t0 = t;
    });
    return a;
  }

  play(t: number, a: Actor, anim: string): void {
    this.tl.at(t, () => {
      a.anim = anim;
      a.t0 = t;
    });
  }

  face(t: number, a: Actor, dx: number): void {
    this.tl.at(t, () => (a.flip = flipFor(a.set, dx)));
  }

  /** Walks along cell points; returns the arrival time. */
  walk(t: number, a: Actor, path: [number, number][], speed = 2.6, endAnim = 'idle'): number {
    let x = path[0][0];
    let y = path[0][1];
    let time = t;
    this.play(t, a, 'walk');
    for (const [nx, ny] of path.slice(1)) {
      const d = Math.hypot(nx - x, ny - y) / speed;
      const [sx, sy] = [x, y];
      const dx = nx - sx;
      const dir = flipFor(a.set, dx);
      this.tl.tween(
        time,
        d,
        (k) => {
          a.x = sx + (nx - sx) * k;
          a.y = sy + (ny - sy) * k;
          if (Math.abs(dx) > 0.01) a.flip = dir;
        },
        ease.linear,
      );
      time += d;
      x = nx;
      y = ny;
    }
    this.play(time, a, endAnim);
    return time;
  }

  fade(t: number, a: Actor, to: number, d = 0.3): void {
    let from = NaN;
    this.tl.tween(t, d, (k) => {
      if (Number.isNaN(from)) from = a.alpha;
      a.alpha = from + (to - from) * k;
    });
  }

  hp(t: number, a: Actor, to: number, d = 0.15): void {
    let from = NaN;
    this.tl.tween(t, d, (k) => {
      if (Number.isNaN(from)) from = a.hp ?? 1;
      a.hp = from + (to - from) * k;
    });
  }

  /** One melee exchange: attack anim, hit flash on the target, its health drops. */
  hit(t: number, by: Actor, target: Actor, hpTo: number, fx = 'hit_impact'): void {
    this.play(t, by, 'attack');
    if (animSets[target.set]?.anims.hit) this.play(t + 0.25, target, 'hit');
    this.tl.at(t + 0.25, () => this.fx.push({ set: 'fx', anim: fx, t0: t + 0.25, x: target.x, y: target.y - 0.35, scale: 1, len: 0.6 }));
    this.hp(t + 0.25, target, hpTo);
    this.play(t + 0.55, by, 'idle');
    if (animSets[target.set]?.anims.hit) this.play(t + 0.5, target, 'idle');
  }

  /** Attack on a cell (a nest or a hatch) rather than on an actor. */
  strike(t: number, by: Actor, x: number, y: number, fx = 'hit_impact'): void {
    this.play(t, by, 'attack');
    this.spawnFx(t + 0.25, 'fx', fx, x, y);
    this.play(t + 0.55, by, 'idle');
  }

  spawnFx(t: number, set: string, anim: string, x: number, y: number, scale = 1): void {
    const a = animSets[set]?.anims[anim];
    const len = a ? a.frames.length / a.fps : 0.6;
    this.tl.at(t, () => this.fx.push({ set, anim, t0: t, x, y, scale, len }));
  }

  // --------------------------------------------------------- buildings

  /** Building sprite; `construct` runs its scaffold animation from t over d seconds. */
  building(t: number, type: string, x: number, y: number, construct = 0): Building {
    const b: Building = { type, x, y, t0: t, alpha: 0 };
    this.buildings.push(b);
    this.tl.at(t, () => {
      b.alpha = 1;
      b.ghost = false;
      if (construct > 0 && animSets[`bld_${type}`]) {
        b.anim = 'construct';
        b.frame = 0;
      }
    });
    if (construct > 0 && animSets[`bld_${type}`]) {
      this.tl.tween(t, construct, (k) => (b.frame = Math.min(6, Math.floor(k * 7))), ease.linear);
      this.tl.at(t + construct, () => {
        b.anim = undefined;
        b.frame = undefined;
      });
      this.work(t, construct, x, y);
    }
    return b;
  }

  ghost(t: number, type: string, x: number, y: number, until: number): void {
    const b: Building = { type, x, y, t0: t, alpha: 0, ghost: true };
    this.buildings.push(b);
    this.tl.at(t, () => (b.alpha = 0.55));
    this.tl.at(until, () => (b.alpha = 0));
  }

  buildingAnim(t: number, b: Building, anim: string | undefined): void {
    this.tl.at(t, () => {
      b.anim = anim;
      b.t0 = t;
      b.frame = undefined;
    });
  }

  // -------------------------------------------------------- finger & UI

  fingerTo(t: number, d: number, to: { x: number; y: number }, from?: { x: number; y: number }): void {
    const f = this.finger;
    let sx = 0;
    let sy = 0;
    let started = false;
    this.tl.tween(t, d, (k) => {
      if (!started) {
        started = true;
        sx = from?.x ?? f.x;
        sy = from?.y ?? f.y;
        f.visible = true;
      }
      f.x = sx + (to.x - sx) * k;
      f.y = sy + (to.y - sy) * k;
    });
  }

  fingerCell(t: number, d: number, x: number, y: number): void {
    this.fingerTo(t, d, this.px(x, y + 0.15));
  }

  tap(t: number): void {
    this.tl.at(t, () => {
      this.finger.down = true;
      this.finger.tapT = t;
    });
    this.tl.at(t + 0.18, () => (this.finger.down = false));
  }

  hold(t: number, d: number): void {
    this.tl.at(t, () => {
      this.finger.down = true;
      this.finger.holdT = t;
      this.finger.holdLen = d;
    });
    this.tl.at(t + d, () => {
      this.finger.down = false;
      this.finger.holdT = -9;
    });
  }

  fingerHide(t: number): void {
    this.tl.at(t, () => (this.finger.visible = false));
  }

  /** Drags the finger through cells; `onCell` runs as it enters each one. */
  swipe(t: number, cells: [number, number][], perCell: number, onCell: (x: number, y: number, t: number) => void): number {
    this.tl.at(t, () => (this.finger.down = true));
    cells.forEach(([x, y], i) => {
      const tt = t + i * perCell;
      if (i > 0) this.fingerTo(tt - perCell, perCell, this.px(x, y + 0.15));
      onCell(x, y, tt);
    });
    const end = t + (cells.length - 1) * perCell;
    this.tl.at(end + 0.1, () => (this.finger.down = false));
    return end;
  }

  caption(t: number, key: string): void {
    this.tl.at(t, () => (this.cap = { key, t0: t }));
  }

  showFrame(t: number, x: number, y: number, color: string, until: number): void {
    this.tl.at(t, () => (this.frame = { x, y, color, t0: t }));
    this.tl.at(until, () => (this.frame = null));
  }

  setTarget(t: number, x: number, y: number, until: number): void {
    this.tl.at(t, () => (this.target = { x, y, t0: t }));
    this.tl.at(until, () => (this.target = null));
  }

  orb(t: number, x: number, y: number, dur = 0.7, gain = 5, icon?: string): void {
    const from = this.px(x, y);
    const to = this.hudEnergyPos();
    this.tl.at(t, () => this.orbs.push({ x0: from.x, y0: from.y, x1: to.x, y1: to.y, t0: t, dur, icon }));
    if (this.hud) this.tl.at(t + dur, () => this.energy(this.hud!.energy + gain, t + dur));
  }

  /** An icon (e.g. a trophy part) flying between two cells. */
  flyIcon(t: number, icon: string, from: [number, number], to: [number, number], dur = 0.6): void {
    const a = this.px(from[0], from[1] - 0.4);
    const b = this.px(to[0], to[1] - 0.4);
    this.tl.at(t, () => this.orbs.push({ x0: a.x, y0: a.y, x1: b.x, y1: b.y, t0: t, dur, icon }));
  }

  energy(v: number, t: number): void {
    if (!this.hud) return;
    this.hud.energy = v;
    this.hud.bumpT = t;
  }

  setEnergy(t: number, v: number): void {
    this.tl.at(t, () => this.energy(v, t));
  }

  hudEnergyPos(): { x: number; y: number } {
    return { x: PAD + 34, y: PAD + HUD_H / 2 - 4 };
  }

  chipAt(t: number, text: string, x: number, y: number, pressAt: number, until: number): void {
    const p = this.px(x, y);
    this.tl.at(t, () => (this.chip = { text, x: p.x, y: p.y - 46, t0: t, pressT: -9 }));
    this.tl.at(pressAt, () => this.chip && (this.chip.pressT = pressAt));
    this.tl.at(until, () => (this.chip = null));
  }

  chipPos(x: number, y: number): { x: number; y: number } {
    const p = this.px(x, y);
    return { x: p.x, y: p.y - 46 };
  }

  showCard(t: number, caps: string, title: string, color: string, until: number, sub?: string): void {
    this.tl.at(t, () => (this.card = { caps, title, sub, color, t0: t }));
    this.tl.at(until, () => (this.card = null));
  }

  dockButton(which: 'dig' | 'build'): { x: number; y: number } {
    const y = this.height - PAD - DOCK_H / 2 + 6;
    const w = this.width - PAD * 2;
    return { x: PAD + (which === 'dig' ? w * 0.25 : w * 0.75), y };
  }

  pickerSlot(i: number): { x: number; y: number } {
    const w = this.width - PAD * 2;
    return { x: PAD + w * (0.2 + i * 0.3), y: this.height - PAD - DOCK_H - 44 };
  }
}

export const PICKER = ['home', 'school', 'reactor'];
const PICKER_COST: Record<string, number> = { home: 40, school: 100, reactor: 50 };

const GROUND = ['ground_0', 'ground_1', 'ground_0', 'ground_grass_0', 'ground_1', 'ground_grass_1', 'ground_0', 'ground_grass_2'];
export function groundTile(x: number, y: number): string {
  return GROUND[(x * 7 + y * 13) % GROUND.length];
}

function flipFor(set: string, dx: number): boolean {
  const faces = animSets[set]?.faces;
  if (faces === 'left') return dx > 0;
  if (faces === 'right') return dx < 0;
  return false;
}

// =================================================================== render

let film: HTMLCanvasElement | null = null;
function hexFilm(w: number, h: number): HTMLCanvasElement {
  if (film && film.width >= w && film.height >= h) return film;
  film = document.createElement('canvas');
  film.width = Math.max(w, 600);
  film.height = Math.max(h, 600);
  const ctx = film.getContext('2d')!;
  const r = 15;
  const hw = Math.sqrt(3) * r;
  ctx.fillStyle = 'rgba(17,90,128,0.16)';
  ctx.fillRect(0, 0, film.width, film.height);
  ctx.strokeStyle = 'rgba(87,216,242,0.30)';
  ctx.lineWidth = 1.5;
  for (let row = -1; row * r * 1.5 < film.height + r; row++) {
    for (let col = -1; col * hw < film.width + hw; col++) {
      const cx = col * hw + (row % 2 ? hw / 2 : 0);
      const cy = row * r * 1.5;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i + Math.PI / 6;
        ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  return film;
}

function cutRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a: number, b: number): void {
  ctx.beginPath();
  ctx.moveTo(x + a, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - b);
  ctx.lineTo(x + w - b, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + a);
  ctx.closePath();
}

export function glyphPath(ctx: CanvasRenderingContext2D, kind: Channel, x: number, y: number, r: number): void {
  ctx.beginPath();
  if (kind === 'threat') {
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y + r * 0.8);
    ctx.lineTo(x - r, y + r * 0.8);
  } else if (kind === 'finds') {
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
  } else {
    for (let i = 0; i < 6; i++) ctx.lineTo(x + r * Math.cos((Math.PI / 3) * i), y + r * Math.sin((Math.PI / 3) * i));
  }
  ctx.closePath();
}

const CH_COLOR: Record<Channel, string> = { threat: COL.coralInk, finds: COL.teal, demon: COL.violet };

function check(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.moveTo(x - 9, y);
  ctx.lineTo(x - 3, y + 7);
  ctx.lineTo(x + 10, y - 8);
  ctx.stroke();
}

export function render(ctx: CanvasRenderingContext2D, s: Stage, now: number): void {
  const W = s.width;
  const H = s.height;
  ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // board backing
  ctx.fillStyle = COL.board;
  ctx.fillRect(s.boardX - 4, s.boardY - 4, s.cols * STEP + 6, s.rows * STEP + 6);

  const hex = hexFilm(W, H);
  for (let y = 0; y < s.rows; y++) {
    for (let x = 0; x < s.cols; x++) {
      const c = s.cell(x, y);
      const px = s.boardX + x * STEP;
      const py = s.boardY + y * STEP;
      if (!c.open) {
        drawImage(ctx, `tile.closed_${(x * 3 + y * 5) % 4}`, px, py, CELL, CELL);
        ctx.drawImage(hex, px, py, CELL, CELL, px, py, CELL, CELL);
      } else {
        const pop = c.openT !== undefined ? Math.min(1, (now - c.openT) / 0.25) : 1;
        const sc = 0.82 + 0.18 * ease.out(pop) + (pop < 1 ? Math.sin(pop * Math.PI) * 0.06 : 0);
        ctx.save();
        ctx.translate(px + CELL / 2, py + CELL / 2);
        ctx.scale(sc, sc);
        drawImage(ctx, `tile.${c.tile ?? groundTile(x, y)}`, -CELL / 2, -CELL / 2, CELL, CELL);
        ctx.restore();
        if (c.hot) {
          ctx.globalAlpha = 0.85;
          drawImage(ctx, `tile.hot_${(x + y) % 2}`, px, py, CELL, CELL);
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  // closed-cell overlays: queue, marks, glow
  for (let y = 0; y < s.rows; y++) {
    for (let x = 0; x < s.cols; x++) {
      const c = s.cell(x, y);
      const px = s.boardX + x * STEP;
      const py = s.boardY + y * STEP;
      const cx = px + CELL / 2;
      const cy = py + CELL / 2;
      if (c.glow) {
        const pulse = 0.55 + 0.45 * Math.sin(now * 6);
        ctx.fillStyle = hexA(c.glow, 0.22 * pulse + 0.1);
        ctx.fillRect(px, py, CELL, CELL);
        ctx.strokeStyle = hexA(c.glow, 0.9);
        ctx.lineWidth = 3;
        ctx.strokeRect(px + 2, py + 2, CELL - 4, CELL - 4);
      }
      if (c.queued || c.auto) {
        ctx.fillStyle = c.auto ? 'rgba(87,216,242,0.10)' : 'rgba(87,216,242,0.28)';
        ctx.fillRect(px, py, CELL, CELL);
        ctx.strokeStyle = COL.seam;
        ctx.lineWidth = 3;
        if (c.auto) ctx.setLineDash([6, 5]);
        ctx.strokeRect(px + 2.5, py + 2.5, CELL - 5, CELL - 5);
        ctx.setLineDash([]);
        if (!c.auto && c.arc === undefined) {
          ctx.fillStyle = COL.glow;
          ctx.beginPath();
          ctx.moveTo(cx, cy - 7);
          ctx.lineTo(cx + 7, cy);
          ctx.lineTo(cx, cy + 7);
          ctx.lineTo(cx - 7, cy);
          ctx.fill();
        }
      }
      if (c.mark) {
        const k = Math.min(1, (now - (c.markT ?? -9)) / 0.3);
        const sc = 0.4 + 0.6 * ease.out(k) + Math.sin(k * Math.PI) * 0.25;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(sc, sc);
        if (c.mark === 'safe') {
          ctx.fillStyle = 'rgba(111,191,58,0.20)';
          ctx.fillRect(-CELL / 2, -CELL / 2, CELL, CELL);
          ctx.strokeStyle = 'rgba(11,17,23,0.5)';
          ctx.lineWidth = 6;
          check(ctx, 0, 1);
          ctx.strokeStyle = COL.check;
          ctx.lineWidth = 5;
          check(ctx, 0, 0);
        } else if (c.mark === 'threat' || c.mark === 'demon') {
          const col = c.mark === 'threat' ? COL.coral : COL.violet;
          const pulse = 0.75 + 0.25 * Math.sin(now * 5);
          ctx.fillStyle = hexA(col, 0.32 * pulse);
          ctx.fillRect(-CELL / 2, -CELL / 2, CELL, CELL);
          ctx.strokeStyle = col;
          ctx.lineWidth = 3;
          ctx.strokeRect(-CELL / 2 + 2, -CELL / 2 + 2, CELL - 4, CELL - 4);
          glyphPath(ctx, c.mark === 'threat' ? 'threat' : 'demon', 0, 0, 13);
          ctx.fillStyle = c.mark === 'threat' ? COL.coralInk : COL.violet;
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (c.mark === 'caution') {
          ctx.fillStyle = 'rgba(232,163,58,0.22)';
          ctx.fillRect(-CELL / 2, -CELL / 2, CELL, CELL);
          ctx.strokeStyle = COL.graphite;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-6, 14);
          ctx.lineTo(-6, -14);
          ctx.stroke();
          ctx.fillStyle = COL.amber;
          ctx.beginPath();
          ctx.moveTo(-5, -14);
          ctx.lineTo(13, -7);
          ctx.lineTo(-5, 0);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  // neighbourhood frame
  if (s.frame) {
    const f = s.frame;
    const k = ease.out(Math.min(1, (now - f.t0) / 0.25));
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = f.x + dx;
        const y = f.y + dy;
        if (x < 0 || y < 0 || x >= s.cols || y >= s.rows || (dx === 0 && dy === 0)) continue;
        const c = s.cell(x, y);
        const px = s.boardX + x * STEP;
        const py = s.boardY + y * STEP;
        if (c.open) {
          ctx.fillStyle = `rgba(11,17,23,${0.35 * k})`;
          ctx.fillRect(px, py, CELL, CELL);
        } else {
          ctx.fillStyle = hexA(f.color, 0.3 * k);
          ctx.fillRect(px, py, CELL, CELL);
        }
      }
    }
    const x0 = s.boardX + Math.max(0, f.x - 1) * STEP - 3;
    const y0 = s.boardY + Math.max(0, f.y - 1) * STEP - 3;
    const x1 = s.boardX + Math.min(s.cols - 1, f.x + 1) * STEP + CELL + 3;
    const y1 = s.boardY + Math.min(s.rows - 1, f.y + 1) * STEP + CELL + 3;
    const grow = (1 - k) * 14;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 6 * k;
    ctx.strokeRect(x0 - grow, y0 - grow, x1 - x0 + grow * 2, y1 - y0 + grow * 2);
    ctx.strokeStyle = f.color;
    ctx.lineWidth = 3.5 * k;
    ctx.strokeRect(x0 - grow, y0 - grow, x1 - x0 + grow * 2, y1 - y0 + grow * 2);
  }

  // clue numbers
  for (let y = 0; y < s.rows; y++) {
    for (let x = 0; x < s.cols; x++) {
      const c = s.cell(x, y);
      if (!c.open || !c.clue) continue;
      const k = c.openT !== undefined ? Math.min(1, Math.max(0, (now - c.openT - 0.1) / 0.25)) : 1;
      if (k <= 0) continue;
      const p = s.px(x, y);
      const active = (['finds', 'threat', 'demon'] as Channel[]).filter((ch) => (c.clue![ch] ?? 0) > 0);
      ctx.save();
      ctx.globalAlpha = k;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const ch of active) {
        const n = String(c.clue[ch]);
        let tx = p.x - 5;
        let ty = p.y + 2;
        let size = 30;
        if (active.length > 1) {
          const pos = ch === 'finds' ? [-13, -11] : ch === 'threat' ? [13, -11] : [0, 13];
          tx = p.x + pos[0];
          ty = p.y + pos[1] + 1;
          size = 19;
        }
        ctx.font = `800 ${size}px ${FONT_NUM}`;
        ctx.lineWidth = size > 20 ? 7 : 5;
        ctx.strokeStyle = '#fff';
        ctx.strokeText(n, tx, ty);
        ctx.fillStyle = CH_COLOR[ch];
        ctx.fillText(n, tx, ty);
        if (active.length === 1) {
          glyphPath(ctx, ch, p.x + 15, p.y - 11, 6);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.fillStyle = CH_COLOR[ch];
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  // target ring under actors
  if (s.target) {
    const p = s.px(s.target.x, s.target.y);
    const k = (now - s.target.t0) % 1;
    ctx.strokeStyle = hexA(COL.coral, 1 - k);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 14, 14 + k * 16, 6 + k * 7, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = COL.coral;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 14, 16, 7, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // danger lane (demon steam)
  if (s.lane) {
    const l = s.lane;
    const a = s.px(l.x0, l.y);
    const b = s.px(l.x1, l.y);
    const k = Math.min(1, (now - l.t0) / 0.3);
    ctx.fillStyle = `rgba(239,92,115,${0.18 + 0.12 * Math.sin(now * 14)})`;
    ctx.fillRect(Math.min(a.x, b.x) - CELL / 2, a.y - CELL / 2, Math.abs(b.x - a.x) * k + CELL, CELL);
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = COL.coral;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(Math.min(a.x, b.x) - CELL / 2, a.y - CELL / 2, Math.abs(b.x - a.x) * k + CELL, CELL);
    ctx.setLineDash([]);
  }

  // sprites, sorted by feet
  type D = { y: number; draw: () => void };
  const draws: D[] = [];
  for (const b of s.buildings) {
    if (b.alpha <= 0) continue;
    const p = s.px(b.x, b.y);
    draws.push({
      y: p.y + 10,
      draw: () => {
        ctx.save();
        ctx.globalAlpha = b.alpha;
        const sheet = `bld_${b.type}`;
        if (b.anim && animSets[sheet]) {
          const f = b.frame ?? frameAt(sheet, b.anim, now - b.t0);
          drawFrame(ctx, sheet, f, p.x, p.y);
        } else {
          const a = BUILDING_ANCHOR[b.type] ?? [36, 78];
          if (b.ghost) {
            ctx.fillStyle = 'rgba(87,216,242,0.35)';
            ctx.fillRect(p.x - CELL / 2, p.y - CELL / 2, CELL, CELL);
          }
          drawImage(ctx, `building.${b.type}`, p.x - a[0], p.y - a[1]);
        }
        ctx.restore();
      },
    });
  }
  for (const a of s.actors) {
    if (a.alpha <= 0) continue;
    const p = s.px(a.x, a.y);
    const feet = p.y + 14;
    draws.push({
      y: feet,
      draw: () => {
        if (a.ring) {
          ctx.strokeStyle = 'rgba(87,216,242,0.9)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(p.x, feet - 1, 15 * a.scale, 6 * a.scale, 0, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(11,17,23,0.25)';
          ctx.beginPath();
          ctx.ellipse(p.x, feet - 1, 13 * a.scale, 5 * a.scale, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        if (a.glow) {
          const g = ctx.createRadialGradient(p.x, feet - 22, 2, p.x, feet - 22, 30 * a.scale);
          g.addColorStop(0, hexA(a.glow, 0.55));
          g.addColorStop(1, hexA(a.glow, 0));
          ctx.fillStyle = g;
          ctx.fillRect(p.x - 34, feet - 56, 68, 68);
        }
        drawFrame(ctx, a.set, frameAt(a.set, a.anim, now - a.t0), p.x, feet, { flip: a.flip, scale: a.scale, alpha: a.alpha });
        if (a.hp !== undefined && a.hp > 0 && a.alpha > 0.5) {
          const top = feet - (animSets[a.set]?.anchor[1] ?? 54) * a.scale - 4;
          const w = 34;
          ctx.fillStyle = 'rgba(11,17,23,0.75)';
          ctx.fillRect(p.x - w / 2 - 2, top - 2, w + 4, 8);
          ctx.fillStyle = a.set.startsWith('defender') ? COL.green : COL.coralInk;
          ctx.fillRect(p.x - w / 2, top, w * Math.max(0, Math.min(1, a.hp)), 4);
        }
      },
    });
  }
  draws.sort((a, b) => a.y - b.y).forEach((d) => d.draw());

  // effects
  for (const f of s.fx) {
    const age = now - f.t0;
    if (age < 0 || age > f.len) continue;
    const p = s.px(f.x, f.y);
    const a = animSets[f.set];
    if (!a) continue;
    const isCell = a.anchor[0] === 0 && a.anchor[1] === 0;
    drawFrame(ctx, f.set, frameAt(f.set, f.anim, age), isCell ? p.x - (a.frameSize[0] * f.scale) / 2 : p.x, isCell ? p.y - (a.frameSize[1] * f.scale) / 2 : p.y, { scale: f.scale });
  }

  // work arcs
  for (let y = 0; y < s.rows; y++) {
    for (let x = 0; x < s.cols; x++) {
      const left = s.cell(x, y).arc;
      if (left === undefined) continue;
      const p = s.px(x, y);
      const r = 21;
      ctx.strokeStyle = 'rgba(11,17,23,0.35)';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
      if (left <= 0) continue;
      const a0 = -Math.PI / 2;
      ctx.strokeStyle = 'rgba(87,216,242,0.25)';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, a0, a0 + Math.PI * 2 * left);
      ctx.stroke();
      ctx.strokeStyle = COL.glow;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, a0, a0 + Math.PI * 2 * left);
      ctx.stroke();
    }
  }

  // energy orbs
  for (const o of s.orbs) {
    const k = (now - o.t0) / o.dur;
    if (k < 0 || k > 1) continue;
    const e = ease.inOut(k);
    const x = o.x0 + (o.x1 - o.x0) * e;
    const y = o.y0 + (o.y1 - o.y0) * e - Math.sin(k * Math.PI) * 40;
    if (o.icon) drawImage(ctx, o.icon, x - 16, y - 16, 32, 32);
    else drawFrame(ctx, 'fx', frameAt('fx', 'energy_orb', now - o.t0), x - 26, y - 26);
  }

  if (s.hud) drawHud(ctx, s, now);
  if (s.dock) drawDock(ctx, s, now);
  if (s.chip) drawChip(ctx, s.chip, now);
  if (s.card) drawCard(ctx, s, s.card, now);
  drawFinger(ctx, s, now);
}

function drawHud(ctx: CanvasRenderingContext2D, s: Stage, now: number): void {
  const h = s.hud!;
  const x = PAD;
  const y = PAD;
  const w = s.width - PAD * 2;
  ctx.fillStyle = 'rgba(11,17,23,0.12)';
  cutRect(ctx, x + 1, y + 4, w, HUD_H - 12, 12, 12);
  ctx.fill();
  ctx.fillStyle = COL.paper;
  cutRect(ctx, x, y, w, HUD_H - 12, 12, 12);
  ctx.fill();
  ctx.strokeStyle = COL.seam;
  ctx.lineWidth = 1.5;
  cutRect(ctx, x + 4, y + 4, w - 8, HUD_H - 20, 9, 9);
  ctx.stroke();
  const bump = Math.max(0, 1 - (now - h.bumpT) / 0.3);
  drawImage(ctx, 'icon.energy', x + 12, y + 7, 32, 32);
  ctx.save();
  ctx.font = `800 ${20 + bump * 5}px ${FONT_NUM}`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COL.cobalt;
  ctx.fillText(String(Math.round(h.energy)), x + 48, y + 23);
  ctx.restore();
  // threat ring
  const rx = x + w - 30;
  const ry = y + 23;
  const tb = Math.max(0, 1 - (now - h.threatBumpT) / 0.5);
  ctx.fillStyle = COL.coral;
  ctx.beginPath();
  ctx.arc(rx, ry, 15 + tb * 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(232,163,58,0.3)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(rx, ry, 19 + tb * 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = COL.amber;
  ctx.beginPath();
  ctx.arc(rx, ry, 19 + tb * 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * h.frac);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = `800 15px ${FONT_NUM}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(h.threat), rx, ry + 1);
  ctx.textAlign = 'left';
  ctx.font = `700 9px ${FONT_NUM}`;
  ctx.fillStyle = COL.deep;
  ctx.textAlign = 'right';
  ctx.fillText(tr('hud.threat').toUpperCase(), rx - 26, ry + 1);
  ctx.textAlign = 'left';
}

function drawDock(ctx: CanvasRenderingContext2D, s: Stage, now: number): void {
  const d = s.dock!;
  const x = PAD;
  const y = s.height - PAD - DOCK_H + 10;
  const w = s.width - PAD * 2;
  const h = DOCK_H - 10;
  ctx.fillStyle = COL.paper;
  cutRect(ctx, x, y, w, h, 12, 12);
  ctx.fill();
  ctx.strokeStyle = COL.seam;
  ctx.lineWidth = 1.5;
  cutRect(ctx, x + 4, y + 4, w - 8, h - 8, 9, 9);
  ctx.stroke();
  (['dig', 'build'] as const).forEach((m, i) => {
    const bx = x + 10 + i * ((w - 20) / 2);
    const bw = (w - 20) / 2 - 4;
    const active = d.active === m;
    ctx.fillStyle = active ? COL.graphite : 'rgba(16,23,28,0.06)';
    cutRect(ctx, bx, y + 10, bw, h - 20, 9, 9);
    ctx.fill();
    drawImage(ctx, m === 'dig' ? 'icon.dig' : 'icon.build', bx + bw / 2 - 52, y + h / 2 - 13, 26, 26);
    ctx.fillStyle = active ? '#fff' : COL.graphite;
    ctx.font = `700 15px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(tr(m === 'dig' ? 'chip.dig' : 'chip.build'), bx + bw / 2 - 20, y + h / 2 + 1);
  });
  if (d.picker) {
    const k = ease.out(Math.min(1, (now - d.t0) / 0.25));
    const py = s.height - PAD - DOCK_H - 84 + (1 - k) * 20;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = COL.paper;
    cutRect(ctx, x, py, w, 78, 10, 10);
    ctx.fill();
    ctx.strokeStyle = COL.seam;
    ctx.stroke();
    PICKER.forEach((type, i) => {
      const c = s.pickerSlot(i);
      const sel = d.sel === type;
      ctx.fillStyle = sel ? 'rgba(87,216,242,0.35)' : 'rgba(16,23,28,0.05)';
      cutRect(ctx, c.x - 40, py + 6, 80, 66, 8, 8);
      ctx.fill();
      if (sel) {
        ctx.strokeStyle = COL.teal;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      const img = art.get(`building.${type}`);
      if (img) ctx.drawImage(img, c.x - 26, py + 4, 52, 52 * (img.naturalHeight / img.naturalWidth || 1.33));
      ctx.fillStyle = COL.graphite;
      ctx.font = `800 12px ${FONT_NUM}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(244,247,247,0.92)';
      ctx.fillRect(c.x - 24, py + 54, 48, 16);
      ctx.fillStyle = COL.cobalt;
      ctx.fillText(`⚡${PICKER_COST[type]}`, c.x, py + 63);
      ctx.textAlign = 'left';
    });
    ctx.restore();
  }
}

function drawChip(ctx: CanvasRenderingContext2D, c: { text: string; x: number; y: number; t0: number; pressT: number }, now: number): void {
  const k = ease.out(Math.min(1, (now - c.t0) / 0.2));
  const press = now - c.pressT < 0.2 ? 0.92 : 1;
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.scale(k * press, k * press);
  ctx.font = `700 15px ${FONT}`;
  const w = ctx.measureText(tr(c.text)).width + 30;
  ctx.fillStyle = 'rgba(11,17,23,0.25)';
  cutRect(ctx, -w / 2 + 2, -18 + 4, w, 36, 9, 9);
  ctx.fill();
  ctx.fillStyle = COL.coralInk;
  cutRect(ctx, -w / 2, -18, w, 36, 9, 9);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tr(c.text), 0, 1);
  ctx.restore();
}

function drawCard(ctx: CanvasRenderingContext2D, s: Stage, c: NonNullable<Stage['card']>, now: number): void {
  const k = ease.out(Math.min(1, (now - c.t0) / 0.3));
  const w = Math.min(s.width - 40, 300);
  const h = c.sub ? 92 : 74;
  const x = s.width / 2;
  const y = s.boardY + 52;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k);
  ctx.globalAlpha = k;
  ctx.fillStyle = 'rgba(11,17,23,0.3)';
  cutRect(ctx, -w / 2 + 2, -h / 2 + 5, w, h, 12, 12);
  ctx.fill();
  ctx.fillStyle = COL.paper;
  cutRect(ctx, -w / 2, -h / 2, w, h, 12, 12);
  ctx.fill();
  ctx.strokeStyle = c.color;
  ctx.lineWidth = 2;
  cutRect(ctx, -w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 9, 9);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = COL.deep;
  ctx.font = `700 10px ${FONT_NUM}`;
  ctx.fillText(tr(c.caps), 0, -h / 2 + 22);
  ctx.fillStyle = c.color;
  ctx.font = `900 19px ${FONT_NUM}`;
  ctx.fillText(tr(c.title), 0, -h / 2 + 48);
  if (c.sub) {
    ctx.fillStyle = COL.graphite;
    ctx.font = `700 12px ${FONT_NUM}`;
    ctx.fillText(tr(c.sub), 0, -h / 2 + 72);
  }
  ctx.restore();
}

function drawFinger(ctx: CanvasRenderingContext2D, s: Stage, now: number): void {
  const f = s.finger;
  // swipe trail
  if (f.down && f.visible) f.trail.push({ x: f.x, y: f.y, t: now });
  f.trail = f.trail.filter((p) => now - p.t < 0.45 && now >= p.t);
  if (f.trail.length > 1) {
    for (let i = 1; i < f.trail.length; i++) {
      const a = f.trail[i - 1];
      const b = f.trail[i];
      ctx.strokeStyle = `rgba(159,244,255,${0.8 * (1 - (now - b.t) / 0.45)})`;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  if (!f.visible) return;
  // tap ripple
  const tk = (now - f.tapT) / 0.5;
  if (tk >= 0 && tk <= 1) {
    ctx.strokeStyle = `rgba(255,255,255,${1 - tk})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(f.x, f.y, 14 + tk * 26, 0, Math.PI * 2);
    ctx.stroke();
  }
  // hold progress
  if (f.holdT > 0 && now >= f.holdT) {
    const hk = Math.min(1, (now - f.holdT) / f.holdLen);
    ctx.strokeStyle = COL.amber;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(f.x, f.y, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hk);
    ctx.stroke();
  }
  const r = f.down ? 13 : 16;
  ctx.fillStyle = 'rgba(11,17,23,0.25)';
  ctx.beginPath();
  ctx.arc(f.x + 2, f.y + 4, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.beginPath();
  ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COL.teal;
  ctx.lineWidth = 3;
  ctx.stroke();
}

export function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// =================================================================== player

export interface ClipDef {
  cols: number;
  rows: number;
  hud?: boolean;
  dock?: boolean;
  /** Seconds before the loop restarts (the last frame holds for the remainder). */
  length: number;
  script(s: Stage, tl: Timeline): void;
}

export interface ClipPlayerOptions {
  loop?: boolean;
  /** Called on every caption change (for screen readers or an external subtitle line). */
  onCaption?: (text: string) => void;
  onEnd?: () => void;
}

/**
 * Plays one clip into `host`: a canvas plus a caption line. Pauses when off screen
 * or when the tab is hidden; `destroy()` stops it.
 */
export class ClipPlayer {
  readonly el: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cap: HTMLDivElement;
  private bar: HTMLDivElement;
  private stage!: Stage;
  private tl!: Timeline;
  private clock = 0;
  private last = 0;
  private raf = 0;
  private visible = true;
  private paused = false;
  private io?: IntersectionObserver;
  private ro?: ResizeObserver;
  private capKey = '';

  constructor(
    host: HTMLElement,
    readonly def: ClipDef,
    private opts: ClipPlayerOptions = {},
  ) {
    this.el = document.createElement('div');
    this.el.className = 'psl-clip';
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    this.cap = document.createElement('div');
    this.cap.className = def.dock ? 'psl-clip-cap top' : 'psl-clip-cap';
    this.cap.setAttribute('aria-live', 'polite');
    this.bar = document.createElement('div');
    this.bar.className = 'psl-clip-bar';
    this.el.append(this.canvas, this.cap, this.bar);
    host.append(this.el);
    this.reset();
    this.canvas.style.aspectRatio = `${this.stage.width} / ${this.stage.height}`;
    this.el.addEventListener('click', () => (this.paused ? this.resume() : this.restart()));
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.el);
    this.io = new IntersectionObserver((e) => (this.visible = e[0]?.isIntersecting ?? true));
    this.io.observe(this.el);
    this.resize();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  restart(): void {
    this.reset();
    this.paused = false;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    this.last = performance.now();
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.io?.disconnect();
    this.ro?.disconnect();
    this.el.remove();
  }

  private reset(): void {
    this.tl = new Timeline();
    this.stage = new Stage(this.def.cols, this.def.rows, this.tl, { hud: this.def.hud, dock: this.def.dock });
    if (this.def.hud) this.stage.hud = { energy: 80, bumpT: -9, threat: 0, frac: 0.15, threatBumpT: -9 };
    if (this.def.dock) this.stage.dock = { active: 'dig', picker: false, sel: null, t0: 0 };
    this.def.script(this.stage, this.tl);
    this.tl.items.sort((a, b) => a.t - b.t);
    this.clock = 0;
    this.capKey = '';
    this.setCaption('');
  }

  private resize(): void {
    const w = this.el.clientWidth || this.stage.width;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const scale = (w / this.stage.width) * dpr;
    this.canvas.width = Math.round(this.stage.width * scale);
    this.canvas.height = Math.round(this.stage.height * scale);
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }

  private setCaption(key: string): void {
    const text = key ? tr(key) : '';
    this.cap.textContent = text;
    this.cap.classList.toggle('on', !!text);
    if (text) this.opts.onCaption?.(text);
  }

  private tick = (ms: number): void => {
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(0.1, (ms - this.last) / 1000);
    this.last = ms;
    if (!this.visible || document.hidden) return;
    if (!this.paused) this.clock += dt;
    const now = this.clock;
    // run due events and live tweens in start order
    const items = this.tl.items;
    for (let i = 0; i < items.length; i++) {
      const it = items[i] as (typeof items)[number] & { done?: boolean };
      if (it.t > now) break;
      if (it.done) continue;
      if (it.d === 0) {
        it.fn(1);
        it.done = true;
      } else {
        const k = Math.min(1, (now - it.t) / it.d);
        it.fn(it.ease(k));
        if (k >= 1) it.done = true;
      }
    }
    if (this.stage.cap.key !== this.capKey) {
      this.capKey = this.stage.cap.key;
      this.setCaption(this.capKey);
    }
    render(this.ctx, this.stage, now);
    this.bar.style.transform = `scaleX(${Math.min(1, now / this.def.length)})`;
    if (now >= this.def.length) {
      this.opts.onEnd?.();
      if (this.opts.loop === false) this.paused = true;
      else this.reset();
    }
  };
}
