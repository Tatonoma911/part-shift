import Phaser from 'phaser';
import { hasText, t } from '../../i18n';
import { sound } from '../audio';
import { calmFx } from '../comfort';
import { C, FONT, INK, LANDSCAPE, VIEW } from '../layout';
import { chip, plate, TXT } from '../ui';
import { portrait, rankBadge } from './art';
import { bar, button, fmtNum, fmtTime, shade } from './kit';
import { FEMALE, rankAt, rankFraction } from './store';

/**
 * "Итоги смены" (design/META.md §5, UI_SPEC §11.1): what the player takes away
 * from every run, a win or a loss. Blocks appear one after another; a tap
 * anywhere speeds the rest up ×8. Then, if a hero returned, a full-screen card.
 */
export interface ResultsView {
  outcome: 'win' | 'lose' | 'quit';
  seconds: number;
  /** difficulty id: intern | shift | rush */
  difficulty: string;
  newRecord: boolean;
  /** Score lines in order, text keys from results.score.* with {value}. */
  lines: { key: string; value: number }[];
  /** Multipliers, text keys results.score.mult_* with their params. */
  mults: { key: string; params: Record<string, string | number> }[];
  total: number;
  /** Lifetime score before this run (rank bar starts here). */
  scoreBefore: number;
  /** Up to 3 unlock conditions that moved, closest first. */
  progress: { heroId: string; label: string; from: number; to: number; need: number }[];
  /** Shown when nothing moved: the closest hero and its progress text. */
  closest?: { heroId: string; text: string };
  /** Hero that returned in this run, if any. */
  unlocked?: string;
}

export interface ResultsActions {
  again: () => void;
  dossier: () => void;
  menu: () => void;
  /** "Взять в следующую смену" on the unlock card. */
  takeNext?: (heroId: string) => void;
  /** Smaller buttons under the main ones, two per row (share, ranking, donation). */
  extra?: { label: string; act: () => void }[];
}

const W = () => VIEW.width;
const H = () => VIEW.height;

