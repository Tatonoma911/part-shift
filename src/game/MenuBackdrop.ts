import Phaser from 'phaser';
import { sound } from './audio';
import { hasText, t } from '../i18n';
import { C, INK, LANDSCAPE, VIEW } from './layout';
import { chip, plate, TXT } from './ui';

/**
 * Menu backdrop in one comic layer (AR-00, AR-07, AR-08): the painted Lumen City
 * (art/export/screens/menu_bg_vertical, pack item 114) and three infected heroes on
 * call as round comic portraits (art/comm/game, the same ones the radio uses).
 * No pixel sprites and no code-drawn city here: the board is the pixel layer.
 */
const MENU_HEROES = ['kiln', 'lineman', 'frostline', 'seraph', 'current', 'mason', 'beacon', 'canopy', 'sweep', 'patch', 'hive', 'n73', 'doctor', 'demon'];

export function drawMenuBackdrop(scene: Phaser.Scene): void {
  const W = VIEW.width;
  const H = VIEW.height;
  const g = scene.add.graphics();
  g.fillGradientStyle(0xeaf5f8, 0xeaf5f8, C.sky2, C.sky2, 1);
  g.fillRect(0, 0, W, H);
  const key = 'screen.menu_bg_vertical';
  if (!scene.textures.exists(key)) return;
  // Cover the screen; on PC the picture keeps its middle band (the dome over the bay).
  const img = scene.add.image(W / 2, H / 2, key);
  const k = Math.max(W / img.width, H / img.height);
  img.setScale(k);
  if (!LANDSCAPE) img.setY(H / 2 + (img.displayHeight - H) * 0.12);
  // Slow drift so the city feels alive behind the menu.
  scene.tweens.add({ targets: img, scale: k * 1.04, duration: 18000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  // Light veil under the logo and a stronger one under the menu panel, so text stays readable.
  const veil = scene.add.graphics();
  veil.fillGradientStyle(0xf4f7f7, 0xf4f7f7, 0xf4f7f7, 0xf4f7f7, 0.82, 0.82, 0, 0);
  veil.fillRect(0, 0, W, LANDSCAPE ? 300 : 320);
  if (LANDSCAPE) {
    veil.fillGradientStyle(0xf4f7f7, 0xf4f7f7, 0xf4f7f7, 0xf4f7f7, 0, 0.55, 0, 0.55);
    veil.fillRect(W / 2, 0, W / 2, H);
  } else {
    veil.fillGradientStyle(0xf4f7f7, 0xf4f7f7, 0xf4f7f7, 0xf4f7f7, 0, 0, 0.7, 0.7);
    veil.fillRect(0, 640, W, H - 640);
  }
}

/** Three random infected heroes "on call": round comic portraits with a name tag; tap one for a line. */
export function drawMenuHeroes(scene: Phaser.Scene, ax: number, ay: number): void {
  const pool = MENU_HEROES.filter((id) => scene.textures.exists(`comm.${id}`));
  const pick = Phaser.Utils.Array.Shuffle([...pool]).slice(0, 3);
  // Middle one is bigger and drawn last, in front.
  const slots = [
    { x: 160, y: 470, r: 92 },
    { x: 620, y: 470, r: 92 },
    { x: 390, y: 450, r: 118 },
  ];
  let bubble: Phaser.GameObjects.Container | null = null;
  pick.forEach((id, i) => {
    const s = slots[i];
    const x = ax + s.x;
    const y = ay + s.y;
    const c = scene.add.container(x, y);
    const g = scene.add.graphics();
    // Coral "infected" halo, then the portrait in an ink ring.
    g.fillStyle(C.coral, 0.22);
    g.fillCircle(0, 0, s.r + 18);
    g.fillStyle(0x0b1117, 0.25);
    g.fillCircle(3, 6, s.r + 4);
    g.fillStyle(0xf3f2ee, 1);
    g.fillCircle(0, 0, s.r);
    c.add(g);
    const img = scene.add.image(0, 0, `comm.${id}`);
    img.setScale((s.r * 2) / img.width);
    c.add(img);
    const ring = scene.add.graphics();
    ring.lineStyle(Math.max(4, s.r * 0.07), C.graphite, 1);
    ring.strokeCircle(0, 0, s.r);
    ring.lineStyle(4, C.coral, 1);
    ring.strokeCircle(0, 0, s.r + 9);
    c.add(ring);

    // Name tag over the bottom of the ring: graphite chip with the name and a coral "on call" line.
    const name = (hasText(`enemy.${id}.name`) ? t(`enemy.${id}.name`) : id).toUpperCase();
    const tagT = scene.add.text(0, 0, name, TXT.num(18, INK.white)).setOrigin(0.5, 0.5);
    if (tagT.width > 190) tagT.setScale(190 / tagT.width);
    const callT = scene.add.text(0, 0, t('menu.on_call').toUpperCase(), { ...TXT.caps(INK.coral), fontSize: '12px' }).setOrigin(0.5, 0.5);
    const w = Math.max(tagT.displayWidth, callT.width) + 36;
    const tg = scene.add.graphics();
    chip(tg, -w / 2, -26, w, 52, C.graphite, 0.94, 12);
    tg.fillStyle(C.coral, 1);
    tg.fillCircle(-w / 2 + 14, 12, 4);
    tagT.setPosition(0, -9);
    callT.setPosition(6, 13);
    c.add(scene.add.container(0, s.r + 6, [tg, tagT, callT]));
    scene.tweens.add({ targets: c, y: y - 6, duration: 1600 + i * 230, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 400 });

    // Easter egg: tap a hero to hear one of their lines.
    img.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      const lines = [1, 2, 3, 4, 5].map((n) => `hero.line.${id}.${n}`).filter((k) => hasText(k));
      if (!lines.length) return;
      bubble?.destroy();
      const txt = scene.add.text(0, 0, t(Phaser.Utils.Array.GetRandom(lines)), { ...TXT.body(20, INK.graphite, '600'), wordWrap: { width: 300 }, align: 'center' }).setOrigin(0.5);
      const bw = txt.width + 36;
      const bh = txt.height + 26;
      const bg = scene.add.graphics();
      plate(bg, -bw / 2, -bh / 2, bw, bh, 12);
      bg.fillStyle(C.paper, 1);
      bg.fillTriangle(-10, bh / 2 - 2, 10, bh / 2 - 2, 0, bh / 2 + 14);
      const by = Math.max(y - s.r - bh / 2 - 20, ay + 290);
      const bx = Phaser.Math.Clamp(x, ax + bw / 2 + 12, ax + 780 - bw / 2 - 12);
      const box = scene.add.container(bx, by, [bg, txt]).setDepth(5).setScale(0.6).setAlpha(0);
      bubble = box;
      scene.tweens.add({ targets: box, scale: 1, alpha: 1, duration: 180, ease: 'Back.easeOut' });
      scene.tweens.add({ targets: box, alpha: 0, delay: 2800, duration: 300, onComplete: () => box.destroy() });
      scene.tweens.add({ targets: img, scale: img.scale * 1.05, duration: 110, yoyo: true });
      sound.play('ui_tap');
    });
  });
}
