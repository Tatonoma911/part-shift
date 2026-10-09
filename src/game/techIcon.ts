import Phaser from 'phaser';
import elementsJson from '../data/design/elements.json';

/**
 * Element orb shared by every place that names an element (ui/UI_SPEC.md §3.5):
 * a circle in the element colour from design/data/elements.json with a dark
 * shape inside, so it reads without colour too. Термо ▲, Криогель ✱, Ток ⚡,
 * Токсин ●, Удар ■. A strong weakness (×1.5) gets a thick white ring.
 */
const techs = (elementsJson as unknown as { techs: { id: string; color: string }[] }).techs;
export const TECH_HEX: Record<string, number> = Object.fromEntries(techs.map((t) => [t.id, parseInt(t.color.slice(1), 16)]));

type G = Phaser.GameObjects.Graphics;

export function techGlyph(g: G, tech: string, x: number, y: number, r: number): void {
  g.fillStyle(0x10171c, 0.9);
  g.lineStyle(Math.max(1.5, r * 0.28), 0x10171c, 0.9);
  switch (tech) {
    case 'thermo':
      g.fillTriangle(x, y - r * 0.62, x + r * 0.58, y + r * 0.45, x - r * 0.58, y + r * 0.45);
      break;
    case 'cryo':
      for (let k = 0; k < 3; k++) {
        const a = (Math.PI / 3) * k + Math.PI / 2;
        g.lineBetween(x - Math.cos(a) * r * 0.62, y - Math.sin(a) * r * 0.62, x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62);
      }
      break;
    case 'volt':
      g.fillTriangle(x + r * 0.15, y - r * 0.7, x - r * 0.45, y + r * 0.1, x + r * 0.05, y + r * 0.1);
      g.fillTriangle(x - r * 0.15, y + r * 0.7, x + r * 0.45, y - r * 0.1, x - r * 0.05, y - r * 0.1);
      break;
    case 'toxin':
      g.fillCircle(x, y + r * 0.15, r * 0.42);
      g.fillTriangle(x - r * 0.36, y, x + r * 0.36, y, x, y - r * 0.65);
      break;
    case 'impact':
      g.fillRect(x - r * 0.42, y - r * 0.42, r * 0.84, r * 0.84);
      break;
  }
}

/** One orb centred on (x, y). */
export function techOrb(g: G, tech: string, x: number, y: number, r: number, strong = false): void {
  g.fillStyle(0x0b1117, strong ? 1 : 0.55);
  g.fillCircle(x + 1, y + 2, r + (strong ? 3.5 : 1.5));
  g.fillStyle(TECH_HEX[tech] ?? 0xffffff, 1);
  g.fillCircle(x, y, r);
  g.lineStyle(strong ? 2.5 : 1.5, strong ? 0xffffff : 0x10171c, 1);
  g.strokeCircle(x, y, r);
  techGlyph(g, tech, x, y, r);
}
