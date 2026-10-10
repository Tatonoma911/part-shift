import Phaser from 'phaser';
import { t } from '../i18n';
import { ACCOUNT_PREFIX } from '../account/snapshot';
import { sound } from './audio';
import { C, INK, VIEW } from './layout';
import { chip, plate, TXT } from './ui';

/**
 * «Сбросить весь прогресс» (Антон 10.10: «начать полностью сначала, с подтверждением,
 * что всё обнулится»). One honest list of what goes and what stays, and a button
 * that has to be held, so it can't be pressed by accident.
 */

/** Settings and the account sign-in survive the reset: language, volume, comfort options, login. Everything else of the game goes. */
const KEEP = ['partshift.settings.v1', 'partshift.sound.v1', 'partshift.comfort.v1'];
const HOLD_MS = 2500;

export function resetAllProgress(): number {
  let n = 0;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('partshift.') && !KEEP.includes(k) && !k.startsWith(ACCOUNT_PREFIX)) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
    n = keys.length;
  } catch {
    /* storage blocked: nothing to wipe */
  }
  return n;
}

type Ev = Phaser.Types.Input.EventData;

/** Modal over the menu. `done` runs after the wipe (the menu reloads the game from scratch). */
export function resetDialog(scene: Phaser.Scene, depth: number, done: () => void, cancel: () => void): Phaser.GameObjects.Container {
  const W = VIEW.width;
  const H = VIEW.height;
  const c = scene.add.container(0, 0).setDepth(depth);
  const shade = scene.add.rectangle(0, 0, W, H, 0x0a1218, 0.62).setOrigin(0).setInteractive();
  shade.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => ev.stopPropagation());
  c.add(shade);
  const w = Math.min(700, W - 48);
  const x = (W - w) / 2;
  const body = scene.add.container(x, 0);
  c.add(body);
  const g = scene.add.graphics();
  body.add(g);
  let y = 44;
  // Warning stamp, title.
  const stamp = scene.add.text(w / 2, y, t('reset.kicker').toUpperCase(), { ...TXT.caps('#FFFFFF'), backgroundColor: '#E03552', padding: { x: 14, y: 6 } }).setOrigin(0.5, 0);
  body.add(stamp);
  y += 54;
  const title = scene.add.text(w / 2, y, t('reset.title'), { ...TXT.num(34, INK.graphite), align: 'center', wordWrap: { width: w - 80 } }).setOrigin(0.5, 0);
  body.add(title);
  y += title.height + 22;
  // What is erased.
  body.add(scene.add.text(48, y, t('reset.gone').toUpperCase(), TXT.caps(INK.coral)));
  y += 36;
  for (const k of ['heroes', 'blueprints', 'dossier', 'saves', 'learning']) {
    const dot = scene.add.graphics();
    dot.fillStyle(C.coral, 1);
    dot.fillRect(52, y + 11, 10, 10);
    body.add(dot);
    const line = scene.add.text(76, y, t(`reset.gone.${k}`), { ...TXT.body(22, INK.graphite, '600'), wordWrap: { width: w - 124 } });
    body.add(line);
    y += line.height + 10;
  }
  y += 10;
  body.add(scene.add.text(48, y, t('reset.kept').toUpperCase(), TXT.caps(INK.teal)));
  y += 36;
  for (const k of ['settings', 'account', 'rating']) {
    const dot = scene.add.graphics();
    dot.fillStyle(C.teal, 1);
    dot.fillRect(52, y + 11, 10, 10);
    body.add(dot);
    const line = scene.add.text(76, y, t(`reset.kept.${k}`), { ...TXT.body(21, INK.dim, '500'), wordWrap: { width: w - 124 } });
    body.add(line);
    y += line.height + 10;
  }
  y += 24;
  // Hold to erase: the red fill grows while the finger stays down; letting go early cancels.
  const bw = w - 96;
  const bh = 92;
  const bx = 48;
  const by = y;
  const bg = scene.add.graphics();
  const label = scene.add.text(bx + bw / 2, by + bh / 2, t('reset.hold'), { ...TXT.body(24, INK.coral, '800'), align: 'center' }).setOrigin(0.5);
  body.add([bg, label]);
  let held = 0;
  let holding = false;
  let downAt = 0;
  let fired = false;
  const draw = () => {
    bg.clear();
    chip(bg, bx, by, bw, bh, 0xfde7ea, 1, 14, { color: C.coralInk, width: 3 });
    if (held > 0) {
      bg.fillStyle(C.coralInk, 1);
      bg.fillRect(bx + 3, by + 3, (bw - 6) * Math.min(1, held / HOLD_MS), bh - 6);
    }
    label.setColor(held > HOLD_MS * 0.45 ? INK.white : INK.coral);
  };
  draw();
  const hit = scene.add.zone(bx, by, bw, bh).setOrigin(0).setInteractive({ useHandCursor: true });
  hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => {
    ev.stopPropagation();
    holding = true;
    downAt = performance.now();
    label.setText(t('reset.holding'));
  });
  const release = () => {
    if (!holding || fired) return;
    holding = false;
    held = 0;
    label.setText(t('reset.hold'));
    draw();
  };
  hit.on('pointerup', release);
  hit.on('pointerout', release);
  body.add(hit);
  const tick = () => {
    if (!holding || fired) return;
    // Real time, not frame time: on a slow phone the hold still takes 2.5 s.
    held = performance.now() - downAt;
    draw();
    if (held >= HOLD_MS) {
      fired = true;
      label.setText(t('reset.done'));
      resetAllProgress();
      sound.play('defeat');
      scene.time.delayedCall(700, done);
    }
  };
  scene.events.on('update', tick);
  c.once('destroy', () => scene.events.off('update', tick));
  y += bh + 18;
  // Cancel: the calm, big way out.
  const cg = scene.add.graphics();
  chip(cg, bx, y, bw, 84, C.graphite, 1, 14);
  const ct = scene.add.text(bx + bw / 2, y + 42, t('reset.cancel'), TXT.body(24, INK.white, '700')).setOrigin(0.5);
  const chit = scene.add.zone(bx, y, bw, 84).setOrigin(0).setInteractive({ useHandCursor: true });
  chit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => {
    ev.stopPropagation();
    cancel();
  });
  body.add([cg, ct, chit]);
  y += 84 + 40;
  plate(g, 0, 0, w, y, 28);
  body.setY(Math.max(24, (H - y) / 2));
  return c;
}
