import Phaser from 'phaser';
import { t } from '../i18n';
import { HAS_VOICE, sound, type VolumeChannel } from './audio';
import { C, INK } from './layout';
import { TXT } from './ui';

type Ev = Phaser.Types.Input.EventData;

const ROW = 84;
const KNOB = 22;

/** Channels shown as sliders; voice appears once the sound designer adds voiced lines. */
export function volumeChannels(): VolumeChannel[] {
  return HAS_VOICE ? ['master', 'music', 'effects', 'ui', 'voice'] : ['master', 'music', 'effects', 'ui'];
}

export function volumeHeight(): number {
  return volumeChannels().length * ROW;
}

/**
 * Volume sliders (one row per channel: label, percent, track). Objects are
 * created at (x, y) in the parent's local space and returned so the caller
 * can put them in its container. Drag or tap the track; saved at once.
 */
export function volumeSliders(scene: Phaser.Scene, x: number, y: number, w: number): Phaser.GameObjects.GameObject[] {
  const out: Phaser.GameObjects.GameObject[] = [];
  for (const [k, ch] of volumeChannels().entries()) {
    const top = y + k * ROW;
    const label = scene.add.text(x, top + 18, t(`settings.volume.${ch}`), TXT.body(25, INK.graphite, '700')).setOrigin(0, 0.5);
    const pct = scene.add.text(x + w, top + 18, '', TXT.num(22, INK.teal)).setOrigin(1, 0.5);
    const g = scene.add.graphics();
    const trackY = top + 58;
    const draw = () => {
      const v = sound.prefs[ch];
      g.clear();
      g.fillStyle(C.graphite, 0.12);
      g.fillRoundedRect(x, trackY - 6, w, 12, 6);
      g.fillStyle(C.teal, 1);
      g.fillRoundedRect(x, trackY - 6, Math.max(12, w * v), 12, 6);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(x + w * v, trackY, KNOB);
      g.lineStyle(4, v > 0 ? C.teal : C.graphite, 1);
      g.strokeCircle(x + w * v, trackY, KNOB);
      pct.setText(v > 0 ? `${Math.round(v * 100)}%` : t('settings.off'));
      pct.setColor(v > 0 ? INK.teal : INK.dim);
    };
    draw();
    // A taller hit strip than the track so a finger finds it.
    const hit = scene.add.zone(x - KNOB, top + 30, w + KNOB * 2, 56).setOrigin(0).setInteractive({ useHandCursor: true });
    let dragging = false;
    const set = (p: Phaser.Input.Pointer) => {
      const m = hit.getWorldTransformMatrix();
      const v = Phaser.Math.Clamp((p.x - m.tx - KNOB) / w, 0, 1);
      // Snap to 5% steps; the far left is off.
      sound.setPrefs({ [ch]: Math.round(v * 20) / 20 });
      draw();
    };
    hit.on('pointerdown', (p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => {
      ev.stopPropagation();
      dragging = true;
      sound.unlock();
      set(p);
    });
    const move = (p: Phaser.Input.Pointer) => {
      if (dragging && p.isDown) set(p);
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      // Let the player hear the new level.
      if (ch === 'effects') sound.play('dig_done');
      else if (ch !== 'music') sound.play('ui_tap');
    };
    scene.input.on('pointermove', move);
    scene.input.on('pointerup', up);
    hit.once('destroy', () => {
      scene.input.off('pointermove', move);
      scene.input.off('pointerup', up);
    });
    out.push(label, pct, g, hit);
  }
  return out;
}
