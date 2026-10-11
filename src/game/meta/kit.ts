import Phaser from 'phaser';
import { sound } from '../audio';
import { C, INK } from '../layout';
import { pressFx } from '../motion';
import { chip, TXT } from '../ui';

/** Small building blocks shared by the meta screens, same look as the pause and end sheets. */
type Ev = Phaser.Types.Input.EventData;

export function onTap(obj: Phaser.GameObjects.GameObject, fn: () => void, sfx = true): void {
  obj.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => {
    ev?.stopPropagation();
    if (sfx) sound.play('ui_tap');
    fn();
  });
}

/** Full-screen dim that swallows taps (optional handler for "tap to speed up"). */
export function shade(scene: Phaser.Scene, w: number, h: number, alpha = 0.62, onTapFn?: () => void): Phaser.GameObjects.Rectangle {
  const r = scene.add.rectangle(0, 0, w, h, 0x0a1218, alpha).setOrigin(0).setInteractive();
  r.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => {
    ev?.stopPropagation();
    onTapFn?.();
  });
  return r;
}

/** Brand button: teal primary with a graphite underline, or a light secondary. Presses shrink a little around its centre. */
export function button(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, act: () => void, primary = false, size = 29): Phaser.GameObjects.GameObject[] {
  // Drawn around the centre, so the press pulse scales from the middle of the button.
  const cx = x + w / 2;
  const cy = y + h / 2;
  const g = scene.add.graphics().setPosition(cx, cy);
  chip(g, -w / 2, -h / 2, w, h, primary ? C.teal : C.graphite, primary ? 1 : 0.1, 18);
  if (primary) {
    g.fillStyle(C.graphite, 0.35);
    g.fillRect(-w / 2 + 18, h / 2 - 6, w - 36, 6);
  }
  const tx = scene.add.text(cx, cy, label, TXT.body(size, primary ? INK.white : INK.graphite, '700')).setOrigin(0.5);
  if (tx.width > w - 40) tx.setScale((w - 40) / tx.width);
  const hit = scene.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
  hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => {
    ev?.stopPropagation();
    sound.play('ui_tap');
    pressFx(scene, [g, tx]);
    act();
  });
  return [g, tx, hit];
}

/** Thin progress bar with an optional "new" segment (from → to) in a lighter colour. */
export function bar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, frac: number, color: number, from?: number): void {
  g.fillStyle(C.graphite, 0.1);
  g.fillRoundedRect(x, y, w, h, h / 2);
  const f = Phaser.Math.Clamp(frac, 0, 1);
  if (f <= 0) return;
  g.fillStyle(color, 1);
  g.fillRoundedRect(x, y, Math.max(h, w * f), h, h / 2);
  if (from !== undefined && from < f) {
    g.fillStyle(0xffffff, 0.45);
    g.fillRect(x + w * Math.max(0, from), y + 1, w * (f - from), Math.max(2, h * 0.35));
  }
}

/** Russian plural: one / few / many key suffix. */
export function plural(n: number): 'one' | 'few' | 'many' {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return 'many';
  if (b === 1) return 'one';
  if (b >= 2 && b <= 4) return 'few';
  return 'many';
}

export function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function fmtNum(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
