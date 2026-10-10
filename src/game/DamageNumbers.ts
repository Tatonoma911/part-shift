import Phaser from 'phaser';
import elementsJson from '../data/design/elements.json';
import { hasText, lang, t } from '../i18n';
import { comfort } from './comfort';
import { CELL, LANDSCAPE } from './layout';
import { TXT } from './ui';

/**
 * Floating damage numbers over units (Антон 2026-10-10, design/ELEMENTS.md «цвет цифры урона по стихии»).
 * Board layer, so pixel style: a 5×7 pixel font drawn at boot (white body with a grey lower half and a
 * black outline; the tint gives the element colour, the outline stays black).
 *
 * Reading a fight: colour = the attack's element (elements.json techs[].color); size = the multiplier:
 * ×2 big with a pop and «!», ×0.75 a bit smaller, ×0.5 small and greyed. A hit on OUR unit carries «−»,
 * a heal is green with «+». Overlap: hits on one target within MERGE_MS add up into one number, burn and
 * poison ticks add up per target, numbers that would land on each other step up, and at most CAP live
 * at once (the oldest leave first). Sizes are kept constant on screen whatever the board zoom.
 */

export type Tech = 'thermo' | 'cryo' | 'volt' | 'toxin' | 'impact' | 'kinetic';

export interface DamageHit {
  /** Board tile coordinates of the target (fractional for walking units). */
  x: number;
  y: number;
  amount: number;
  /** Target id, for merging and stacking; buildings and nests may pass any stable key. */
  target?: number | string;
  tech?: Tech | string;
  /** Element multiplier applied (elements.json multipliers: 2, 1, 0.75, 0.5). */
  mult?: number;
  /** The target is ours: shown with «−». */
  ally?: boolean;
  heal?: boolean;
  /** Burn / poison tick: small, summed per target. */
  dot?: boolean;
  /** Super-strike: a big «БАМ» with the number. */
  super?: boolean;
}

const E = elementsJson as unknown as { techs: { id: string; color: string }[]; reactions?: { id: string; name_ru?: string; hitTech?: string }[] };
const COLOR: Record<string, number> = Object.fromEntries(E.techs.map((x) => [x.id, parseInt(x.color.slice(1), 16)]));
const HEAL = 0x6dffa0;
const GREY = 0x8d99a3;

const FONT = 'dmg.font';
const CHARS = '0123456789+-!xБАМBAM ';
const P = 4; // one font pixel in texture pixels
const GW = 5;
const GH = 7;
const CW = (GW + 2) * P; // cell with the 1-pixel outline on each side
const CH = (GH + 2) * P;
const GLYPHS: Record<string, string[]> = {
  '0': ['01110', '11011', '11011', '11011', '11011', '11011', '01110'],
  '1': ['00110', '01110', '11110', '00110', '00110', '00110', '11111'],
  '2': ['01110', '11011', '00011', '00110', '01100', '11000', '11111'],
  '3': ['11110', '00011', '00011', '01110', '00011', '00011', '11110'],
  '4': ['00110', '01110', '11010', '11010', '11111', '00010', '00010'],
  '5': ['11111', '11000', '11110', '00011', '00011', '11011', '01110'],
  '6': ['01110', '11000', '11110', '11011', '11011', '11011', '01110'],
  '7': ['11111', '00011', '00110', '00110', '01100', '01100', '01100'],
  '8': ['01110', '11011', '11011', '01110', '11011', '11011', '01110'],
  '9': ['01110', '11011', '11011', '01111', '00011', '00011', '01110'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '!': ['00110', '00110', '00110', '00110', '00110', '00000', '00110'],
  x: ['00000', '00000', '11011', '01110', '00100', '01110', '11011'],
  Б: ['11111', '11000', '11110', '11011', '11011', '11011', '11110'],
  А: ['01110', '11011', '11011', '11111', '11011', '11011', '11011'],
  М: ['10001', '11011', '11111', '10101', '10001', '10001', '10001'],
  B: ['11110', '11011', '11011', '11110', '11011', '11011', '11110'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};
GLYPHS.A = GLYPHS['А'];
GLYPHS.M = GLYPHS['М'];

/** Builds the pixel font once per game (canvas texture + RetroFont data). */
export function ensureDamageFont(scene: Phaser.Scene): void {
  if (scene.cache.bitmapFont.exists(FONT)) return;
  const tex = scene.textures.createCanvas(FONT, CW * CHARS.length, CH)!;
  const ctx = tex.getContext();
  [...CHARS].forEach((ch, i) => {
    const rows = GLYPHS[ch];
    const ox = i * CW + P;
    const on = (gx: number, gy: number) => rows[gy]?.[gx] === '1';
    ctx.fillStyle = '#0b1117';
    for (let gy = -1; gy <= GH; gy++)
      for (let gx = -1; gx <= GW; gx++) {
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) near = on(gx + dx, gy + dy);
        if (near) ctx.fillRect(ox + gx * P, P + gy * P, P, P);
      }
    for (let gy = 0; gy < GH; gy++)
      for (let gx = 0; gx < GW; gx++) {
        if (!on(gx, gy)) continue;
        ctx.fillStyle = gy < 4 ? '#ffffff' : '#c9c9c9';
        ctx.fillRect(ox + gx * P, P + gy * P, P, P);
      }
  });
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  const data = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: FONT,
    width: CW,
    height: CH,
    chars: CHARS,
    charsPerRow: CHARS.length,
    'offset.x': 0,
    'offset.y': 0,
    'spacing.x': 0,
    'spacing.y': 0,
    lineSpacing: 0,
  } as unknown as Phaser.Types.GameObjects.BitmapText.RetroFontConfig);
  scene.cache.bitmapFont.add(FONT, data);
}