export function showResults(scene: Phaser.Scene, v: ResultsView, act: ResultsActions, depth = 40): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0).setDepth(depth);
  let speed = calmFx() ? 4 : 1;
  const tweens: Phaser.Tweens.Tween[] = [];
  let timer: Phaser.Time.TimerEvent | undefined;
  root.add(
    shade(scene, W(), H(), 0.62, () => {
      // Tap speeds up what is left of the sequence.
      speed = 8;
      for (const tw of tweens) tw.timeScale = 8;
      if (timer) timer.timeScale = 8;
    }),
  );
  const tween = (cfg: Phaser.Types.Tweens.TweenBuilderConfig) => {
    const tw = scene.tweens.add(cfg);
    tw.timeScale = speed;
    tweens.push(tw);
    return tw;
  };

  // Phone: one column. Wide screen: score on the left, rank, heroes and buttons on the right.
  const pw = LANDSCAPE ? Math.min(1240, W() - 80) : Math.min(724, W() - 56);
  const px = (W() - pw) / 2;
  const body = scene.add.container(px, 0);
  const bg = scene.add.graphics();
  body.add(bg);
  root.add(body);
  let pad = 44;
  let iw = LANDSCAPE ? pw / 2 - 66 : pw - pad * 2;
  let y = 52;
  const steps: { at: number; run: () => void }[] = [];
  const reveal = (objs: Phaser.GameObjects.GameObject[], at: number, dy = 18) => {
    for (const o of objs) (o as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(0);
    steps.push({
      at,
      run: () => {
        for (const o of objs) {
          const tr = o as unknown as { y: number; alpha: number };
          const y0 = tr.y;
          tr.y = y0 + dy;
          tween({ targets: o, alpha: 1, y: y0, duration: 260, ease: 'Cubic.out' });
        }
      },
    });
  };
  let at = 200;

  // 1. Outcome.
  const win = v.outcome === 'win';
  const titleKey = win ? 'results.title_win' : v.outcome === 'lose' ? 'results.title_lose' : 'results.title_quit';
  const head: Phaser.GameObjects.GameObject[] = [];
  if (v.newRecord) {
    // Record badge on its own line above the title, so a long title never runs into it.
    const rb = scene.add.graphics();
    const label = scene.add.text(0, 0, t('results.new_record').toUpperCase(), { ...TXT.caps('#10171C'), fontSize: '15px' });
    const bw = label.width + 28;
    chip(rb, pad, y - 8, bw, 36, C.amber, 1, 10);
    label.setPosition(pad + 14, y + 1);
    head.push(rb, label);
    y += 44;
  }
  const stripe = scene.add.graphics();
  stripe.fillStyle(win ? C.teal : v.outcome === 'lose' ? C.coralInk : C.graphite, 1);
  stripe.fillRect(pad, y, 8, 92);
  head.push(stripe);
  const title = scene.add.text(pad + 28, y - 4, t(titleKey), TXT.num(42, INK.graphite));
  if (title.width > iw - 28) title.setScale((iw - 28) / title.width);
  head.push(title);
  const sub = `${t('results.time', { time: fmtTime(v.seconds) })}  ·  ${t('results.difficulty', { name: t(`difficulty.${v.difficulty}.name`) })}`;
  head.push(scene.add.text(pad + 30, y + 60, sub, TXT.body(23, INK.dim, '600')));
  body.add(head);
  reveal(head, at);
  y += 122;

  // 2. Score lines run up one by one, then multipliers and the total.
  const capsScore = scene.add.text(pad, y, t('results.score.title').toUpperCase(), TXT.caps());
  body.add(capsScore);
  reveal([capsScore], (at += 300));
  y += 40;
  for (const ln of v.lines) {
    const label = t(ln.key, { value: '' }).replace(/[:\s+]+$/, '');
    const l = scene.add.text(pad, y, label, TXT.body(24, INK.graphite, '500'));
    const n = scene.add.text(pad + iw, y, '+0', TXT.num(24, INK.teal)).setOrigin(1, 0);
    body.add([l, n]);
    reveal([l, n], (at += 170), 10);
    steps.push({
      at: at + 40,
      run: () => {
        const o = { v: 0 };
        tween({ targets: o, v: ln.value, duration: 420, ease: 'Cubic.out', onUpdate: () => n.setText(`+${fmtNum(o.v)}`), onComplete: () => n.setText(`+${fmtNum(ln.value)}`) });
      },
    });
    y += 38;
  }
  for (const m of v.mults) {
    const txt = t(m.key, m.params);
    const [label, value] = txt.includes(': ') ? txt.split(/: (?=[^:]*$)/) : [txt, ''];
    const l = scene.add.text(pad, y, label, TXT.body(24, INK.dim, '500'));
    const n = scene.add.text(pad + iw, y, value, TXT.num(24, INK.cobalt)).setOrigin(1, 0);
    body.add([l, n]);
    reveal([l, n], (at += 170), 10);
    y += 38;
  }
  const div = scene.add.graphics();
  div.fillStyle(C.graphite, 0.12);
  div.fillRect(pad, y + 6, iw, 2);
  const totalL = scene.add.text(pad, y + 20, t('results.score.total', { value: '' }).replace(/[:\s]+$/, ''), TXT.num(30, INK.graphite));
  const totalN = scene.add.text(pad + iw, y + 14, '0', TXT.num(40, INK.graphite)).setOrigin(1, 0);
  body.add([div, totalL, totalN]);
  reveal([div, totalL, totalN], (at += 260), 8);
  steps.push({
    at: at + 40,
    run: () => {
      const o = { v: 0 };
      tween({ targets: o, v: v.total, duration: 600, ease: 'Cubic.out', onUpdate: () => totalN.setText(fmtNum(o.v)), onComplete: () => totalN.setText(fmtNum(v.total)) });
      tween({ targets: totalN, scale: 1.12, duration: 140, yoyo: true, delay: 600 });
    },
  });
  y += 76;
  if (v.outcome !== 'win' && hasText('results.score.loss_note')) {
    const note = scene.add.text(pad, y, t('results.score.loss_note'), { fontFamily: FONT, fontStyle: 'italic 500', fontSize: '19px', color: INK.dim, wordWrap: { width: iw } });
    body.add(note);
    reveal([note], at + 300, 6);
    y += note.height + 16;
  }

  // 3. Rank: the bar fills by this run's score; a rank-up plate slides in.
  let leftBottom = 0;
  if (LANDSCAPE) {
    leftBottom = y;
    pad = pw / 2 + 22;
    y = 52;
  }
  y += 10;
  const before = rankAt(v.scoreBefore);
  const after = rankAt(v.scoreBefore + v.total);
  const rankG = scene.add.graphics();
  rankBadge(rankG, pad + 40, y + 46, 76, after.index);
  const rankCaps = scene.add.text(pad + 100, y, t('results.rank.title').toUpperCase(), TXT.caps());
  const rankName = scene.add.text(pad + 100, y + 28, t(`rank.${before.rank.id}`), TXT.num(26, INK.graphite));
  const rankBar = scene.add.graphics();
  const nextLine = scene.add.text(pad + 100, y + 96, '', TXT.body(20, INK.dim, '500'));
  body.add([rankG, rankCaps, rankName, rankBar, nextLine]);
  const barX = pad + 100;
  const barW = iw - 100;
  const f0 = before.index === after.index ? rankFraction(v.scoreBefore) : 0;
  bar(rankBar, barX, y + 74, barW, 12, f0, C.teal);
  const nextText = () =>
    after.next ? t('results.rank.to_next', { rank: t(`rank.${after.next.id}`), value: fmtNum(after.next.from - v.scoreBefore - v.total) }) : t('rank.max');
  reveal([rankG, rankCaps, rankName, rankBar, nextLine], (at += 520));
  const rankY = y;
  steps.push({
    at: at + 120,
    run: () => {
      const o = { f: f0 };
      const f1 = rankFraction(v.scoreBefore + v.total);
      tween({
        targets: o,
        f: f1,
        duration: 700,
        ease: 'Cubic.out',
        onUpdate: () => {
          rankBar.clear();
          bar(rankBar, barX, rankY + 74, barW, 12, o.f, C.teal, f0);
        },
        onComplete: () => {
          nextLine.setText(nextText());
          if (after.index > before.index) rankUp();
        },
      });
    },
  });
  const rankUp = () => {
    rankName.setText(t(`rank.${after.rank.id}`));
    const list = after.rank.unlocksBoons.map((b) => t(`boon.${b}.name`)).join(', ');
    const msg = `${t('results.rank.up', { rank: t(`rank.${after.rank.id}`) })}${list ? `. ${t('results.rank.unlocks', { list })}` : ''}`;
    const plateC = scene.add.container(pad + iw / 2, 0);
    const pg = scene.add.graphics();
    const tx = scene.add.text(0, 0, msg, { ...TXT.body(22, '#10171C', '700'), align: 'center', wordWrap: { width: iw - 40 } }).setOrigin(0.5);
    const ph = tx.height + 28;
    chip(pg, -iw / 2, -ph / 2, iw, ph, C.amber, 1, 14);
    plateC.y = rankY + 132 + ph / 2;
    plateC.add([pg, tx]);
    body.add(plateC);
    plateC.setScale(0.6).setAlpha(0);
    tween({ targets: plateC, scale: 1, alpha: 1, duration: 300, ease: 'Back.out' });
    sound.play('ui_tap');
  };
  y += 140;
  // A rank-up plate slides into this reserved row (known in advance, so nothing jumps).
  if (after.index > before.index) y += 110;

  // 4. Heroes: who moved closer to coming back.
  const progCaps = scene.add.text(pad, y, t('results.progress.title').toUpperCase(), TXT.caps());
  body.add(progCaps);
  reveal([progCaps], (at += 700));
  y += 42;
  const rows = v.progress.slice(0, 3);
  if (rows.length) {
    for (const p of rows) {
      const por = portrait(scene, pad + 34, y + 34, 32, p.heroId, 'seen');
      const name = scene.add.text(pad + 84, y + 4, t('results.progress.line', { name: p.label, from: p.from, to: p.to, need: p.need }), TXT.body(22, INK.graphite, '600'));
      const pb = scene.add.graphics();
      bar(pb, pad + 84, y + 44, iw - 84, 10, p.to / p.need, C.seam, p.from / p.need);
      body.add([por, name, pb]);
      reveal([por, name, pb], (at += 200), 10);
      y += 80;
    }
  } else if (v.closest) {
    const por = portrait(scene, pad + 34, y + 34, 32, v.closest.heroId, 'seen');
    const name = scene.add.text(pad + 84, y + 18, v.closest.text, { ...TXT.body(22, INK.graphite, '600'), wordWrap: { width: iw - 84 } });
    body.add([por, name]);
    reveal([por, name], (at += 200), 10);
    y += 80;
  }

  // 5. Control's comment, then the buttons.
  const pool = win ? 'results.control_win' : 'results.control_lose';
  const ctl = scene.add.text(pad + iw / 2, y + 8, `${t('control.prefix')} ${t(`${pool}.${1 + Math.floor(Math.random() * 3)}`)}`, {
    fontFamily: FONT,
    fontStyle: 'italic 500',
    fontSize: '19px',
    color: INK.deep,
    align: 'center',
    wordWrap: { width: iw },
  }).setOrigin(0.5, 0);
  body.add(ctl);
  reveal([ctl], (at += 260), 6);
  y += ctl.height + 34;
  const btns = [
    ...button(scene, pad, y, iw, 100, t('results.again'), act.again, true, 31),
    ...button(scene, pad, y + 116, iw / 2 - 8, 84, t('results.dossier'), act.dossier),
    ...button(scene, pad + iw / 2 + 8, y + 116, iw / 2 - 8, 84, t('results.menu'), act.menu),
  ];
  const extra = act.extra ?? [];
  extra.forEach((b, i) => {
    const bx = pad + (i % 2) * (iw / 2 + 8);
    const by = y + 116 + 84 + 16 + Math.floor(i / 2) * 84;
    btns.push(...button(scene, bx, by, i % 2 === 0 && i === extra.length - 1 ? iw : iw / 2 - 8, 70, b.label, b.act, false, 24));
  });
  body.add(btns);
  reveal(btns, (at += 200), 12);
  y += 116 + 84 + 40 + Math.ceil(extra.length / 2) * 84;
  y = Math.max(y, leftBottom + 40);
  if (LANDSCAPE) {
    const sep = scene.add.graphics();
    sep.fillStyle(C.graphite, 0.08);
    sep.fillRect(pw / 2, 50, 2, y - 100);
    body.add(sep);
  }

  // Plate behind everything; scale down if a long list does not fit the screen.
  plate(bg, 0, 0, pw, y, 30);
  const room = H() - 60;
  const s = Math.min(1, room / y);
  body.setScale(s);
  body.x = (W() - pw * s) / 2;
  body.y = Math.max(30, (H() - y * s) / 2);
  body.setAlpha(0);
  tween({ targets: body, alpha: 1, duration: 200 });

  // Run the steps on their own clock so a tap can speed it up.
  steps.sort((a, b) => a.at - b.at);
  let i = 0;
  let last = 0;
  const next = () => {
    if (!root.active) return;
    while (i < steps.length && steps[i].at <= last) steps[i++].run();
    if (i >= steps.length) {
      timer = undefined;
      if (v.unlocked) scene.time.delayedCall(900 / speed, () => root.active && heroReturned(scene, v.unlocked!, act, depth + 1));
      return;
    }
    const wait = steps[i].at - last;
    last = steps[i].at;
    timer = scene.time.delayedCall(wait, next);
    timer.timeScale = speed;
  };
  next();
  return root;
}

