import Phaser from 'phaser';
import { sound } from '../audio';
import { hasText, t } from '../../i18n';
import { C, INK, LANDSCAPE, VIEW } from '../layout';
import { chip, plate, TXT } from '../ui';
import { drawWeakOrbs, TECH_HEX, weaknessesOf } from '../Vitals';
import { portrait } from './art';
import { button, onTap, shade } from './kit';
import {
  autoSquad,
  backupFactors,
  HEROES,
  heroProgress,
  HIGH_TIERS,
  isDraft,
  MAX_DRAFT,
  MAX_HIGH,
  saveSquad,
  squadSlots,
  syncLevel,
  weaknessHits,
  type DistrictEnemy,
  type MetaSave,
} from './store';

/**
 * «Сводка смены» before a run (MVP_RULES §4.5, like excluded tribes in
 * Hearthstone): the district's infected heroes on top, the player's squad
 * below. Heroes taken by the enemy are greyed out for this shift, everyone not
 * picked rests. No padlocks (§4.6): a hero not yet unlocked goes as a «черновой
 * бэкап», one per squad, with a dashed frame and its integrity in percent.
 * The card under the grid shows the focused hero: ours vs infected strength,
 * sync, ability. Replaces AllySelect. Comic layer: round comic portraits only.
 */