interface Live {
  txt: Phaser.GameObjects.BitmapText;
  key: string;
  target?: number | string;
  born: number;
  life: number;
  sum: number;
  size: number;
  /** Start point in board-world px and the step-up offset. */
  x: number;
  y: number;
  lift: number;
  pop: number;
  prefix: string;
  suffix: string;
  peak: number;
  dying: boolean;
}

/** config.combat.damageNumbers: hits within 0.15 s merge; a number lives 0.6 s. */
const MERGE_MS = 150;
const DOT_MS = 600;
const LIFE_MS = 1500;
const CAP = LANDSCAPE ? 22 : 14;
/** Screen height of a normal number (px of the 780/1600 canvas). */
const BASE_H = LANDSCAPE ? 22 : 30;

export class DamageNumbers {
  private live: Live[] = [];
  private pool: Phaser.GameObjects.BitmapText[] = [];
  private labels: Phaser.GameObjects.Container[] = [];
  private pending = new Map<string, number>();

  /**
   * @param center tile → board-world px (BoardView.center)
   * @param cam the board camera, for zoom-independent size
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly center: (x: number, y: number) => { x: number; y: number },
    private readonly cam: Phaser.Cameras.Scene2D.Camera,
    private readonly depth = 16,
  ) {
    ensureDamageFont(scene);
  }

  push(h: DamageHit): void {
    let amount = h.dot ? h.amount : Math.round(h.amount);
    if (!(amount > 0)) return;
    const now = this.scene.time.now;
    const tech = h.heal ? 'heal' : String(h.tech ?? 'kinetic');
    const mult = h.heal || h.dot ? 1 : h.mult ?? 1;
    const key = `${h.target ?? `${h.x},${h.y}`}|${tech}|${h.super ? 's' : h.dot ? 'd' : mult}|${h.ally ? 'a' : 'e'}`;
    const window = h.dot ? DOT_MS : MERGE_MS;
    const same = this.live.find((l) => !l.dying && l.key === key && now - l.born < window);
    if (same) {
      same.sum += amount;
      if (!h.dot) same.pop = now;
      this.setText(same);
      return;
    }
    if (h.dot) {
      // Ticks come every frame in fractions: the number appears once a whole point has gathered.
      amount += this.pending.get(key) ?? 0;
      if (amount < 1) {
        this.pending.set(key, amount);
        return;
      }
      this.pending.delete(key);
    }
    const size = h.super ? 2.2 : h.dot ? 0.7 : mult >= 1.5 ? 1.8 : mult <= 0.55 ? 0.72 : mult < 1 ? 0.88 : 1;
    let color = h.heal ? HEAL : COLOR[tech] ?? 0xffffff;
    if (!h.heal && mult <= 0.55) color = mix(color, GREY, 0.55);
    const c = this.center(h.x, h.y);
    const txt = this.pool.pop() ?? this.scene.add.bitmapText(0, 0, FONT, '').setOrigin(0.5, 1);
    txt.setActive(true).setVisible(true).setDepth(this.depth + (size > 1 ? 0.2 : 0)).setTint(color).setAlpha(mult <= 0.55 ? 0.82 : 1);
    const l: Live = {
      txt,
      key,
      target: h.target,
      born: now,
      life: size > 1 ? 2000 : LIFE_MS,
      sum: amount,
      size,
      x: c.x + (Math.random() - 0.5) * CELL * 0.25,
      y: c.y - CELL * 0.5,
      lift: 0,
      pop: now,
      prefix: h.super ? `${bam()} ` : h.heal ? '+' : h.ally ? '-' : '',
      suffix: size > 1 ? '!' : '',
      peak: h.super ? 0.7 : 0.5,
      dying: false,
    };
    this.setText(l);
    this.place(l);
    txt.setScale(((BASE_H / CH) * l.size) / this.cam.zoom).setPosition(Math.round(l.x), Math.round(l.y - l.lift / this.cam.zoom));
    this.live.push(l);
    let extra = this.live.filter((x) => !x.dying).length - CAP;
    for (const old of this.live) {
      if (extra <= 0) break;
      if (old === l || old.dying) continue;
      old.dying = true;
      old.life = Math.min(old.life, now - old.born + 140);
      extra--;
    }
  }

  /** Element reaction name under the target («Паровой взрыв»; the numbers go up, the name stays below), strings reaction.<id>. */
  reaction(x: number, y: number, id: string, tech?: string): void {
    const name = hasText(`reaction.${id}`) ? t(`reaction.${id}`) : E.reactions?.find((r) => r.id === id)?.name_ru ?? id;
    const c = this.center(x, y);
    const z = 1 / this.cam.zoom;
    const col = COLOR[tech ?? E.reactions?.find((r) => r.id === id)?.hitTech ?? 'kinetic'] ?? 0xffffff;
    const label = this.scene.add.text(0, 0, name.toUpperCase(), { ...TXT.caps(`#${col.toString(16).padStart(6, '0')}`), fontSize: LANDSCAPE ? '15px' : '19px' }).setOrigin(0.5);
    const g = this.scene.add.graphics();
    const w = label.width + 22;
    const h = label.height + 10;
    g.fillStyle(0x0b1117, 0.86);
    g.fillRect(-w / 2, -h / 2, w, h);
    g.fillStyle(col, 1);
    g.fillRect(-w / 2, h / 2 - 3, w, 3);
    const box = this.scene.add.container(c.x, c.y + CELL * 0.62, [g, label]).setDepth(this.depth + 0.4).setScale(z * 0.6).setAlpha(0);
    this.labels.push(box);
    const calm = comfort().calm;
    this.scene.tweens.add({ targets: box, alpha: 1, scale: z, duration: calm ? 1 : 160, ease: 'Back.out' });
    this.scene.tweens.add({
      targets: box,
      alpha: 0,
      delay: 900,
      duration: 260,
      onComplete: () => {
        this.labels = this.labels.filter((b) => b !== box);
        box.destroy();
      },
    });
  }

