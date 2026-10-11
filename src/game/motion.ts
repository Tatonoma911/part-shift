import Phaser from 'phaser';
import { calmFx } from './comfort';

/**
 * Interface motion (design/INTERFACE_SYSTEM.md §1.7: short, tied to one event, 150–400 ms).
 * Screens fade in, sheets rise from the bottom edge, buttons give a small press. Sprite and
 * frame animation is not here (Аниматор's zone). Every helper does nothing in calm mode or when
 * the system «reduce motion» switch is on (calmFx), so the screen simply appears.
 */
export const MOTION = {
  /** Screen fade-in after a scene starts. Matches the loading screen's fade-out colour. */
  screen: 240,
  /** Sheet or card rise + fade. */
  sheet: 220,
  /** Half of the press pulse (down, then back). */
  press: 70,
  /** How far a sheet rises, in px. */
  rise: 24,
  /** Press depth: the object shrinks to this share of its size. */
  pressScale: 0.96,
} as const;

type Fadeable = Phaser.GameObjects.GameObject & { x: number; y: number; alpha: number };
type Scalable = Phaser.GameObjects.GameObject & { scaleX: number; scaleY: number; setScale(x: number, y?: number): unknown };

/** The scene fades in from the loading screen's colour instead of popping in. */
export function enterScene(scene: Phaser.Scene): void {
  if (calmFx()) return;
  scene.cameras.main.fadeIn(MOTION.screen, 244, 247, 247);
}

/** Panels rise from below and fade in. Pass the parts that move (the scrim may fade on its own). */
export function sheetIn(scene: Phaser.Scene, parts: Phaser.GameObjects.GameObject[]): void {
  if (calmFx()) return;
  for (const p of parts) {
    const o = p as Fadeable;
    const y = o.y;
    o.y = y + MOTION.rise;
    o.alpha = 0;
    scene.tweens.add({ targets: o, y, alpha: 1, duration: MOTION.sheet, ease: 'Cubic.easeOut' });
  }
}

/** A quick press: the parts shrink a little and spring back. Call on pointer down. */
export function pressFx(scene: Phaser.Scene, parts: Phaser.GameObjects.GameObject[]): void {
  if (calmFx()) return;
  for (const p of parts) {
    const o = p as Scalable;
    const sx = o.scaleX;
    const sy = o.scaleY;
    scene.tweens.killTweensOf(o);
    o.setScale(sx, sy);
    scene.tweens.add({
      targets: o,
      scaleX: sx * MOTION.pressScale,
      scaleY: sy * MOTION.pressScale,
      duration: MOTION.press,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }
}
