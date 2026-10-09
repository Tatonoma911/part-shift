import Phaser from 'phaser';
import { C, FONT, FONT_NUM, INK } from './layout';

type G = Phaser.GameObjects.Graphics;

/** Polygon of a rectangle with cut corners: [top-left, top-right, bottom-right, bottom-left]. */
function cutRect(x: number, y: number, w: number, h: number, cut: [number, number, number, number]): Phaser.Math.Vector2[] {
  const [a, b, c, d] = cut;
  const V = Phaser.Math.Vector2;
  return [new V(x + a, y), new V(x + w - b, y), new V(x + w, y + b), new V(x + w, y + h - c), new V(x + w - c, y + h), new V(x + d, y + h), new V(x, y + h - d), new V(x, y + a)];
}

/** Ceramic plate: white body, corners cut, thin cyan seam inside (BRAND_UI "Форма"). */
export function plate(g: G, x: number, y: number, w: number, h: number, cut = 24, alpha = 1): void {
  g.fillStyle(0x0b1117, 0.12 * alpha);
  g.fillPoints(cutRect(x + 2, y + 6, w, h, [cut, cut, cut, cut]), true);
  g.fillStyle(C.paper, alpha);
  g.fillPoints(cutRect(x, y, w, h, [cut, cut, cut, cut]), true);
  g.lineStyle(2, C.seam, 0.9 * alpha);
  g.strokePoints(cutRect(x + 6, y + 6, w - 12, h - 12, [cut - 4, cut - 4, cut - 4, cut - 4]), true);
}

/** Button or card: top-left and bottom-right corners cut. */
export function chip(g: G, x: number, y: number, w: number, h: number, fill: number, alpha = 1, cut = 16, stroke?: { color: number; width: number; alpha?: number }): void {
  const pts = cutRect(x, y, w, h, [cut, 0, cut, 0]);
  g.fillStyle(fill, alpha);
  g.fillPoints(pts, true);
  if (stroke) {
    g.lineStyle(stroke.width, stroke.color, stroke.alpha ?? 1);
    g.strokePoints(pts, true);
  }
}

/** Four deep-blue corner brackets around the board instead of a frame. */
export function brackets(g: G, x: number, y: number, w: number, h: number, len = 28): void {
  g.lineStyle(5, C.deep, 1);
  const s = (pts: number[][]) => g.strokePoints(pts.map(([px, py]) => new Phaser.Math.Vector2(px, py)), false);
  s([[x, y + len], [x, y], [x + len, y]]);
  s([[x + w - len, y], [x + w, y], [x + w, y + len]]);
  s([[x + w, y + h - len], [x + w, y + h], [x + w - len, y + h]]);
  s([[x + len, y + h], [x, y + h], [x, y + h - len]]);
}

export const TXT = {
  caps: (color = INK.deep): Phaser.Types.GameObjects.Text.TextStyle => ({ fontFamily: FONT_NUM, fontStyle: '700', fontSize: '17px', color, letterSpacing: 2.4 } as Phaser.Types.GameObjects.Text.TextStyle),
  num: (size: number, color = INK.graphite): Phaser.Types.GameObjects.Text.TextStyle => ({ fontFamily: FONT_NUM, fontStyle: '800', fontSize: `${size}px`, color }),
  body: (size: number, color = INK.graphite, weight = '500'): Phaser.Types.GameObjects.Text.TextStyle => ({ fontFamily: FONT, fontStyle: weight, fontSize: `${size}px`, color }),
};

/** Small channel glyphs that repeat the clue color (UI_SPEC §3.2): ▲ nests, ◆ finds, hexagon Demon. */
export function glyph(g: G, kind: 'threat' | 'finds' | 'demon', x: number, y: number, r: number, color: number): void {
  g.fillStyle(color, 1);
  if (kind === 'threat') g.fillTriangle(x, y - r, x + r, y + r * 0.8, x - r, y + r * 0.8);
  else if (kind === 'finds') g.fillPoints([new Phaser.Math.Vector2(x, y - r), new Phaser.Math.Vector2(x + r, y), new Phaser.Math.Vector2(x, y + r), new Phaser.Math.Vector2(x - r, y)], true);
  else {
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 6; i++) pts.push(new Phaser.Math.Vector2(x + r * Math.cos((Math.PI / 3) * i), y + r * Math.sin((Math.PI / 3) * i)));
    g.fillPoints(pts, true);
  }
}

/** Waits for the brand fonts so the first frame doesn't measure fallback glyphs. */
export async function fontsReady(): Promise<void> {
  if (!document.fonts) return;
  const want = ['800 30px Unbounded', '700 17px Unbounded', '500 24px "Golos Text"', '700 24px "Golos Text"'];
  await Promise.race([Promise.all(want.map((f) => document.fonts.load(f, 'АБВ123'))), new Promise((r) => setTimeout(r, 2500))]).catch(() => undefined);
}