  update(now: number): void {
    const z = 1 / this.cam.zoom;
    const unit = (BASE_H / CH) * z;
    const calm = comfort().calm;
    for (const l of this.live) {
      const age = now - l.born;
      const k = Math.min(1, age / l.life);
      const rise = (1 - (1 - k) ** 3) * 34 * z;
      const sincePop = now - l.pop;
      const pop = calm ? 1 : sincePop < 80 ? 1 + l.peak * (sincePop / 80) : sincePop < 200 ? 1 + l.peak - l.peak * ((sincePop - 80) / 120) : 1;
      const popScale = l.size > 1 || sincePop !== now - l.born ? pop : 1 + (pop - 1) * 0.4;
      l.txt.setScale(unit * l.size * popScale);
      l.txt.setPosition(Math.round(l.x), Math.round(l.y - l.lift * z - rise));
      if (k > 0.7) l.txt.setAlpha((l.size <= 0.75 ? 0.82 : 1) * (1 - (k - 0.7) / 0.3));
    }
    for (const l of this.live) if (now - l.born >= l.life) this.free(l);
    this.live = this.live.filter((l) => now - l.born < l.life);
  }

  destroy(): void {
    for (const l of this.live) l.txt.destroy();
    for (const p of this.pool) p.destroy();
    for (const b of this.labels) b.destroy();
    this.live = [];
    this.pool = [];
  }

  private setText(l: Live): void {
    l.txt.setText(`${l.prefix}${Math.round(l.sum)}${l.suffix}`);
    l.txt.setLetterSpacing(-P);
  }

  /** Steps a new number up (and a little aside) while its box would overlap a live one. */
  private place(l: Live): void {
    const z = 1 / this.cam.zoom;
    const scale = (BASE_H / CH) * l.size * z;
    const w = l.txt.width * scale;
    const h = BASE_H * l.size * z;
    const x0 = l.x;
    for (let step = 0; step < 6; step++) {
      const y = l.y - l.lift * z;
      const hit = this.live.some((o) => {
        if (o.dying) return false;
        const ow = o.txt.displayWidth;
        const oh = o.txt.displayHeight * 0.8;
        return Math.abs(o.txt.x - l.x) < (ow + w) / 2 - 4 * z && y > o.txt.y - oh && y - h * 0.8 < o.txt.y;
      });
      if (!hit) return;
      l.lift += BASE_H * 0.8;
      l.x = x0 + (step % 2 ? -1 : 1) * w * 0.3;
    }
  }

  private free(l: Live): void {
    l.txt.setVisible(false).setActive(false).setAlpha(1);
    this.pool.push(l.txt);
  }
}

function mix(a: number, b: number, k: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** «БАМ» of the super-strike in the pixel font (strings fx.bam when the writer adds it; EN «BAM»). */
function bam(): string {
  const word = hasText('fx.bam') ? t('fx.bam') : lang === 'en' ? 'BAM' : 'БАМ';
  return [...word.toUpperCase()].filter((c) => CHARS.includes(c)).join('') || 'БАМ';
}
