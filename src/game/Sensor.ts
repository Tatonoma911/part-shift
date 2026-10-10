import Phaser from 'phaser';
import { C } from './layout';
import { TXT } from './ui';

/**
 * HeroOut block sensors (MVP_RULES §3.1а, v0.7): every opened block carries a
 * small sign on a post with up to three windows, one per channel, each with a
 * lamp and the count among the 8 neighbours:
 *   red beacon = nests and lairs, violet target = the call target, blue box = caches and warehouses.
 * Empty windows are hidden; a block with no numbers has no sign at all.
 * Also the player's own marks on closed blocks: «Опасно» (red cone) and «Не уверен» (yellow ?).
 * Board layer = pixel art: everything here is whole-pixel rectangles, no smooth curves.
 * When the artist's sprites arrive (pack: sensor plate, lamps, cone, ? sign) they replace these.
 */

export type Channel = 'threat' | 'demon' | 'finds';
export type Clues = Record<Channel, number>;
export type MarkKind = 'danger' | 'unsure';

/** Order on the sign, left to right. */
export const SENSOR_ORDER: Channel[] = ['threat', 'demon', 'finds'];

type G = Phaser.GameObjects.Graphics;

const INKD = 0x0b1117;
const PLATE = 0x1f272c;
const WINDOW = 0x0e1418;

export function lampColor(ch: Channel): number {
  return ch === 'threat' ? C.coral : ch === 'demon' ? C.violet : C.seam;
}

/** Number colour: the lamp colour pushed toward white so it reads on the dark window. */
export function numberCss(ch: Channel): string {
  const c = Phaser.Display.Color.IntegerToColor(lampColor(ch));
  const mix = (v: number) => Math.round(v + (255 - v) * 0.3);
  return Phaser.Display.Color.RGBToString(mix(c.red), mix(c.green), mix(c.blue));
}

/** Pixel lamp icon for one channel, w×h box at (x, y). */
export function drawLamp(g: G, ch: Channel, x: number, y: number, w: number, h: number): void {
  const col = lampColor(ch);
  const cx = Math.round(x + w / 2);
  x = Math.round(x);
  y = Math.round(y);
  if (ch === 'threat') {
    // Beacon: a dome on a base, with a white glint.
    const bw = Math.min(w - 2, 12);
    g.fillStyle(INKD, 1);
    g.fillRect(cx - bw / 2, y + h - 2, bw, 2);
    g.fillStyle(col, 1);
    g.fillRect(cx - bw / 2 + 2, y + 2, bw - 4, h - 4);
    g.fillRect(cx - bw / 2 + 4, y, bw - 8, 2);
    g.fillStyle(0xffffff, 0.9);
    g.fillRect(cx - bw / 2 + 3, y + 2, 2, 2);
  } else if (ch === 'demon') {
    // Target: a square ring with a dot.
    const s = Math.min(w - 2, h, 10);
    const sx = cx - s / 2;
    g.fillStyle(col, 1);
    g.fillRect(sx, y, s, s);
    g.fillStyle(WINDOW, 1);
    g.fillRect(sx + 2, y + 2, s - 4, s - 4);
    g.fillStyle(col, 1);
    g.fillRect(cx - 1, y + s / 2 - 1, 2, 2);
  } else {
    // Box: a crate with a lid line.
    const bw = Math.min(w - 2, 12);
    g.fillStyle(col, 1);
    g.fillRect(cx - bw / 2, y + 1, bw, h - 1);
    g.fillStyle(INKD, 0.55);
    g.fillRect(cx - bw / 2, y + 3, bw, 1);
    g.fillRect(cx - 1, y + 4, 2, h - 4);
  }
}

/**
 * Draws the sign on `g` and positions `texts` (one per SENSOR_ORDER channel).
 * Returns false when there is nothing to show (clean block).
 */
