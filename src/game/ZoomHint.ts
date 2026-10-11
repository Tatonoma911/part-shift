import Phaser from 'phaser';

/**
 * A wordless hint that the board can be zoomed: two fingers pinch on a phone,
 * a mouse wheel turns on a computer. It loops a few times and goes away on the
 * first tap or click, so it never sits in the way of play.
 */
const LOOPS = 3;
const LOOP_MS = 1100;
const FADE_MS = 300;

export function showZoomHint(scene: Phaser.Scene): void {
  const touch = scene.sys.game.device.input.touch;
  const w = scene.scale.width;
  const h = scene.scale.height;
  const cx = w / 2;
  const cy = h / 2;
  const depth = 1000;
  const parts: Phaser.GameObjects.GameObject[] = [];

  const veil = scene.add.graphics().setDepth(depth).setAlpha(0);
  veil.fillStyle(0x0b1020, 0.55).fillRect(0, 0, w, h);
  parts.push(veil);

  const g = scene.add.graphics().setDepth(depth + 1);
  parts.push(g);

  const state = { t: 0 };
  // Phone: the two fingers spread and close. Computer: the wheel rolls up and down.
  const draw = (k: number): void => {
    g.clear();
    if (touch) {
      const gap = Phaser.Math.Linear(26, 120, k);
      g.fillStyle(0xffffff, 0.92);
      g.fillCircle(cx - gap, cy + 40, 26);
      g.fillCircle(cx + gap, cy + 40, 26);
      g.lineStyle(10, 0xffffff, 0.5);
      g.lineBetween(cx - gap, cy + 40, cx + gap, cy + 40);
    } else {
      const bw = 64;
      const bh = 96;
      g.fillStyle(0xffffff, 0.92);
      g.fillRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 32);
      const dy = Phaser.Math.Linear(-22, 22, k);
      g.fillStyle(0x0b1020, 0.9);
      g.fillRoundedRect(cx - 6, cy - 16 + dy, 12, 22, 6);
      g.fillStyle(0xffffff, 0.9);
      g.fillTriangle(cx - 60, cy - 30, cx - 44, cy - 30, cx - 52, cy - 46);
      g.fillTriangle(cx - 60, cy + 30, cx - 44, cy + 30, cx - 52, cy + 46);
    }
  };

  scene.tweens.add({ targets: veil, alpha: 1, duration: FADE_MS });
  scene.tweens.addCounter({
    from: 0,
    to: LOOPS * 2,
    duration: LOOPS * LOOP_MS * 2,
    onUpdate: (tw) => {
      state.t = tw.getValue() ?? 0;
      // Triangle wave 0→1→0 for each loop.
      const phase = state.t % 2;
      draw(phase <= 1 ? phase : 2 - phase);
    },
    onComplete: () => dismiss(),
  });

  let gone = false;
  const dismiss = (): void => {
    if (gone) return;
    gone = true;
    scene.input.off('pointerdown', dismiss);
    scene.tweens.add({
      targets: [veil, g],
      alpha: 0,
      duration: FADE_MS,
      onComplete: () => parts.forEach((p) => p.destroy()),
    });
  };
  scene.input.on('pointerdown', dismiss);
  scene.events.once('shutdown', dismiss);
}
