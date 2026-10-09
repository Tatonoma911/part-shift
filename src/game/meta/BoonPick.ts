import Phaser from 'phaser';
import { t } from '../../i18n';
import { calmFx } from '../comfort';
import { C, FONT, FONT_NUM, INK, LANDSCAPE, VIEW } from '../layout';
import { plate, TXT } from '../ui';
import { boonIcon } from './art';
import { onTap, shade } from './kit';

/**
 * Cache pick 1 of 3 (design/META.md §8, data/boons.json, UI_SPEC §11.3).
 * Phone: three wide cards stacked, thumb-reachable. Wide screen: three tall
 * cards side by side. Solo: the caller pauses the run while this is open.
 * Online: pass `seconds`, the first card is taken when time runs out.
 */
export interface BoonOffer {
  id: string;
  rare: boolean;
  /** How many of this boon the player already has (for "×2"). */
  stacks?: number;
}

export function pickBoon(scene: Phaser.Scene, offers: BoonOffer[], onPick: (id: string, auto: boolean) => void, opts: { seconds?: number; depth?: number } = {}): Phaser.GameObjects.Container {
  const W = VIEW.width;
  const H = VIEW.height;
  const root = scene.add.container(0, 0).setDepth(opts.depth ?? 40);
  root.add(shade(scene, W, H, 0.84));
  let done = false;
  const calm = calmFx();

  const titleY = LANDSCAPE ? 70 : 200;
  const caps = scene.add.text(W / 2, titleY, t('boon.pick.title').toUpperCase(), { ...TXT.caps('#9FF4FF'), fontSize: LANDSCAPE ? '22px' : '24px', align: 'center', wordWrap: { width: W - 80 } }).setOrigin(0.5);
  const hint = scene.add.text(W / 2, titleY + 44, t('boon.pick.hint'), { ...TXT.body(22, '#C9E2EA', '500'), align: 'center', wordWrap: { width: W - 120 } }).setOrigin(0.5, 0);
  root.add([caps, hint]);

  const cards: Phaser.GameObjects.Container[] = [];
  const list = offers.slice(0, 3);
  const pick = (i: number, auto = false) => {
    if (done) return;
    done = true;
    const chosen = cards[i];
    cards.forEach((c, k) => {
      if (k === i) return;
      scene.tweens.add({ targets: c, alpha: 0, y: c.y + 60, duration: calm ? 120 : 260, ease: 'Cubic.in' });
    });
    scene.tweens.add({ targets: chosen, scale: calm ? 1 : 1.05, duration: 160, yoyo: true, ease: 'Sine.out' });
    const flash = scene.add.graphics();
    flash.fillStyle(C.seam, calm ? 0.12 : 0.35);
    flash.fillRect(0, 0, W, H);
    root.add(flash);
    scene.tweens.add({ targets: flash, alpha: 0, duration: 420 });
    scene.tweens.add({
      targets: root,
      alpha: 0,
      delay: 520,
      duration: 220,
      onComplete: () => {
        root.destroy();
        onPick(list[i].id, auto);
      },
    });
  };

  list.forEach((o, i) => {
    let cw: number;
    let ch: number;
    let cx: number;
    let cy: number;
    if (LANDSCAPE) {
      cw = 440;
      ch = 560;
      cx = W / 2 + (i - 1) * (cw + 40) - cw / 2;
      cy = 190;
    } else {
      cw = W - 80;
      ch = 262;
      cx = 40;
      cy = 330 + i * (ch + 26);
    }
    const c = scene.add.container(cx + cw / 2, cy + ch / 2);
    const g = scene.add.graphics();
    plate(g, -cw / 2, -ch / 2, cw, ch, 26);
    if (o.rare) {
      g.lineStyle(4, C.amber, 1);
      g.strokeRect(-cw / 2 + 12, -ch / 2 + 12, cw - 24, ch - 24);
    }
    c.add(g);
    const name = t(`boon.${o.id}.name`);
    const desc = t(`boon.${o.id}.desc`);
    const line = t(`boon.${o.id}.line`);
    if (LANDSCAPE) {
      c.add(boonIcon(scene, 0, -ch / 2 + 110, 130, o.id, o.rare));
      const nmL = scene.add.text(0, -ch / 2 + 205, name, { ...TXT.num(30, INK.graphite), align: 'center', wordWrap: { width: cw - 60 } }).setOrigin(0.5, 0);
      c.add(nmL);
      c.add(scene.add.text(0, nmL.y + nmL.height + 14, desc, { ...TXT.body(22, INK.graphite, '500'), align: 'center', wordWrap: { width: cw - 70 }, lineSpacing: 4 }).setOrigin(0.5, 0));
      c.add(scene.add.text(0, ch / 2 - 40, line, { fontFamily: FONT, fontStyle: 'italic 500', fontSize: '18px', color: INK.dim, align: 'center', wordWrap: { width: cw - 70 } }).setOrigin(0.5, 1));
    } else {
      const ix = -cw / 2 + 110;
      c.add(boonIcon(scene, ix, 0, 140, o.id, o.rare));
      const tx = -cw / 2 + 210;
      const tw = cw - 250;
      const nm = scene.add.text(tx, -ch / 2 + 34, name, { ...TXT.num(29, INK.graphite), wordWrap: { width: tw - (o.rare ? 120 : 0) } });
      if (nm.width > tw) nm.setScale(tw / nm.width);
      c.add(nm);
      const d = scene.add.text(tx, nm.y + nm.displayHeight + 10, desc, { ...TXT.body(22, INK.graphite, '500'), wordWrap: { width: tw }, lineSpacing: 3 });
      c.add(d);
      c.add(scene.add.text(tx, ch / 2 - 30, line, { fontFamily: FONT, fontStyle: 'italic 500', fontSize: '18px', color: INK.dim, wordWrap: { width: tw } }).setOrigin(0, 1));
    }
    if (o.rare) {
      const tag = scene.add.graphics();
      const tw2 = 118;
      tag.fillStyle(C.amber, 1);
      tag.fillRect(cw / 2 - tw2 - 26, -ch / 2 - 14, tw2, 34);
      c.add(tag);
      c.add(scene.add.text(cw / 2 - tw2 / 2 - 26, -ch / 2 + 3, t('boon.rare'), { fontFamily: FONT_NUM, fontStyle: '800', fontSize: '15px', color: '#10171C', letterSpacing: 1.6 }).setOrigin(0.5));
    }
    if (o.stacks) {
      c.add(
        scene.add
          .text(cw / 2 - 30, ch / 2 - 26, t('boon.stack', { value: o.stacks + 1 }), { fontFamily: FONT_NUM, fontStyle: '800', fontSize: '22px', color: INK.teal })
          .setOrigin(1, 1),
      );
    }
    const hit = scene.add.zone(0, 0, cw, ch).setInteractive({ useHandCursor: true });
    onTap(hit, () => pick(i));
    hit.on('pointerover', () => !done && scene.tweens.add({ targets: c, scale: 1.02, duration: 120 }));
    hit.on('pointerout', () => !done && scene.tweens.add({ targets: c, scale: 1, duration: 120 }));
    c.add(hit);
    root.add(c);
    cards.push(c);
    // Cards deal in one after another from below.
    c.setAlpha(0).setY(c.y + 80);
    scene.tweens.add({ targets: c, alpha: 1, y: c.y - 80, delay: 120 + i * (calm ? 40 : 110), duration: calm ? 160 : 340, ease: 'Back.out' });
  });

  if (opts.seconds) {
    let left = opts.seconds;
    const timerY = LANDSCAPE ? H - 80 : 330 + 3 * 288 + 30;
    const timer = scene.add.text(W / 2, timerY, t('boon.pick.timer', { value: left }), TXT.num(26, '#FFFFFF')).setOrigin(0.5);
    root.add(timer);
    const ev = scene.time.addEvent({
      delay: 1000,
      repeat: left - 1,
      callback: () => {
        left--;
        if (!timer.active) return ev.remove();
        timer.setText(t('boon.pick.timer', { value: left }));
        if (left <= 3) timer.setColor('#FF8A9B');
        if (left <= 0) pick(0, true);
      },
    });
  }
  return root;
}
