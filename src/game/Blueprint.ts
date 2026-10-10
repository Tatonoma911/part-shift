import Phaser from 'phaser';
import { hasText, t } from '../i18n';
import { sound } from './audio';
import { C, INK, VIEW } from './layout';
import { TXT } from './ui';

/**
 * Blueprint puzzle UI (MVP_RULES §5.1): the blue sheet used for buildings that
 * open by fragments (Досье → «Чертежи», the build dock) and the pop-up when a
 * fragment is dug out. UI layer (vector, BRAND_UI); the building itself is the
 * board's pixel sprite drawn as a white outline, like a line on blueprint paper.
 */

export const BLUE = 0x1f5fb8;
const BLUE_DARK = 0x173f7a;
const LINE = 0x9fd0ff;

type Kind = 'building' | 'hero';

export function blueprintName(kind: Kind, id: string): string {
  const key = kind === 'building' ? `building.${id}.name` : `enemy.${id}.name`;
  return hasText(key) ? t(key) : id;
}

/** Blueprint paper: blue fill, fine grid, a bright border. */
export function drawPaper(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, alpha = 1): void {
  g.fillStyle(BLUE, alpha);
  g.fillRect(x, y, w, h);
  g.lineStyle(1, LINE, 0.22 * alpha);
  for (let gx = x + 12; gx < x + w; gx += 12) g.lineBetween(gx, y + 1, gx, y + h - 1);
  for (let gy = y + 12; gy < y + h; gy += 12) g.lineBetween(x + 1, gy, x + w - 1, gy);
  g.lineStyle(2, LINE, 0.9 * alpha);
  g.strokeRect(x + 4, y + 4, w - 8, h - 8);
}

/** The building as a white outline (its board sprite tinted), or a generic house sketch when it has no sprite yet. */
export function sketch(scene: Phaser.Scene, kind: Kind, id: string, cx: number, cy: number, size: number, outline = true): Phaser.GameObjects.GameObject[] {
  const key = kind === 'building' ? `building.${id}` : `comm.${id}`;
  if (scene.textures.exists(key)) {
    const img = scene.add.image(cx, cy, key);
    img.setScale(Math.min(size / img.width, size / img.height));
    if (kind === 'building' && outline) img.setTintFill(0xffffff).setAlpha(0.9);
    else img.setAlpha(0.85);
    return [img];
  }
  const g = scene.add.graphics();
  const s = size / 2;
  const ink = outline ? 0xffffff : C.teal;
  g.lineStyle(3, ink, 0.9);
  g.strokeRect(cx - s * 0.7, cy - s * 0.1, s * 1.4, s * 0.9);
  g.beginPath();
  g.moveTo(cx - s * 0.85, cy - s * 0.05);
  g.lineTo(cx, cy - s * 0.8);
  g.lineTo(cx + s * 0.85, cy - s * 0.05);
  g.strokePath();
  g.strokeRect(cx - s * 0.18, cy + s * 0.3, s * 0.36, s * 0.5);
  g.lineStyle(1, ink, 0.6);
  g.lineBetween(cx - s * 0.9, cy + s * 0.95, cx + s * 0.9, cy + s * 0.95);
  return [g];
}

/** Segmented fragment bar: `need` cells, `have` filled. Returns its width. */
export function fragmentBar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, have: number, need: number, fill = 0xffffff): void {
  const gap = 4;
  const sw = (w - gap * (need - 1)) / need;
  for (let k = 0; k < need; k++) {
    g.fillStyle(k < have ? fill : BLUE_DARK, k < have ? 1 : 0.9);
    g.fillRect(x + k * (sw + gap), y, sw, h);
  }
}

/**
 * Pop-up when a fragment is dug out: whose fragment and how many are left
 * («Фрагмент чертежа · Глушилка Splice · 3/4»). A completed blueprint gets an amber frame.
 */
export function fragmentFound(scene: Phaser.Scene, kind: Kind, id: string, have: number, need: number, depth = 40): Phaser.GameObjects.Container {
  const W = VIEW.width;
  const w = Math.min(600, W - 60);
  const h = 206;
  const done = have >= need;
  const c = scene.add.container(W / 2, 250).setDepth(depth);
  const g = scene.add.graphics();
  g.fillStyle(0x0b1117, 0.35);
  g.fillRect(-w / 2 + 6, -h / 2 + 8, w, h);
  drawPaper(g, -w / 2, -h / 2, w, h);
  if (done) {
    g.lineStyle(5, C.amber, 1);
    g.strokeRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4);
  }
  c.add(g);
  const pic = 120;
  c.add(sketch(scene, kind, id, -w / 2 + 24 + pic / 2, 0, pic));
  const tx = -w / 2 + 48 + pic;
  const tw = w / 2 - 24 - tx;
  const cap = scene.add.text(tx, -h / 2 + 22, t(done ? (kind === 'hero' ? 'blueprint.done.hero' : 'blueprint.done.building') : 'blueprint.fragment').toUpperCase(), {
    ...TXT.caps(done ? '#FFD36B' : '#BFE0FF'),
    fontSize: '15px',
  });
  if (cap.width > tw) cap.setScale(tw / cap.width);
  const name = scene.add.text(tx, -h / 2 + 46, blueprintName(kind, id), TXT.num(30, INK.white));
  if (name.width > tw) name.setScale(tw / name.width);
  const sub = scene.add.text(tx, -h / 2 + 88, t(kind === 'hero' ? 'blueprint.kind.hero' : 'blueprint.kind.building'), { ...TXT.body(18, '#DCEBFF', '500'), wordWrap: { width: tw } });
  const bg = scene.add.graphics();
  fragmentBar(bg, tx, h / 2 - 38, tw - 70, 16, have, need, done ? C.amber : 0xffffff);
  const num = scene.add.text(w / 2 - 24, h / 2 - 30, `${have}/${need}`, TXT.num(26, INK.white)).setOrigin(1, 0.5);
  c.add([cap, name, sub, bg, num]);
  c.setScale(0.7).setAlpha(0);
  scene.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: c, alpha: 0, y: 220, delay: done ? 4200 : 3200, duration: 300, onComplete: () => c.destroy() });
  sound.play(done ? 'victory' : 'cache_open');
  return c;
}