export function shiftBrief(
  scene: Phaser.Scene,
  meta: MetaSave,
  enemies: DistrictEnemy[],
  onGo: (squad: string[]) => void,
  onBack: () => void,
  depth = 45,
): Phaser.GameObjects.Container {
  const W = VIEW.width;
  const H = VIEW.height;
  const root = scene.add.container(0, 0).setDepth(depth);
  root.add(shade(scene, W, H, 0.7));
  const body = scene.add.container(0, 0);
  root.add(body);

  const taken = new Set(enemies.map((e) => e.id));
  const { slots, nextAt } = squadSlots(meta);
  const tierOf = (id: string) => HEROES.find((h) => h.id === id)?.tier ?? 1;
  const isHigh = (id: string) => HIGH_TIERS.includes(tierOf(id));
  const draft = (id: string) => isDraft(meta, id);
  /** Why `id` can't join `list` right now, or '' if it can. */
  const blocker = (list: string[], id: string) => {
    if (taken.has(id)) return t('squad.taken.desc');
    if (list.length >= slots) return t('squad.slots', { value: list.length, max: slots });
    if (isHigh(id) && list.filter(isHigh).length >= MAX_HIGH) return t('squad.max_high');
    if (draft(id) && list.filter(draft).length >= MAX_DRAFT) return t('backup.draft.limit');
    return '';
  };
  const valid = (ids: string[]) => ids.reduce<string[]>((out, id) => (out.includes(id) || blocker(out, id) ? out : [...out, id]), []);
  let squad = valid(meta.lastSquad ?? []);
  if (!squad.length) squad = autoSquad(meta, enemies);
  let focus = squad[0] ?? HEROES[0].id;
  let toast: Phaser.GameObjects.Container | null = null;

  const say = (text: string) => {
    toast?.destroy();
    const tx = scene.add.text(0, 0, text, { ...TXT.body(22, INK.white, '700'), align: 'center', wordWrap: { width: Math.min(560, W - 120) } }).setOrigin(0.5);
    const g = scene.add.graphics();
    chip(g, -tx.width / 2 - 24, -tx.height / 2 - 16, tx.width + 48, tx.height + 32, C.coral, 0.96, 12);
    toast = scene.add.container(W / 2, LANDSCAPE ? H - 70 : H - 390, [g, tx]).setDepth(depth + 2);
    root.add(toast);
    const box = toast;
    scene.tweens.add({ targets: box, alpha: 0, delay: 2200, duration: 300, onComplete: () => box.destroy() });
  };

  const toggle = (id: string) => {
    focus = id;
    if (squad.includes(id)) squad = squad.filter((s) => s !== id);
    else {
      const why = blocker(squad, id);
      if (why) {
        say(why);
        return draw();
      }
      squad = [...squad, id];
      sound.play('ui_tap');
    }
    draw();
  };

  /** Dashed rectangle for draft backups (Phaser has no dashed stroke). */
  const dashRect = (g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number) => {
    g.lineStyle(2.5, color, 1);
    const seg = 9;
    for (let a = x; a < x + w; a += seg * 2) {
      g.lineBetween(a, y, Math.min(a + seg, x + w), y);
      g.lineBetween(a, y + h, Math.min(a + seg, x + w), y + h);
    }
    for (let b = y; b < y + h; b += seg * 2) {
      g.lineBetween(x, b, x, Math.min(b + seg, y + h));
      g.lineBetween(x + w, b, x + w, Math.min(b + seg, y + h));
    }
  };

  // ------------------------------------------------------------ drawing

  /** One enemy card: portrait, name, lair level or call target, element and weakness orbs. */
  const enemyCard = (e: DistrictEnemy, x: number, y: number, w: number, h: number) => {
    const g = scene.add.graphics();
    const target = e.role === 'target';
    chip(g, x, y, w, h, target ? 0x2a1840 : C.graphite, target ? 1 : 0.92, 16, { color: target ? C.violet : C.coral, width: 3 });
    body.add(g);
    const r = Math.min(w * 0.3, h * 0.3, 80);
    body.add(portrait(scene, x + w / 2, y + 18 + r, r, e.id, 'seen'));
    let cy = y + 30 + r * 2;
    const name = scene.add.text(x + w / 2, cy, t(`enemy.${e.id}.name`), TXT.num(20, INK.white)).setOrigin(0.5, 0);
    if (name.width > w - 16) name.setScale((w - 16) / name.width);
    body.add(name);
    cy += 30;
    const role = target ? t('squad.target') : t('squad.lair', { value: e.tier });
    const rl = scene.add.text(x + w / 2, cy, role.toUpperCase(), { ...TXT.caps(target ? '#C9A6FF' : '#FF9AAA'), fontSize: '13px' }).setOrigin(0.5, 0);
    if (rl.width > w - 12) rl.setScale((w - 12) / rl.width);
    body.add(rl);
    cy += 28;
    // Element dot, arrow, weakness orbs; the strongest weakness spelled out under them.
    const h0 = HEROES.find((hh) => hh.id === e.id)!;
    const og = scene.add.graphics();
    const weak = weaknessesOf({ heroId: e.id });
    const ex = x + w / 2 - (weak.length ? 26 : 0);
    og.fillStyle(TECH_HEX[h0.tech] ?? 0xffffff, 1);
    og.fillCircle(ex, cy + 11, 9);
    og.lineStyle(2, 0xffffff, 0.9);
    og.strokeCircle(ex, cy + 11, 9);
    if (weak.length) {
      og.fillStyle(0xffffff, 0.6);
      og.fillTriangle(x + w / 2 - 12, cy + 6, x + w / 2 - 12, cy + 16, x + w / 2 - 6, cy + 11);
      drawWeakOrbs(og, x + w / 2 + 18, cy + 11, weak, 2);
    }
    body.add(og);
    if (weak.length) {
      const wt = scene.add.text(x + w / 2, cy + 30, t('squad.weak', { tech: t(`tech.${weak[0].tech}`) }), TXT.body(14, '#E8EEF0', '600')).setOrigin(0.5, 0);
      if (wt.width > w - 12) wt.setScale((w - 12) / wt.width);
      body.add(wt);
    }
  };

  /** One hero in the squad grid: restored (sync pips), draft (dashed, integrity %), picked or taken by the enemy. */
  const heroTile = (id: string, x: number, y: number, w: number, h: number) => {
    const isTaken = taken.has(id);
    const isDraftHero = draft(id);
    const picked = squad.includes(id);
    const dim = isTaken;
    const g = scene.add.graphics();
    if (isDraftHero && !isTaken) {
      chip(g, x, y, w, h, picked ? C.teal : 0xeef2f2, picked ? 0.16 : 0.9, 12);
      dashRect(g, x + 2, y + 2, w - 4, h - 4, picked ? C.teal : 0x8a9aa2);
    } else {
      chip(g, x, y, w, h, picked ? C.teal : C.paper, picked ? 0.16 : 0.95, 12, { color: picked ? C.teal : C.seam, width: picked ? 3 : 1.5, alpha: dim ? 0.4 : 1 });
    }
    if (id === focus && !picked) {
      g.lineStyle(3, C.graphite, 0.6);
      g.strokeRect(x - 3, y - 3, w + 6, h + 6);
    }
    body.add(g);
    const r = Math.min(w * 0.34, h * 0.28);
    const p = portrait(scene, x + w / 2, y + 10 + r, r, id, 'unlocked');
    if (isTaken) p.setAlpha(0.45);
    body.add(p);
    const nm = scene.add.text(x + w / 2, y + 16 + r * 2, t(`enemy.${id}.name`), TXT.body(16, dim ? INK.dim : INK.graphite, '700')).setOrigin(0.5, 0);
    if (nm.width > w - 8) nm.setScale((w - 8) / nm.width);
    body.add(nm);
    const info = scene.add.graphics();
    // Bottom row: tier pips on the left, element dot on the right.
    for (let k = 0; k < tierOf(id); k++) {
      info.fillStyle(C.graphite, dim ? 0.3 : 0.8);
      info.fillRect(x + 10 + k * 9, y + h - 16, 6, 6);
    }
    const tech = HEROES.find((hh) => hh.id === id)?.tech ?? 'kinetic';
    info.fillStyle(TECH_HEX[tech] ?? 0xffffff, dim ? 0.35 : 1);
    info.fillCircle(x + w - 16, y + h - 13, 7);
    body.add(info);
    const rowY = y + h - 36;
    if (isTaken) {
      const tg = scene.add.graphics();
      chip(tg, x + 4, y + r - 8, w - 8, 26, C.coral, 0.95, 8);
      body.add(tg);
      const tt = scene.add.text(x + w / 2, y + r + 5, t('squad.taken').toUpperCase(), { ...TXT.caps(INK.white), fontSize: '11px' }).setOrigin(0.5);
      if (tt.width > w - 14) tt.setScale((w - 14) / tt.width);
      body.add(tt);
    } else if (isDraftHero) {
      // Stamp over the portrait and the backup integrity (= unlock progress).
      const st = scene.add.text(0, 0, t('backup.draft.stamp'), { ...TXT.caps(INK.coral), fontSize: '12px' }).setOrigin(0.5);
      const sg = scene.add.graphics();
      sg.fillStyle(0xffffff, 0.92);
      sg.lineStyle(2, C.coral, 1);
      sg.fillRect(-st.width / 2 - 6, -11, st.width + 12, 22);
      sg.strokeRect(-st.width / 2 - 6, -11, st.width + 12, 22);
      const stamp = scene.add.container(x + w / 2, y + 10 + r * 1.7, [sg, st]).setAngle(-10);
      stamp.setScale(Math.min(1, (w - 22) / (st.width + 12)));
      body.add(stamp);
      const pct = Math.floor(heroProgress(meta, HEROES.find((hh) => hh.id === id)!).frac * 100);
      body.add(scene.add.text(x + w / 2, rowY, `${pct} %`, TXT.body(14, INK.dim, '700')).setOrigin(0.5, 0));
    } else {
      // Five sync segments.
      const lv = syncLevel(meta, id);
      const sw = Math.min(16, (w - 30) / 5);
      const sx = x + (w - (sw * 5 + 4 * 4)) / 2;
      for (let k = 0; k < 5; k++) {
        info.fillStyle(k < lv ? C.teal : C.graphite, k < lv ? 1 : 0.15);
        info.fillRect(sx + k * (sw + 4), rowY + 4, sw, 6);
      }
    }
    if (!isTaken && weaknessHits(id, enemies) > 0) {
      // Hint: this element hits an enemy weakness (not an answer, the player still decides).
      const hg = scene.add.graphics();
      hg.fillStyle(C.green, 1);
      hg.fillTriangle(x + w - 22, y + 22, x + w - 10, y + 22, x + w - 16, y + 10);
      hg.fillRect(x + w - 19, y + 22, 6, 8);
      body.add(hg);
    }
    if (picked) {
      const cg = scene.add.graphics();
      cg.fillStyle(C.teal, 1);
      cg.fillCircle(x + 18, y + 18, 13);
      cg.lineStyle(3, 0xffffff, 1);
      cg.beginPath();
      cg.moveTo(x + 11, y + 18);
      cg.lineTo(x + 16, y + 23);
      cg.lineTo(x + 25, y + 13);
      cg.strokePath();
      body.add(cg);
    }
    const hit = scene.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: !isTaken });
    onTap(hit, () => {
      if (isTaken) {
        focus = id;
        say(t('squad.taken.desc'));
        return draw();
      }
      toggle(id);
    });
    body.add(hit);
  };

  /** Card for the focused hero: «Сменщик · бэкап до вспышки», ours vs infected bars, sync, ability. */
  const focusCard = (x: number, y: number, w: number, h: number) => {
    const id = focus;
    const isDraftHero = draft(id) && !taken.has(id);
    const g = scene.add.graphics();
    chip(g, x, y, w, h, C.graphite, 0.94, 16);
    body.add(g);
    const r = Math.min(h / 2 - 14, 54);
    body.add(portrait(scene, x + 18 + r, y + h / 2, r, id, 'unlocked'));
    const tx = x + 36 + r * 2;
    const tw = w - (tx - x) - 18;
    body.add(scene.add.text(tx, y + 14, t(`enemy.${id}.name`), TXT.num(22, INK.white)));
    const sub = taken.has(id) ? t('squad.taken') : isDraftHero ? t('backup.draft') : t('card.subtitle');
    const sb = scene.add.text(tx, y + 44, sub.toUpperCase(), { ...TXT.caps(isDraftHero || taken.has(id) ? '#FF9AAA' : '#7FE3F2'), fontSize: '12px' });
    if (sb.width > tw) sb.setScale(tw / sb.width);
    body.add(sb);
    if (taken.has(id)) {
      body.add(scene.add.text(tx, y + 72, t('squad.taken.desc'), { ...TXT.body(16, '#E8EEF0', '500'), wordWrap: { width: tw } }));
      return;
    }
    // Two bars, ours vs infected: the grey shadow is the infected version (100 %).
    const f = backupFactors(meta, id);
    const bars: [string, number][] = [
      [t('card.hp', { ours: Math.round(f.hp * 100), theirs: 100 }), f.hp],
      [t('card.dmg', { ours: Math.round(f.damage * 100), theirs: 100 }), f.damage],
    ];
    const half = (tw - 16) / 2;
    bars.forEach(([label, k], i) => {
      const bx = tx + i * (half + 16);
      const lb = scene.add.text(bx, y + 68, label, TXT.body(14, '#E8EEF0', '600'));
      if (lb.width > half) lb.setScale(half / lb.width);
      body.add(lb);
      const bg = scene.add.graphics();
      bg.fillStyle(0xffffff, 0.16);
      bg.fillRect(bx, y + 92, half, 10);
      bg.fillStyle(i ? C.coral : C.green, 1);
      bg.fillRect(bx, y + 92, half * k, 10);
      body.add(bg);
    });
    // Sync (restored) or integrity (draft), then the ability (crossed out for a draft).
    const hero = HEROES.find((hh) => hh.id === id)!;
    const state = isDraftHero
      ? t('hero.copy.integrity', { value: Math.floor(heroProgress(meta, hero).frac * 100) })
      : t('sync.label', { value: syncLevel(meta, id) });
    body.add(scene.add.text(tx, y + 112, state, TXT.body(14, '#B8C4C8', '600')));
    const ab = hasText(`ally.${id}.desc`) ? t(`ally.${id}.desc`) : '';
    if (ab && h >= 140) {
      const at = scene.add.text(tx, y + 134, isDraftHero ? t('card.ability_off') : ab, {
        ...TXT.body(14, isDraftHero ? '#8A969A' : '#E8EEF0', '500'),
        wordWrap: { width: tw },
      });
      if (at.height > h - 140) at.setScale(Math.max(0.86, (h - 140) / at.height));
      body.add(at);
    }
  };

  /** Squad slots row: picked heroes (dashed ring for a draft), free dashed slots. */
  const slotRow = (x: number, y: number, w: number) => {
    const n = slots;
    const gap = 14;
    const sw = Math.min(110, (w - gap * (n - 1)) / n);
    const r = sw / 2 - 6;
    const x0 = x + (w - (sw * n + gap * (n - 1))) / 2;
    const dashed = (g: Phaser.GameObjects.Graphics, cx: number, cy: number, rr: number, color: number) => {
      g.lineStyle(3, color, 0.9);
      for (let a = 0; a < 24; a += 2) {
        g.beginPath();
        g.arc(cx, cy, rr, (a / 24) * Math.PI * 2, ((a + 1) / 24) * Math.PI * 2);
        g.strokePath();
      }
    };
    for (let i = 0; i < n; i++) {
      const cx = x0 + i * (sw + gap) + sw / 2;
      const cy = y + r + 6;
      const id = squad[i];
      if (id) {
        body.add(portrait(scene, cx, cy, r, id, 'unlocked'));
        if (draft(id)) {
          const g = scene.add.graphics();
          dashed(g, cx, cy, r + 5, C.coral);
          body.add(g);
        }
        const z = scene.add.zone(cx - r, cy - r, r * 2, r * 2).setOrigin(0).setInteractive({ useHandCursor: true });
        onTap(z, () => toggle(id));
        body.add(z);
      } else {
        const g = scene.add.graphics();
        dashed(g, cx, cy, r, C.seam);
        g.fillStyle(C.seam, 0.08);
        g.fillCircle(cx, cy, r);
        body.add(g);
        body.add(scene.add.text(cx, cy, '+', TXT.num(30, INK.teal)).setOrigin(0.5));
      }
    }
    return r * 2 + 12;
  };

  const draw = () => {
    body.removeAll(true);
    const g = scene.add.graphics();
    body.add(g);
    const pad = 36;
    const others = HEROES.map((h) => h.id);
    const focusH = 176;

    if (LANDSCAPE) {
      // PC: enemies in a column on the left, squad on the right.
      const lw = 520;
      const rw = Math.min(W - lw - pad * 3, 940);
      const lx = (W - lw - rw - pad) / 2;
      const rx = lx + lw + pad;
      plate(g, lx, 30, lw, H - 60, 26);
      plate(g, rx, 30, rw, H - 60, 26);
      body.add(scene.add.text(lx + lw / 2, 56, t('squad.title'), TXT.num(34, INK.graphite)).setOrigin(0.5, 0));
      body.add(scene.add.text(lx + lw / 2, 108, t('squad.enemies').toUpperCase(), TXT.caps(INK.coral)).setOrigin(0.5, 0));
      const cw = (lw - pad * 2 - 16) / 2;
      const ch = (H - 60 - 150 - 30 - 16) / 2;
      enemies.forEach((e, i) => enemyCard(e, lx + pad + (i % 2) * (cw + 16), 146 + Math.floor(i / 2) * (ch + 16), cw, ch));
      let y = 50;
      body.add(scene.add.text(rx + pad, y, t('squad.ours'), TXT.num(30, INK.graphite)));
      body.add(scene.add.text(rx + rw - pad, y + 10, t('squad.slots', { value: squad.length, max: slots }).toUpperCase(), TXT.caps()).setOrigin(1, 0));
      y += 48;
      // The «one more slot after N heroes» note sits right of the slot row.
      if (nextAt) body.add(scene.add.text(rx + rw - pad, y + 50, t('squad.slot_next', { need: nextAt }), { ...TXT.body(15, INK.dim, '500'), wordWrap: { width: 170 }, align: 'right' }).setOrigin(1, 0.5));
      y += slotRow(rx + pad, y, rw - pad * 2) + 8;
      const cols = 8;
      const gap = 10;
      const tw = (rw - pad * 2 - gap * (cols - 1)) / cols;
      const rows = Math.ceil(others.length / cols);
      const by = H - 30 - 22 - 76;
      const fh = 150;
      const th = Math.min(170, (by - 14 - fh - 12 - y) / rows - gap);
      others.forEach((id, i) => heroTile(id, rx + pad + (i % cols) * (tw + gap), y + Math.floor(i / cols) * (th + gap), tw, th));
      y += rows * (th + gap) + 2;
      focusCard(rx + pad, y, rw - pad * 2, fh);
      const bw = (rw - pad * 2 - 32) / 3;
      body.add(button(scene, rx + pad, by, bw, 76, t('menu.back'), onBack));
      body.add(button(scene, rx + pad + bw + 16, by, bw, 76, t('squad.auto'), () => ((squad = autoSquad(meta, enemies)), draw())));
      body.add(button(scene, rx + pad + (bw + 16) * 2, by, bw, 76, t('squad.go'), go, true));
      return;
    }

    // Phone: one tall sheet.
    const pw = W - 40;
    const x = 20;
    plate(g, x, 24, pw, H - 48, 28);
    let y = 48;
    body.add(scene.add.text(W / 2, y, t('squad.title'), TXT.num(38, INK.graphite)).setOrigin(0.5, 0));
    y += 58;
    body.add(scene.add.text(x + pad, y, t('squad.enemies').toUpperCase(), TXT.caps(INK.coral)));
    y += 32;
    const n = enemies.length;
    const gap = 12;
    const cw = (pw - pad * 2 - gap * (n - 1)) / n;
    const ch = 236;
    enemies.forEach((e, i) => enemyCard(e, x + pad + i * (cw + gap), y, cw, ch));
    y += ch + 20;
    body.add(scene.add.text(x + pad, y, t('squad.ours').toUpperCase(), TXT.caps(INK.teal)));
    body.add(scene.add.text(x + pw - pad, y, t('squad.slots', { value: squad.length, max: slots }).toUpperCase(), TXT.caps()).setOrigin(1, 0));
    y += 30;
    if (nextAt) {
      body.add(scene.add.text(x + pad, y, t('squad.slot_next', { need: nextAt }), TXT.body(15, INK.dim, '500')));
      y += 24;
    }
    y += slotRow(x + pad, y, pw - pad * 2) + 10;
    const cols = 5;
    const tg = 10;
    const tw = (pw - pad * 2 - tg * (cols - 1)) / cols;
    const rows = Math.ceil(others.length / cols);
    const by = H - 48 - 92 - 4;
    // Tiles take the room left between the slots and the focus card.
    const th = Math.min(180, (by - 96 - 16 - focusH - 14 - y) / rows - tg);
    others.forEach((id, i) => heroTile(id, x + pad + (i % cols) * (tw + tg), y + Math.floor(i / cols) * (th + tg), tw, th));
    y += rows * (th + tg) + 4;
    focusCard(x + pad, y, pw - pad * 2, focusH);
    const bw = (pw - pad * 2 - 16) / 2;
    body.add(button(scene, x + pad, by - 96, bw, 84, t('menu.back'), onBack));
    body.add(button(scene, x + pad + bw + 16, by - 96, bw, 84, t('squad.auto'), () => ((squad = autoSquad(meta, enemies)), draw())));
    body.add(button(scene, x + pad, by, pw - pad * 2, 92, t('squad.go'), go, true));
  };

  const go = () => {
    if (!squad.length) return say(t('squad.auto.desc'));
    saveSquad(meta, squad);
    sound.play('ui_tap');
    root.destroy();
    onGo(squad);
  };

  draw();
  return root;
}
