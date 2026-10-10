import Phaser from 'phaser';
import { C } from './layout';

/**
 * Glow feedback for all clickable GameObjects (Антон 2026-10-10 17:04: «подсвечивались а не
 * сдвигались»). Imported once from main.ts; wraps setInteractive, so every object with
 * useHandCursor:true gets it automatically, in every scene.
 *
 *  - Zone buttons (our usual graphics-plate + text + zone pattern): a teal glow ring fades in
 *    on hover; brightens on press. NO scaling, no position shift.
 *  - Sprite / Image / Container buttons: a bright teal tint on hover, deeper on press.
 *  - Touch: glow flash on pointerdown, auto-clears after 160 ms.
 *  - Opt-out: obj.setData('noHover', true) or a custom 'pointerover' handler wins.
 */

type GO = Phaser.GameObjects.GameObject &
  Partial<Phaser.GameObjects.Components.Transform> & { getBounds?: () => Phaser.Geom.Rectangle };

const HOVER_A = 0.55;   // glow ring alpha on mouse-hover
const PRESS_A = 1.0;    // glow ring alpha on press
const TINT_HOVER = 0xccebff;  // sprite tint on hover (bright sky-blue)
const TINT_PRESS = 0x88ccf0;  // sprite tint on press (deeper teal)
const MS = 100;

interface Fx {
  /** Current target alpha (0 = off). */
  alpha: number;
  tween?: Phaser.Tweens.Tween;
  /** For zone buttons: glow ring drawn behind the plate. */
  glow?: Phaser.GameObjects.Graphics;
  /** For sprite/image buttons: tint helpers. */
  setTint?: (t: number) => void;
  clearTint?: () => void;
}

const FX = new WeakMap<GO, Fx>();
const isZone = (o: GO): o is GO => o instanceof Phaser.GameObjects.Zone;

/** Draw a teal glow ring in the same coordinate space as the zone, inserted just behind it. */
function makeGlow(obj: GO): Phaser.GameObjects.Graphics | undefined {
  if (!isZone(obj) || !obj.scene) return undefined;
  const z = obj as unknown as Phaser.GameObjects.Zone;
  const scene = obj.scene;
  // Skip huge input-eater zones (whole panels, full-screen masks).
  if (z.width * z.height > scene.scale.width * scene.scale.height * 0.35) return undefined;

  const pad = 4;
  const bx = z.x - z.width * z.originX;
  const by = z.y - z.height * z.originY;
  const g = scene.add.graphics();
  // Outer ring stroke (seam = light sky-blue from brand palette)
  g.lineStyle(3, C.seam, 1);
  g.strokeRoundedRect(bx - pad, by - pad, z.width + pad * 2, z.height + pad * 2, 18);
  // Inner fill (subtle teal wash)
  g.fillStyle(C.seam, 0.18);
  g.fillRoundedRect(bx, by, z.width, z.height, 14);
  g.setAlpha(0);

  const parent = z.parentContainer;
  if (parent) {
    const zGO = z as unknown as Phaser.GameObjects.GameObject;
    parent.addAt(g, Math.max(0, parent.getIndex(zGO) - 1));
  } else {
    g.setDepth(z.depth - 0.5).setScrollFactor(z.scrollFactorX, z.scrollFactorY);
    scene.children.moveBelow(g, z as unknown as Phaser.GameObjects.GameObject);
  }
  return g;
}

/** Tween the glow/tint to target alpha. */
function animTo(obj: GO, target: number): void {
  if (!obj.active || !obj.scene) return;
  let fx = FX.get(obj);
  if (!fx) {
    if (target === 0) return; // nothing to do
    // Initialise Fx for this object on first glow.
    fx = { alpha: 0 };
    if (isZone(obj)) {
      fx.glow = makeGlow(obj);
    } else {
      const o = obj as { setTint?: (t: number) => void; clearTint?: () => void };
      if (typeof o.setTint === 'function') { fx.setTint = o.setTint.bind(o); fx.clearTint = o.clearTint?.bind(o); }
    }
    FX.set(obj, fx);
    obj.once('destroy', () => { FX.get(obj)?.glow?.destroy(); FX.delete(obj); });
  }

  const f = fx;
  f.tween?.stop();
  const from = f.alpha;
  f.alpha = target;

  if (f.glow) {
    if (!f.glow.active) return;
    f.tween = obj.scene.tweens.addCounter({
      from, to: target, duration: MS,
      ease: 'Quad.out',
      onUpdate: (tw) => { if (f.glow?.active) f.glow.setAlpha(tw.getValue() ?? target); },
      onComplete: () => { if (target === 0) { f.glow?.destroy(); FX.delete(obj); } },
    });
  } else if (f.setTint) {
    if (target === 0) f.clearTint?.();
    else f.setTint(target >= PRESS_A ? TINT_PRESS : TINT_HOVER);
  }
}

/** Wire hover / press listeners onto obj (once only). */
function wire(obj: GO): void {
  if ((obj as { __hover?: boolean }).__hover) return;
  (obj as { __hover?: boolean }).__hover = true;
  let over = false;
  const custom = () => obj.listenerCount('pointerover') > 1 || obj.getData?.('noHover');

  obj.on('pointerover', (p: Phaser.Input.Pointer) => {
    if (custom() || p.wasTouch) return;
    over = true;
    animTo(obj, HOVER_A);
  });
  obj.on('pointerout', () => {
    if (custom()) return;
    over = false;
    animTo(obj, 0);
  });
  obj.on('pointerdown', (p: Phaser.Input.Pointer) => {
    if (custom()) return;
    animTo(obj, PRESS_A);
    if (p.wasTouch) {
      // Touch: no persistent hover — auto-fade after a short flash.
      obj.scene?.time.delayedCall(160, () => { if (obj.active) animTo(obj, 0); });
    }
  });
  obj.on('pointerup', (p: Phaser.Input.Pointer) => {
    if (custom() || p.wasTouch) return;
    animTo(obj, over ? HOVER_A : 0);
  });
}

// Monkey-patch setInteractive: every object that requests the hand cursor is auto-wired.
const proto = Phaser.GameObjects.GameObject.prototype as unknown as { setInteractive: (...a: unknown[]) => unknown };
const original = proto.setInteractive;
proto.setInteractive = function (this: GO, ...args: unknown[]) {
  const out = original.apply(this, args);
  const cfg = args[0] as { useHandCursor?: boolean; cursor?: string } | undefined;
  if (cfg && typeof cfg === 'object' && (cfg.useHandCursor || cfg.cursor === 'pointer')) wire(this);
  return out;
};
