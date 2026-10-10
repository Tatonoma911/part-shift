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

/**
 * Settings and the account sign-in survive the reset: language, volume, comfort options, login
 * (keys under ACCOUNT_PREFIX; the writer's settings.wipe.step1.keeps line says so). Everything else of the game goes.
 */
const KEEP = ['partshift.settings.v1', 'partshift.sound.v1', 'partshift.comfort.v1'];
const HOLD_MS = 3000;

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

/**
 * Modal over the menu, three steps so it can't happen by accident (design/META.md §1а, texts settings.wipe.*):
 *   1. what will be lost, a big «Отмена» and a small «Дальше»;
 *   2. the «Я понимаю…» checkbox; without it the button below stays grey;
 *   3. «Стереть» has to be held for 3 s while a red ring fills; letting go early cancels.
 * `done` runs after the wipe (the menu reloads the game from scratch).
 */
export function resetDialog(scene: Phaser.Scene, depth: number, done: () => void, cancel: () => void): Phaser.GameObjects.Container {
  const W = VIEW.width;
  const H = VIEW.height;
  const c = scene.add.container(0, 0).setDepth(depth);
  const shade = scene.add.rectangle(0, 0, W, H, 0x0a1218, 0.62).setOrigin(0).setInteractive();
  shade.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => ev.stopPropagation());
  c.add(shade);
  const w = Math.min(700, W - 48);
  const x = (W - w) / 2;
  let body: Phaser.GameObjects.Container | null = null;
  let tick: (() => void) | null = null;
  const off = () => {
    if (tick) scene.events.off('update', tick);
    tick = null;
  };
  c.once('destroy', off);
  const tap = (o: Phaser.GameObjects.Zone, fn: () => void) =>
    o.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => {
      ev.stopPropagation();
      sound.play('ui_tap');
      fn();
    });
  const button = (b: Phaser.GameObjects.Container, bx: number, by: number, bw: number, bh: number, label: string, fill: number, ink: string, fn: (() => void) | null, stroke?: number) => {
    const g = scene.add.graphics();
    chip(g, bx, by, bw, bh, fill, 1, 14, stroke !== undefined ? { color: stroke, width: 3 } : undefined);
    const tl = scene.add.text(bx + bw / 2, by + bh / 2, label, { ...TXT.body(24, ink, '800'), align: 'center' }).setOrigin(0.5);
    if (tl.width > bw - 24) tl.setScale((bw - 24) / tl.width);
    b.add([g, tl]);
    if (fn) {
      const z = scene.add.zone(bx, by, bw, bh).setOrigin(0).setInteractive({ useHandCursor: true });
      tap(z, fn);
      b.add(z);
    }
  };
  const open = (step: 1 | 2) => {
    off();
    body?.destroy();
    const b = scene.add.container(x, 0);
    body = b;
    c.add(b);
    const g = scene.add.graphics();
    b.add(g);
    let y = 40;
    const stamp = scene.add.text(w / 2, y, t('reset.kicker').toUpperCase(), { ...TXT.caps('#FFFFFF'), backgroundColor: '#E03552', padding: { x: 14, y: 6 } }).setOrigin(0.5, 0);
    b.add(stamp);
    y += 52;
    const title = scene.add.text(w / 2, y, t('settings.wipe.step1.title'), { ...TXT.num(32, INK.graphite), align: 'center', wordWrap: { width: w - 80 } }).setOrigin(0.5, 0);
    b.add(title);
    y += title.height + 20;
    const bw = w - 96;
    const bx = 48;
    if (step === 1) {
      b.add(scene.add.text(48, y, t('settings.wipe.step1.lead'), TXT.body(22, INK.coral, '800')));
      y += 38;
      for (const k of ['heroes', 'rank', 'blueprints', 'dossier', 'records', 'daily', 'tutorial']) {
        const dot = scene.add.graphics();
        dot.fillStyle(C.coral, 1);
        dot.fillRect(52, y + 10, 10, 10);
        b.add(dot);
        const line = scene.add.text(76, y, t(`settings.wipe.item.${k}`), { ...TXT.body(21, INK.graphite, '600'), wordWrap: { width: w - 124 } });
        b.add(line);
        y += line.height + 8;
      }
      y += 8;
      for (const [k, ink] of [['settings.wipe.step1.cloud', INK.coral], ['settings.wipe.step1.keeps', INK.teal]] as const) {
        const line = scene.add.text(48, y, t(k), { ...TXT.body(19, ink, '600'), wordWrap: { width: w - 96 } });
        b.add(line);
        y += line.height + 8;
      }
      y += 16;
      // The calm way out is the big one.
      button(b, bx, y, bw, 88, t('settings.wipe.cancel'), C.graphite, INK.white, cancel);
      y += 88 + 14;
      button(b, bx + bw / 4, y, bw / 2, 64, t('settings.wipe.next'), C.white, INK.coral, () => open(2), C.coralInk);
      y += 64 + 36;
    } else {
      // Step 2: the checkbox.
      let checked = false;
      const rowY = y;
      const box = scene.add.graphics();
      const cl = scene.add.text(bx + 64, y + 4, t('settings.wipe.step2.check'), { ...TXT.body(22, INK.graphite, '700'), wordWrap: { width: bw - 64 } });
      const rowH = Math.max(56, cl.height + 8);
      b.add([box, cl]);
      const ringY = y + rowH + 40;
      const R = 84;
      const cx = w / 2;
      const cy = ringY + R;
      const ring = scene.add.graphics();
      const label = scene.add.text(cx, cy, t('settings.wipe.step3.button').toUpperCase(), TXT.num(22, INK.dim)).setOrigin(0.5);
      if (label.width > R * 1.6) label.setScale((R * 1.6) / label.width);
      const hint = scene.add.text(cx, cy + R + 12, t('settings.wipe.step3.hold'), TXT.body(19, INK.dim, '700')).setOrigin(0.5, 0);
      b.add([ring, label, hint]);
      let held = 0;
      let holding = false;
      let downAt = 0;
      let fired = false;
      const draw = () => {
        box.clear();
        chip(box, bx, rowY + 4, 44, 44, checked ? C.coralInk : C.white, 1, 8, { color: checked ? C.coralInk : C.graphite, width: 3 });
        if (checked) {
          box.lineStyle(5, 0xffffff, 1);
          box.beginPath();
          box.moveTo(bx + 10, rowY + 27);
          box.lineTo(bx + 19, rowY + 36);
          box.lineTo(bx + 35, rowY + 16);
          box.strokePath();
        }
        ring.clear();
        ring.fillStyle(checked ? 0xfde7ea : 0xe3e8ea, 1);
        ring.fillCircle(cx, cy, R);
        ring.lineStyle(12, checked ? 0xf3c2ca : 0xc6d4d9, 1);
        ring.strokeCircle(cx, cy, R - 6);
        if (held > 0) {
          ring.lineStyle(12, C.coralInk, 1);
          ring.beginPath();
          ring.arc(cx, cy, R - 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, held / HOLD_MS), false);
          ring.strokePath();
        }
        label.setColor(checked ? INK.coral : INK.dim);
        hint.setColor(checked ? INK.graphite : INK.dim);
      };
      const boxHit = scene.add.zone(bx - 8, y - 4, bw + 16, rowH + 8).setOrigin(0).setInteractive({ useHandCursor: true });
      tap(boxHit, () => {
        if (fired) return;
        checked = !checked;
        draw();
      });
      b.add(boxHit);
      const hit = scene.add.zone(cx - R, cy - R, R * 2, R * 2).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => {
        ev.stopPropagation();
        if (!checked || fired) return;
        holding = true;
        downAt = performance.now();
      });
      const release = () => {
        if (!holding || fired) return;
        holding = false;
        held = 0;
        draw();
      };
      hit.on('pointerup', release);
      hit.on('pointerout', release);
      b.add(hit);
      draw();
      tick = () => {
        if (!holding || fired) return;
        // Real time, not frame time: on a slow phone the hold still takes 3 s.
        held = performance.now() - downAt;
        draw();
        if (held >= HOLD_MS) {
          fired = true;
          resetAllProgress();
          sound.play('defeat');
          label.setText('✓').setScale(1.6);
          joke.setText(t('settings.wipe.done'));
          scene.time.delayedCall(1400, done);
        }
      };
      scene.events.on('update', tick);
      y = cy + R + 52;
      // Контроль's line under the ring.
      const joke = scene.add.text(w / 2, y, t('settings.wipe.step3.control'), { ...TXT.body(18, INK.violet, '600'), align: 'center', wordWrap: { width: w - 96 } }).setOrigin(0.5, 0);
      b.add(joke);
      y += joke.height + 22;
      button(b, bx, y, bw, 80, t('settings.wipe.cancel'), C.graphite, INK.white, cancel);
      y += 80 + 36;
    }
    plate(g, 0, 0, w, y, 28);
    b.sendToBack(g);
    b.setY(Math.max(24, (H - y) / 2));
  };
  open(1);
  return c;
}