/** Full-screen card when a hero comes back (META.md §5 step 5). */
export function heroReturned(scene: Phaser.Scene, id: string, act: Pick<ResultsActions, 'takeNext'>, depth = 41): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0).setDepth(depth);
  root.add(shade(scene, W(), H(), 0.8));
  const cx = W() / 2;
  const cy = Math.min(H() * 0.36, 520);
  const calm = calmFx();
  // Seam burst behind the portrait.
  const burst = scene.add.graphics();
  for (let k = 0; k < 16; k++) {
    const a = (Math.PI * 2 * k) / 16;
    burst.fillStyle(k % 2 ? C.seam : C.glow, 0.5);
    burst.fillTriangle(cx, cy, cx + Math.cos(a - 0.09) * 420, cy + Math.sin(a - 0.09) * 420, cx + Math.cos(a + 0.09) * 420, cy + Math.sin(a + 0.09) * 420);
  }
  burst.setAlpha(0.6);
  root.add(burst);
  if (!calm) scene.tweens.add({ targets: burst, angle: 360, duration: 24000, repeat: -1 });
  const por = portrait(scene, cx, cy, 170, id, 'unlocked');
  root.add(por);
  const female = FEMALE.has(id);
  const name = t(`enemy.${id}.name`);
  const pw = Math.min(724, W() - 56);
  const card = scene.add.container((W() - pw) / 2, cy + 210);
  const g = scene.add.graphics();
  card.add(g);
  let y = 40;
  const caps = scene.add.text(pw / 2, y, t('unlock.screen.title').toUpperCase(), TXT.caps(INK.teal)).setOrigin(0.5, 0);
  const nm = scene.add.text(pw / 2, y + 34, name, TXT.num(46, INK.graphite)).setOrigin(0.5, 0);
  y += 100;
  const tx = scene.add.text(pw / 2, y, t(female ? 'unlock.screen.text_female' : 'unlock.screen.text', { hero: name }), { ...TXT.body(23, INK.dim, '500'), align: 'center', wordWrap: { width: pw - 90 } }).setOrigin(0.5, 0);
  y += tx.height + 20;
  const ally = scene.add.text(pw / 2, y + 16, t(`ally.${id}.desc`), { ...TXT.body(22, INK.graphite, '600'), align: 'center', wordWrap: { width: pw - 120 } }).setOrigin(0.5, 0);
  const ag = scene.add.graphics();
  chip(ag, 40, y, pw - 80, ally.height + 32, C.seam, 0.16, 14, { color: C.teal, width: 2 });
  y += ally.height + 52;
  const line = hasText(`unlock.${id}.line`)
    ? scene.add.text(pw / 2, y, `«${t(`unlock.${id}.line`)}»`, { fontFamily: FONT, fontStyle: 'italic 500', fontSize: '20px', color: INK.deep, align: 'center', wordWrap: { width: pw - 90 } }).setOrigin(0.5, 0)
    : undefined;
  if (line) y += line.height + 24;
  const close = () => {
    scene.tweens.add({ targets: root, alpha: 0, duration: 200, onComplete: () => root.destroy() });
  };
  const btns = [
    ...button(scene, 40, y, pw - 80, 96, t('results.take_next'), () => {
      act.takeNext?.(id);
      close();
    }, true),
    ...button(scene, 40, y + 110, pw - 80, 80, t('unlock.screen.ok'), close),
  ];
  y += 110 + 80 + 36;
  plate(g, 0, 0, pw, y, 30);
  card.add([caps, nm, tx, ag, ally, ...(line ? [line] : []), ...btns]);
  root.add(card);
  // Fit tall content on short screens.
  const bottom = cy + 210 + y;
  if (bottom > H() - 20) {
    const k = (H() - 40) / bottom;
    root.setScale(k);
    root.x = (W() - W() * k) / 2;
  }
  por.setScale(0.3).setAlpha(0);
  scene.tweens.add({ targets: por, scale: 1, alpha: 1, duration: calm ? 200 : 520, ease: 'Back.out' });
  card.setAlpha(0);
  card.y += 40;
  scene.tweens.add({ targets: card, alpha: 1, y: card.y - 40, delay: 300, duration: 320, ease: 'Cubic.out' });
  return root;
}
