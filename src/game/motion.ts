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

/** Resting size and place of pressed objects, so a press that lands mid-spring still returns exactly. */
const rest = new WeakMap<object, { x: number; y: number; sx: number; sy: number }>();

/**
 * A quick press: the parts shrink a little and spring back. Call on pointer down.
 * With a pivot, they shrink towards that point (the middle of a button) instead of their own origin.
 */
export function pressFx(scene: Phaser.Scene, parts: Phaser.GameObjects.GameObject[], pivot?: { x: number; y: number }): void {
  if (calmFx()) return;
  for (const p of parts) {
    const o = p as Scalable & Fadeable;
    if (!rest.has(o)) rest.set(o, { x: o.x, y: o.y, sx: o.scaleX, sy: o.scaleY });
    const r = rest.get(o)!;
    scene.tweens.killTweensOf(o);
    o.setScale(r.sx, r.sy);
    o.x = r.x;
    o.y = r.y;
    const k = MOTION.pressScale;
    const to: Record<string, number> = { scaleX: r.sx * k, scaleY: r.sy * k };
    if (pivot) {
      to.x = pivot.x + (r.x - pivot.x) * k;
      to.y = pivot.y + (r.y - pivot.y) * k;
    }
    scene.tweens.add({ targets: o, ...to, duration: MOTION.press, yoyo: true, ease: 'Quad.easeOut' });
  }
}
