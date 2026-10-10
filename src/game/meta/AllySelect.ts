import Phaser from 'phaser';
import { t } from '../../i18n';
import { C, FONT, INK, VIEW } from '../layout';
import { plate, TXT } from '../ui';
import { portrait } from './art';
import { button, onTap, shade } from './kit';
import { allySlots, HEROES, pickAllies, type MetaSave } from './store';

/**
 * "Кого взять на смену" before a run (design/META.md §4, HEROES.md §4,
 * UI_SPEC §11.4): 1–3 slots at the top, returned heroes below. Tap a hero to
 * put them in the first free slot, tap a slot to empty it. The last choice is
 * remembered (meta.allyChoice).
 */
export function allySelect(scene: Phaser.Scene, meta: MetaSave, onGo: (ids: string[]) => void, onBack: () => void, depth = 45): Phaser.GameObjects.Container {
  const W = VIEW.width;
  const H = VIEW.height;
  const root = scene.add.container(0, 0).setDepth(depth);
  root.add(shade(scene, W, H, 0.6));
  const pw = Math.min(724, W - 56);
  const panel = scene.add.container(0, 0);
  root.add(panel);
  const { slots } = allySlots(meta);
  const unlocked = HEROES.filter((h) => meta.unlocked.includes(h.id));
  let chosen = meta.allyChoice.filter((id) => meta.unlocked.includes(id)).slice(0, slots);
  // Free slots start filled, so «На смену» never silently leaves one empty (QA-044); a tap still takes a hero off.
  for (const h of unlocked) if (chosen.length < slots && !chosen.includes(h.id)) chosen.push(h.id);

  const draw = () => {
    panel.removeAll(true);
    const g = scene.add.graphics();
    panel.add(g);
    const pad = 40;
    const iw = pw - pad * 2;
    let y = 44;
    panel.add(scene.add.text(pw / 2, y, t('ally.select.title'), TXT.num(34, INK.graphite)).setOrigin(0.5, 0));
    y += 56;
    panel.add(scene.add.text(pw / 2, y, t('ally.select.slots', { value: slots }).toUpperCase(), TXT.caps()).setOrigin(0.5, 0));
    y += 44;

    // Slots: filled, free or locked.
    const sr = 74;
    const sx = (i: number) => pw / 2 + (i - 1) * (sr * 2 + 50);
    for (let i = 0; i < 3; i++) {
      const x = sx(i);
      const cy = y + sr;
      const id = chosen[i];
      if (i >= slots) {
        const lg = scene.add.graphics();
        lg.fillStyle(C.graphite, 0.08);
        lg.fillCircle(x, cy, sr);
        // Padlock.
        lg.fillStyle(C.graphite, 0.35);
        lg.fillRoundedRect(x - 20, cy - 4, 40, 32, 6);
        lg.lineStyle(7, C.graphite, 0.35);
        lg.beginPath();
        lg.arc(x, cy - 6, 13, Math.PI, 0);
        lg.strokePath();
        panel.add(lg);
        const lockKey = i === 1 ? 'ally.select.slot_locked_5' : 'ally.select.slot_locked_10';
        panel.add(scene.add.text(x, cy + sr + 12, t(lockKey), { ...TXT.body(15, INK.dim, '500'), align: 'center', wordWrap: { width: sr * 2 + 40 } }).setOrigin(0.5, 0));
      } else if (id) {
        panel.add(portrait(scene, x, cy, sr, id, 'unlocked'));
        panel.add(scene.add.text(x, cy + sr + 14, t(`enemy.${id}.name`), TXT.num(19, INK.graphite)).setOrigin(0.5, 0));
        const hit = scene.add.zone(x, cy, sr * 2, sr * 2).setInteractive({ useHandCursor: true });
        onTap(hit, () => {
          chosen = chosen.filter((c) => c !== id);
          draw();
        });
        panel.add(hit);
      } else {
        const eg = scene.add.graphics();
        eg.lineStyle(4, C.seam, 1);
        for (let k = 0; k < 24; k += 2) {
          eg.beginPath();
          eg.arc(x, cy, sr - 2, (Math.PI * 2 * k) / 24, (Math.PI * 2 * (k + 1)) / 24);
          eg.strokePath();
        }
        eg.fillStyle(C.seam, 1);
        eg.fillRect(x - 3, cy - 18, 6, 36);
        eg.fillRect(x - 18, cy - 3, 36, 6);
        panel.add(eg);
      }
    }
    y += sr * 2 + 70;
    const div = scene.add.graphics();
    div.fillStyle(C.graphite, 0.1);
    div.fillRect(pad, y, iw, 2);
    panel.add(div);
    y += 22;

    // Returned heroes.
    if (!unlocked.length) {
      panel.add(scene.add.text(pw / 2, y + 30, t('ally.select.empty'), { ...TXT.body(23, INK.dim, '600'), align: 'center', wordWrap: { width: iw } }).setOrigin(0.5, 0));
      y += 120;
    } else {
      const cols = 5;
      const cell = iw / cols;
      const r = 46;
      unlocked.forEach((h, i) => {
        const x = pad + cell * (i % cols) + cell / 2;
        const cy = y + Math.floor(i / cols) * 140 + r + 6;
        const on = chosen.includes(h.id);
        const por = portrait(scene, x, cy, r, h.id, 'unlocked');
        if (on) por.setAlpha(0.35);
        panel.add(por);
        const nm = scene.add.text(x, cy + r + 12, t(`enemy.${h.id}.name`), TXT.body(17, on ? INK.dim : INK.graphite, '700')).setOrigin(0.5, 0);
        if (nm.width > cell - 6) nm.setScale((cell - 6) / nm.width);
        panel.add(nm);
        const hit = scene.add.zone(x, cy + 14, cell, 130).setInteractive({ useHandCursor: true });
        onTap(hit, () => {
          if (on) chosen = chosen.filter((c) => c !== h.id);
          else if (chosen.length < slots) chosen = [...chosen, h.id];
          else chosen = [...chosen.slice(0, slots - 1), h.id];
          draw();
        });
        panel.add(hit);
      });
      y += Math.ceil(unlocked.length / cols) * 140 + 6;
      // Bonus of the heroes in the slots, so the choice is informed.
      for (const id of chosen) {
        const tx = scene.add.text(pad, y, `${t(`enemy.${id}.name`)}: ${t(`ally.${id}.desc`)}`, { ...TXT.body(19, INK.graphite, '500'), wordWrap: { width: iw }, lineSpacing: 2 });
        panel.add(tx);
        y += tx.height + 8;
      }
    }
    const note = scene.add.text(pad, y + 8, t('ally.note'), { fontFamily: FONT, fontStyle: 'italic 500', fontSize: '18px', color: INK.dim, wordWrap: { width: iw } });
    panel.add(note);
    y += note.height + 30;
    panel.add(
      button(scene, pad, y, iw, 100, t('ally.select.go'), () => {
        pickAllies(meta, chosen);
        root.destroy();
        onGo(chosen);
      }, true, 31),
    );
    y += 114;
    panel.add(
      button(scene, pad, y, iw, 80, t('menu.back'), () => {
        root.destroy();
        onBack();
      }),
    );
    y += 80 + 36;
    plate(g, 0, 0, pw, y, 30);
    const k = Math.min(1, (H - 50) / y);
    panel.setScale(k);
    panel.x = (W - pw * k) / 2;
    panel.y = Math.max(24, (H - y * k) / 2);
  };
  draw();
  return root;
}