export function drawSensor(g: G, texts: Phaser.GameObjects.Text[], cx: number, cy: number, clues: Clues): boolean {
  const active = SENSOR_ORDER.filter((ch) => clues[ch] > 0);
  const hide = (t: Phaser.GameObjects.Text) => {
    t.setVisible(false);
    (t.getData('lamp') as Phaser.GameObjects.Image | undefined)?.setVisible(false);
  };
  if (!active.length) {
    texts.forEach(hide);
    return false;
  }
  const n = active.length;
  const ww = n === 1 ? 26 : n === 2 ? 20 : 15;
  const wh = 33;
  const gap = 2;
  const pw = n * ww + (n - 1) * gap + 6;
  const ph = wh + 6;
  const px = Math.round(cx - pw / 2);
  const py = Math.round(cy - ph / 2 - 4);
  // Post and its foot.
  g.fillStyle(INKD, 1);
  g.fillRect(cx - 1, py + ph, 3, 8);
  g.fillRect(cx - 5, py + ph + 7, 11, 2);
  // Plate: dark body, outline, top highlight, HeroOut teal strip at the bottom.
  g.fillStyle(INKD, 1);
  g.fillRect(px - 2, py - 2, pw + 4, ph + 4);
  g.fillStyle(PLATE, 1);
  g.fillRect(px, py, pw, ph);
  g.fillStyle(0x3d4a52, 1);
  g.fillRect(px, py, pw, 2);
  g.fillStyle(C.teal, 1);
  g.fillRect(px, py + ph - 2, pw, 2);
  const size = n === 1 ? 22 : n === 2 ? 19 : 16;
  SENSOR_ORDER.forEach((ch, k) => {
    const t = texts[k];
    const slot = active.indexOf(ch);
    if (slot < 0) return hide(t);
    const wx = px + 3 + slot * (ww + gap);
    const wy = py + 3;
    g.fillStyle(WINDOW, 1);
    g.fillRect(wx, wy, ww, wh);
    // The artist's lamp sprite (art/export/icons/lamp_*), or the code lamp until it loads.
    const lamp = t.getData('lamp') as Phaser.GameObjects.Image | undefined;
    if (lamp) lamp.setVisible(true).setPosition(wx + ww / 2, wy + 6).setScale(Math.min(1, (ww - 1) / lamp.width));
    else drawLamp(g, ch, wx, wy + 2, ww, 8);
    t.setVisible(true)
      .setText(String(clues[ch]))
      .setFontSize(size)
      .setColor(numberCss(ch))
      .setPosition(wx + ww / 2, wy + 22);
  });
  return true;
}

/** Text objects for one sign (create once per cell, reuse). */
export function sensorTexts(scene: Phaser.Scene, depth: number): Phaser.GameObjects.Text[] {
  return SENSOR_ORDER.map((ch) => {
    const t = scene.add.text(0, 0, '', { ...TXT.num(20, '#ffffff'), stroke: '#0b1117', strokeThickness: 3 }).setOrigin(0.5).setDepth(depth);
    const key = `icon.lamp_${ch === 'demon' ? 'target' : ch}`;
    if (scene.textures.exists(key)) t.setData('lamp', scene.add.image(0, 0, key).setDepth(depth).setVisible(false));
    return t;
  });
}

/** 5×7 pixel question mark. */
const QMARK = ['01110', '10001', '00001', '00110', '00100', '00000', '00100'];

/** The player's own mark on a closed block (centre cx, cy; cell about 52 px). */
export function drawMark(g: G, cx: number, cy: number, kind: MarkKind): void {
  cx = Math.round(cx);
  cy = Math.round(cy);
  if (kind === 'danger') {
    // Traffic cone: stepped body with two white bands on a dark base.
    g.fillStyle(INKD, 0.45);
    g.fillRect(cx - 14, cy + 15, 30, 4);
    g.fillStyle(INKD, 1);
    g.fillRect(cx - 15, cy + 12, 30, 5);
    g.fillStyle(0x8a2b36, 1);
    g.fillRect(cx - 14, cy + 13, 28, 3);
    const rows = 13;
    for (let r = 0; r < rows; r++) {
      const half = 3 + Math.floor(r * 0.75);
      const y = cy - 14 + r * 2;
      g.fillStyle(INKD, 1);
      g.fillRect(cx - half - 1, y, half * 2 + 2, 2);
      const band = r === 4 || r === 5 || r === 9 || r === 10;
      g.fillStyle(band ? 0xffffff : C.coral, 1);
      g.fillRect(cx - half, y, half * 2, 2);
    }
    g.fillStyle(0xffffff, 0.5);
    g.fillRect(cx - 2, cy - 12, 2, 6);
  } else {
    // Yellow sign with a pixel «?» on a short post.
    g.fillStyle(INKD, 1);
    g.fillRect(cx - 1, cy + 6, 3, 12);
    g.fillRect(cx - 13, cy - 17, 26, 25);
    g.fillStyle(C.amber, 1);
    g.fillRect(cx - 11, cy - 15, 22, 21);
    g.fillStyle(0xffffff, 0.45);
    g.fillRect(cx - 11, cy - 15, 22, 2);
    g.fillStyle(INKD, 1);
    const ps = 3;
    QMARK.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) if (row[rx] === '1') g.fillRect(cx - 7 + rx * ps, cy - 15 + ry * ps, ps, ps);
    });
  }
}
