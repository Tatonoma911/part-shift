import Phaser from 'phaser';
import { C } from './layout';

/**
 * Icons for the small menu row «Рейтинг / Позвать / Отзыв / Кофе» (AR-21).
 * System emoji look different on every phone and break the brand, so the row
 * draws these instead. The Художник's comic icons (pack item 128_ui_menu_icons,
 * loaded as `icon.menu_<id>`) replace the vector fallback as soon as they exist.
 */
export type MenuIconId = 'leaderboard' | 'invite' | 'feedback' | 'coffee';

const V = (x: number, y: number) => new Phaser.Math.Vector2(x, y);

/** Draws the icon centred at x,y inside a size×size box. Returns what it created. */
export function menuIcon(scene: Phaser.Scene, x: number, y: number, size: number, id: MenuIconId): Phaser.GameObjects.GameObject[] {
  const key = `icon.menu_${id}`;
  if (scene.textures.exists(key)) {
    const img = scene.add.image(x, y, key);
    img.setScale(size / Math.max(img.width, img.height));
    return [img];
  }
  const g = scene.add.graphics();
  const s = size / 2;
  const ink = C.graphite;
  const line = Math.max(2, size * 0.075);
  g.lineStyle(line, ink, 1);
  switch (id) {
    case 'leaderboard': {
      // Podium with a star on top: the best shift, not a generic cup.
      g.fillStyle(C.seam, 1);
      g.fillRect(x - s * 0.3, y - s * 0.05, s * 0.6, s * 0.95);
      g.fillStyle(C.white, 1);
      g.fillRect(x - s * 0.9, y + s * 0.25, s * 0.6, s * 0.65);
      g.fillRect(x + s * 0.3, y + s * 0.45, s * 0.6, s * 0.45);
      g.strokeRect(x - s * 0.3, y - s * 0.05, s * 0.6, s * 0.95);
      g.strokeRect(x - s * 0.9, y + s * 0.25, s * 0.6, s * 0.65);
      g.strokeRect(x + s * 0.3, y + s * 0.45, s * 0.6, s * 0.45);
      const star: Phaser.Math.Vector2[] = [];
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (Math.PI / 5) * k;
        const r = k % 2 ? s * 0.17 : s * 0.38;
        star.push(V(x + Math.cos(a) * r, y - s * 0.5 + Math.sin(a) * r));
      }
      g.fillStyle(C.amber, 1);
      g.fillPoints(star, true);
      g.strokePoints(star, true);
      break;
    }
    case 'invite': {
      // HeroOut walkie-talkie calling a friend.
      g.fillStyle(C.white, 1);
      g.fillRoundedRect(x - s * 0.55, y - s * 0.4, s * 0.8, s * 1.3, s * 0.14);
      g.strokeRoundedRect(x - s * 0.55, y - s * 0.4, s * 0.8, s * 1.3, s * 0.14);
      g.lineBetween(x - s * 0.35, y - s * 0.4, x - s * 0.35, y - s * 0.95);
      g.fillStyle(C.seam, 1);
      g.fillRect(x - s * 0.4, y - s * 0.25, s * 0.5, s * 0.35);
      g.strokeRect(x - s * 0.4, y - s * 0.25, s * 0.5, s * 0.35);
      g.fillStyle(ink, 1);
      for (const dy of [0.32, 0.52, 0.72]) g.fillRect(x - s * 0.38, y + s * dy, s * 0.46, line * 0.7);
      g.lineStyle(line, C.teal, 1);
      for (const r of [0.35, 0.6]) {
        g.beginPath();
        g.arc(x + s * 0.3, y - s * 0.15, s * r, -Math.PI * 0.32, Math.PI * 0.32);
        g.strokePath();
      }
      break;
    }
    case 'feedback': {
      // Complaint form on a clipboard with a pencil.
      g.fillStyle(C.white, 1);
      g.fillRoundedRect(x - s * 0.7, y - s * 0.75, s * 1.15, s * 1.6, s * 0.1);
      g.strokeRoundedRect(x - s * 0.7, y - s * 0.75, s * 1.15, s * 1.6, s * 0.1);
      g.fillStyle(C.seam, 1);
      g.fillRect(x - s * 0.38, y - s * 0.9, s * 0.5, s * 0.3);
      g.strokeRect(x - s * 0.38, y - s * 0.9, s * 0.5, s * 0.3);
      g.lineStyle(line * 0.8, ink, 1);
      for (const dy of [-0.3, 0, 0.3]) g.lineBetween(x - s * 0.5, y + s * dy, x + s * 0.2, y + s * dy);
      // Pencil across the corner.
      const p = [V(x + s * 0.2, y + s * 0.75), V(x + s * 0.85, y + s * 0.1), V(x + s * 1.0, y + s * 0.25), V(x + s * 0.35, y + s * 0.9)];
      g.fillStyle(C.amber, 1);
      g.fillPoints(p, true);
      g.lineStyle(line, ink, 1);
      g.strokePoints(p, true);
      g.fillStyle(ink, 1);
      g.fillTriangle(x + s * 0.2, y + s * 0.75, x + s * 0.35, y + s * 0.9, x + s * 0.1, y + s * 1.0);
      break;
    }
    case 'coffee': {
      // Paper cup with the cyan HeroOut sleeve and steam.
      const cup = [V(x - s * 0.55, y - s * 0.3), V(x + s * 0.55, y - s * 0.3), V(x + s * 0.4, y + s * 0.9), V(x - s * 0.4, y + s * 0.9)];
      g.fillStyle(C.white, 1);
      g.fillPoints(cup, true);
      g.fillStyle(C.seam, 1);
      g.fillPoints([V(x - s * 0.5, y + s * 0.1), V(x + s * 0.5, y + s * 0.1), V(x + s * 0.45, y + s * 0.5), V(x - s * 0.45, y + s * 0.5)], true);
      g.strokePoints(cup, true);
      g.fillStyle(C.white, 1);
      g.fillRoundedRect(x - s * 0.65, y - s * 0.48, s * 1.3, s * 0.2, s * 0.06);
      g.strokeRoundedRect(x - s * 0.65, y - s * 0.48, s * 1.3, s * 0.2, s * 0.06);
      g.lineStyle(line * 0.8, ink, 1);
      for (const dx of [-0.2, 0.15]) {
        g.beginPath();
        g.moveTo(x + s * dx, y - s * 0.6);
        g.lineTo(x + s * (dx + 0.12), y - s * 0.75);
        g.lineTo(x + s * dx, y - s * 0.9);
        g.lineTo(x + s * (dx + 0.12), y - s * 1.0);
        g.strokePath();
      }
      break;
    }
  }
  return [g];
}
