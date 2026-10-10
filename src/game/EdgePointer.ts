import Phaser from 'phaser';
import type { World } from '../core/world';
import { UI_DEPTH } from './cameras';
import { calmFx } from './comfort';
import { C, FONT_NUM } from './layout';

/**
 * Enemies outside the board camera's view (UI_SPEC §4.5): a danger-coloured
 * capsule at the nearest edge with an arrow toward them and their count,
 * one capsule per side. Matters when the player has zoomed in.
 */
type Side = 'top' | 'bottom' | 'left' | 'right';
const SIDES: Side[] = ['top', 'bottom', 'left', 'right'];
const MARGIN = 34;

export class EdgePointer {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly labels = new Map<Side, Phaser.GameObjects.Text>();

  constructor(
    scene: Phaser.Scene,
    private readonly world: World,
    private readonly cam: Phaser.Cameras.Scene2D.Camera,
    /** Board pixel center of a cell position (BoardView.center). */
    private readonly center: (x: number, y: number) => { x: number; y: number },
  ) {
    this.g = scene.add.graphics().setDepth(UI_DEPTH + 0.5);
    for (const s of SIDES) {
      this.labels.set(
        s,
        scene.add
          .text(0, 0, '', { fontFamily: FONT_NUM, fontStyle: '800', fontSize: '24px', color: '#FFFFFF' })
          .setOrigin(0.5)
          .setDepth(UI_DEPTH + 0.6)
          .setVisible(false),
      );
    }
  }

  update(now: number): void {
    const g = this.g;
    g.clear();
    const cam = this.cam;
    const view = cam.worldView;
    const groups = new Map<Side, { n: number; sx: number; sy: number }>();
    for (const u of this.world.s.units) {
      if (u.owner >= 0 || u.hp <= 0) continue;
      const p = this.center(u.x, u.y);
      if (Phaser.Geom.Rectangle.Contains(view, p.x, p.y)) continue;
      // Screen position of the unit relative to the board camera rectangle.
      const sx = cam.x + (p.x - view.x) * cam.zoom;
      const sy = cam.y + (p.y - view.y) * cam.zoom;
      const dx = (p.x - view.centerX) / view.width;
      const dy = (p.y - view.centerY) / view.height;
      const side: Side = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'bottom' : 'top';
      const gr = groups.get(side) ?? { n: 0, sx: 0, sy: 0 };
      gr.n++;
      gr.sx += sx;
      gr.sy += sy;
      groups.set(side, gr);
    }
    const bob = calmFx() ? 0 : Math.sin(now / 180) * 4;
    for (const side of SIDES) {
      const label = this.labels.get(side)!;
      const gr = groups.get(side);
      if (!gr) {
        label.setVisible(false);
        continue;
      }
      const left = cam.x + MARGIN + 30;
      const right = cam.x + cam.width - MARGIN - 30;
      const top = cam.y + MARGIN;
      const bottom = cam.y + cam.height - MARGIN;
      let x = Phaser.Math.Clamp(gr.sx / gr.n, left, right);
      let y = Phaser.Math.Clamp(gr.sy / gr.n, top + 20, bottom - 20);
      if (side === 'top') y = top + bob;
      if (side === 'bottom') y = bottom - bob;
      if (side === 'left') x = cam.x + MARGIN + 18 + bob;
      if (side === 'right') x = cam.x + cam.width - MARGIN - 18 - bob;
      // Capsule with the count and an arrow pointing out of the view.
      const w = 84;
      const h = 44;
      g.fillStyle(0x0b1117, 0.35);
      g.fillRoundedRect(x - w / 2 + 2, y - h / 2 + 4, w, h, h / 2);
      g.fillStyle(C.coral, 1);
      g.fillRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
      const a = { top: -Math.PI / 2, bottom: Math.PI / 2, left: Math.PI, right: 0 }[side];
      const ax = x + Math.cos(a) * (side === 'left' || side === 'right' ? w / 2 + 6 : h / 2 + 6);
      const ay = y + Math.sin(a) * (side === 'left' || side === 'right' ? w / 2 + 6 : h / 2 + 6);
      const tip = (r: number, da: number) => ({ x: ax + Math.cos(a + da) * r, y: ay + Math.sin(a + da) * r });
      const p1 = tip(14, 0);
      const p2 = tip(12, (Math.PI * 2) / 3);
      const p3 = tip(12, -(Math.PI * 2) / 3);
      g.fillTriangle(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      // Small enemy triangle glyph, then the number.
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(x - 26, y + 8, x - 14, y + 8, x - 20, y - 6);
      label.setText(String(gr.n)).setPosition(x + 10, y).setVisible(true);
    }
  }
}
