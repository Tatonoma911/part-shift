import Phaser from 'phaser';
import { hasText, t } from '../../i18n';
import { sound } from '../audio';
import { C, FONT, INK, LANDSCAPE, VIEW } from '../layout';
import { chip, plate, TXT } from '../ui';
import { drawWeakOrbs, TECH_HEX, weaknessesOf } from '../Vitals';
import { portrait, preloadMetaArt, rankBadge } from './art';
import { bar, button, fmtNum, fmtTime, onTap, plural, shade } from './kit';
import { demoMeta, metaDemo } from './preview';
import { allySlots, FEMALE, HEROES, heroProgress, heroState, loadMeta, pickAllies, RANKS, rankAt, rankFraction, stat, type HeroInfo, type MetaSave } from './store';

/**
 * "Досье" from the main menu (design/META.md §6, UI_SPEC §11.2): four tabs,
 * Heroes / Stats / Records / Rank, everything on one screen without page
 * scrolling. Tapping a hero opens their file: enemy card, how to bring them
 * back, ally bonus, Control's notes.
 */
type Tab = 'heroes' | 'stats' | 'records' | 'rank';
const TABS: Tab[] = ['heroes', 'stats', 'records', 'rank'];
const DEMO = !!import.meta.env.VITE_META_DEMO;

export class DossierScene extends Phaser.Scene {
  private meta!: MetaSave;
  private tab: Tab = 'heroes';
  private page?: Phaser.GameObjects.Container;
  private tabsG?: Phaser.GameObjects.Container;
  private back: () => void = () => this.scene.start('menu');

  constructor() {
    super('dossier');
  }

  init(data: { tab?: Tab; meta?: MetaSave; back?: () => void }): void {
    // Preview builds (VITE_META_DEMO=1) fill an empty save with sample progress so the screens can be judged.
    const saved = loadMeta();
    this.meta = data.meta ?? (DEMO && !saved.stats.runs_played ? demoMeta() : saved);
    this.tab = data.tab ?? 'heroes';
    if (data.back) this.back = data.back;
  }

  preload(): void {
    preloadMetaArt(this);
  }

  create(): void {
    const W = VIEW.width;
    const g = this.add.graphics();
    g.fillGradientStyle(0xeaf5f8, 0xeaf5f8, C.sky2, C.sky2, 1);
    g.fillRect(0, 0, W, VIEW.height);
    const x0 = this.x0();
    this.add.text(x0, 64, t('dossier.title'), TXT.num(48, INK.graphite)).setOrigin(0, 0.5);
    this.add.text(x0 + 4, 108, t('rank.current', { rank: t(`rank.${rankAt(stat(this.meta, 'total_score')).rank.id}`) }).toUpperCase(), TXT.caps());
    this.add.existing(this.add.container(0, 0, button(this, x0 + this.cw() - 180, 34, 180, 64, t('menu.back'), () => this.back(), false, 24)));
    this.drawTabs();
    this.show(this.tab);
    if (DEMO) {
      // One chip that walks through the other meta screens with sample data.
      let k = 0;
      const shows = ['results', 'boon', 'allies', 'unlock', 'lose'];
      this.add.existing(
        this.add.container(0, 0, button(this, x0 + this.cw() - 400, 34, 200, 64, 'Демо ▸', () => metaDemo(this, shows[k++ % shows.length], this.meta), false, 22)),
      );
    }
  }

  /** Content width and left edge: a phone column, or a wide centred panel on PC. */
  private cw(): number {
    return LANDSCAPE ? 1440 : VIEW.width - 64;
  }

  private x0(): number {
    return (VIEW.width - this.cw()) / 2;
  }

  private drawTabs(): void {
    this.tabsG?.destroy();
    const c = this.add.container(0, 0);
    const x0 = this.x0();
    const n = TABS.length;
    const gap = 10;
    const tw = (this.cw() - gap * (n - 1)) / n;
    TABS.forEach((id, i) => {
      const x = x0 + i * (tw + gap);
      const on = id === this.tab;
      const g = this.add.graphics();
      chip(g, x, 146, tw, 66, on ? C.graphite : C.paper, on ? 1 : 0.9, 14, on ? undefined : { color: C.seam, width: 2 });
      const tx = this.add.text(x + tw / 2, 179, t(`dossier.tab.${id}`), TXT.body(LANDSCAPE ? 24 : 22, on ? INK.white : INK.graphite, '700')).setOrigin(0.5);
      if (tx.width > tw - 16) tx.setScale((tw - 16) / tx.width);
      const hit = this.add.zone(x, 146, tw, 66).setOrigin(0).setInteractive({ useHandCursor: true });
      onTap(hit, () => {
        if (this.tab !== id) this.show(id);
      });
      c.add([g, tx, hit]);
    });
    this.tabsG = c;
  }

  private show(tab: Tab): void {
    this.tab = tab;
    this.drawTabs();
    this.page?.destroy();
    this.page = this.add.container(0, 0);
    ({ heroes: () => this.heroes(), stats: () => this.stats(), records: () => this.records(), rank: () => this.rank() })[tab]();
    this.page.setAlpha(0);
    this.tweens.add({ targets: this.page, alpha: 1, duration: 160 });
  }

  // ----------------------------------------------------------------- heroes

  private heroes(): void {
    const p = this.page!;
    const m = this.meta;
    const x0 = this.x0();
    const cw = this.cw();
    const back = m.unlocked.length;
    p.add(this.add.text(x0, 246, t('dossier.returned', { have: back, need: HEROES.length }), TXT.num(26, INK.graphite)));
    const slots = allySlots(m);
    const slotLine = slots.nextAt ? t('dossier.slots', { value: slots.slots, need: slots.nextAt }) : t('ally.select.slots', { value: slots.slots });
    p.add(this.add.text(x0, 286, slotLine, { ...TXT.body(20, INK.dim, '500'), wordWrap: { width: cw } }));

    const order = [...HEROES].sort((a, b) => a.tier - b.tier);
    // Phone 3 × 5, wide screen 8 × 2: tall cards either way, so names and bars have room.
    const cols = LANDSCAPE ? 8 : 3;
    const gap = LANDSCAPE ? 14 : 12;
    const top = LANDSCAPE ? 322 : 330;
    const rows = Math.ceil(order.length / cols);
    const cardW = (cw - gap * (cols - 1)) / cols;
    const cardH = Math.min(LANDSCAPE ? 270 : 226, (VIEW.height - top - 24 - gap * (rows - 1)) / rows);
    order.forEach((h, i) => {
      const x = x0 + (i % cols) * (cardW + gap);
      const y = top + Math.floor(i / cols) * (cardH + gap);
      p.add(this.heroCard(h, x, y, cardW, cardH));
    });
  }

  private heroCard(h: HeroInfo, x: number, y: number, w: number, hh: number): Phaser.GameObjects.Container {
    const st = heroState(this.meta, h.id);
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    chip(g, 0, 0, w, hh, st === 'unknown' ? 0x1b2833 : C.paper, 1, 16, { color: st === 'unlocked' ? C.teal : C.seam, width: st === 'unlocked' ? 3 : 2, alpha: st === 'unknown' ? 0.4 : 1 });
    c.add(g);
    const r = Math.min(LANDSCAPE ? 62 : 58, hh * 0.27);
    const px = w / 2;
    const py = 18 + r;
    c.add(portrait(this, px, py, r, h.id, st));
    const name = st === 'unknown' ? t('dossier.hero.unknown') : t(`enemy.${h.id}.name`);
    const tx = w / 2;
    const tw = w - 20;
    const nm = this.add.text(tx, py + r + 14, name, { ...TXT.num(20, st === 'unknown' ? '#9FB4C0' : INK.graphite) }).setOrigin(0.5, 0);
    if (nm.width > tw) nm.setScale(tw / nm.width);
    c.add(nm);
    // Tech dot so the element is readable before opening the file.
    if (st !== 'unknown') {
      const dot = this.add.graphics();
      dot.fillStyle(TECH_HEX[h.tech] ?? 0xffffff, 1);
      dot.lineStyle(2, C.graphite, 1);
      const dx = px + r * 0.72;
      dot.fillCircle(dx, py + r * 0.72, 11).strokeCircle(dx, py + r * 0.72, 11);
      c.add(dot);
    }
    const by = hh - 30;
    if (st === 'unlocked') {
      const tag = this.add.text(tx, by - 2, t('dossier.hero.unlocked').toUpperCase(), { ...TXT.caps(INK.teal), fontSize: '14px' }).setOrigin(0.5, 0);
      c.add(tag);
      if (this.meta.allyChoice.includes(h.id)) {
        const star = this.add.graphics();
        star.fillStyle(C.teal, 1);
        star.fillCircle(w - 22, 22, 13);
        star.fillStyle(0xffffff, 1);
        star.fillTriangle(w - 29, 22, w - 22, 29, w - 22, 15);
        star.fillTriangle(w - 22, 29, w - 13, 16, w - 17, 14);
        c.add(star);
      }
    } else if (st === 'seen') {
      const pr = heroProgress(this.meta, h);
      const bg = this.add.graphics();
      const bw = w - 40;
      const bx = 20;
      bar(bg, bx, by + 6, bw - 54, 8, pr.frac, C.coral);
      c.add(bg);
      c.add(this.add.text(bx + bw, by, h.unlock.type === 'run_challenge' || h.unlock.type === 'tutorial_complete' ? `${pr.have}/1` : `${fmtNum(pr.have)}/${fmtNum(pr.need)}`, { ...TXT.num(15, INK.dim) }).setOrigin(1, 0));
    }
    const hit = this.add.zone(0, 0, w, hh).setOrigin(0).setInteractive({ useHandCursor: true });
    onTap(hit, () => this.heroFile(h));
    c.add(hit);
    return c;
  }

  /** Bottom sheet with the hero's file. */
  private heroFile(h: HeroInfo): void {
    const st = heroState(this.meta, h.id);
    const W = VIEW.width;
    const root = this.add.container(0, 0).setDepth(50);
    const close = () => this.tweens.add({ targets: root, alpha: 0, duration: 140, onComplete: () => root.destroy() });
    root.add(shade(this, W, VIEW.height, 0.55, close));
    const pw = Math.min(724, W - 40);
    const sheet = this.add.container((W - pw) / 2, 0);
    const g = this.add.graphics();
    sheet.add(g);
    const pad = 40;
    const iw = pw - pad * 2;
    const female = FEMALE.has(h.id);
    const known = st !== 'unknown';
    let y = 40;
    sheet.add(portrait(this, pad + 80, y + 80, 80, h.id, st));
    const name = known ? t(`enemy.${h.id}.name`) : t('dossier.hero.unknown');
    sheet.add(this.add.text(pad + 186, y + 8, name, TXT.num(38, INK.graphite)));
    sheet.add(
      this.add.text(pad + 188, y + 60, t(st === 'unlocked' ? 'dossier.hero.unlocked' : st === 'seen' ? 'dossier.hero.seen' : 'unlock.locked').toUpperCase(), TXT.caps(st === 'unlocked' ? INK.teal : st === 'seen' ? INK.coral : INK.dim)),
    );
    if (known) {
      // Element chip and weakness orbs (same orbs as over enemies on the board).
      const tg = this.add.graphics();
      const techName = t(`tech.${h.tech}`);
      const lab = this.add.text(0, 0, techName, TXT.body(20, INK.graphite, '700'));
      const cwid = lab.width + 50;
      chip(tg, pad + 188, y + 96, cwid, 40, TECH_HEX[h.tech] ?? 0xffffff, 0.3, 10, { color: TECH_HEX[h.tech] ?? 0xffffff, width: 2 });
      tg.fillStyle(TECH_HEX[h.tech] ?? 0xffffff, 1);
      tg.fillCircle(pad + 208, y + 116, 8);
      lab.setPosition(pad + 224, y + 104);
      sheet.add([tg, lab]);
      const weak = weaknessesOf({ heroId: h.id });
      if (weak.length) {
        const wl = this.add.text(pad + 188 + cwid + 16, y + 104, `${t('dossier.hero.weak', { tech: '' }).replace(/[:\s]+$/, '')}:`, TXT.body(20, INK.dim, '600'));
        const og = this.add.graphics();
        drawWeakOrbs(og, wl.x + wl.width + 12 + weak.length * 12, y + 116, weak);
        sheet.add([wl, og]);
      }
      const d = stat(this.meta, `hero_defeats.${h.id}`);
      if (d > 0) {
        const key = `dossier.hero.defeated${female ? '_female' : ''}.${plural(d)}`;
        sheet.add(this.add.text(pad + 188, y + 146, t(key, { count: d }), TXT.body(20, INK.dim, '500')));
      }
    }
    y += 196;
    const para = (text: string, style: Phaser.Types.GameObjects.Text.TextStyle, gapAfter = 14) => {
      const tx = this.add.text(pad, y, text, { ...style, wordWrap: { width: iw } });
      sheet.add(tx);
      y += tx.height + gapAfter;
      return tx;
    };
    const caps = (key: string) => para(t(key, { condition: '' }).replace(/[:\s]+$/, '').toUpperCase(), TXT.caps(), 8);
    if (!known) {
      para(t('dossier.hero.unknown.desc'), TXT.body(22, INK.dim, '500'), 22);
    } else {
      para(t(`enemy.${h.id}.desc`), TXT.body(22, INK.graphite, '500'), 16);
      if (hasText(`enemy.${h.id}.ability`)) para(`${t(`enemy.${h.id}.ability`)}${hasText(`enemy.${h.id}.ability.desc`) ? `: ${t(`enemy.${h.id}.ability.desc`)}` : ''}`, TXT.body(21, INK.coral, '700'), 20);
    }
    // What the residents take from this hero: the artist's drawn parts, never code-drawn limbs (AR-00).
    if (known && h.drops?.length) {
      caps('dossier.trophy.title');
      const n = h.drops.length;
      const gap = 16;
      const tw = (iw - gap * (n - 1)) / n;
      // Tiles keep room for a picture only when at least one part is drawn.
      const drawn = h.drops.some((d) => this.textures.exists(`trophy.${d.id}`));
      const top = drawn ? 150 : 18;
      const th = top + 60;
      h.drops.forEach((d, i) => {
        const x = pad + i * (tw + gap);
        const tg = this.add.graphics();
        chip(tg, x, y, tw, th, C.graphite, 0.06, 14);
        sheet.add(tg);
        const key = `trophy.${d.id}`;
        if (this.textures.exists(key)) {
          const img = this.add.image(x + tw / 2, y + 74, key);
          img.setScale(Math.min((tw - 32) / img.width, 124 / img.height));
          sheet.add(img);
        }
        const label = hasText(`part.${d.id}.label`) ? t(`part.${d.id}.label`) : t(`slot.${d.slot}`).toUpperCase();
        const lt = this.add.text(x + tw / 2, y + top, label, { ...TXT.caps(INK.deep), fontSize: '15px' }).setOrigin(0.5, 0);
        if (lt.width > tw - 20) lt.setScale((tw - 20) / lt.width);
        sheet.add(lt);
        const bonus = (['damage', 'hp', 'defense', 'speed'] as const).filter((k) => d[k]).map((k) => {
          const v = d[k] as number;
          return t(`dossier.trophy.${k}`, { value: `${v > 0 ? '+' : '−'}${Math.abs(v)}` });
        });
        const bt = this.add.text(x + tw / 2, y + top + 26, bonus.join(' · '), TXT.body(18, INK.graphite, '700')).setOrigin(0.5, 0);
        if (bt.width > tw - 20) bt.setScale((tw - 20) / bt.width);
        sheet.add(bt);
      });
      y += th + 22;
    }
    // How to bring the hero back, with progress.
    caps(st === 'unlocked' ? 'ally.label' : 'unlock.how');
    if (st === 'unlocked') {
      para(t(`ally.${h.id}.desc`), TXT.body(22, INK.graphite, '600'), 20);
    } else {
      para(t(`unlock.${h.id}`), TXT.body(22, INK.graphite, '600'), 8);
      const pr = heroProgress(this.meta, h);
      const bg = this.add.graphics();
      bar(bg, pad, y + 6, iw - 120, 12, pr.frac, C.coral);
      sheet.add(bg);
      sheet.add(this.add.text(pad + iw, y, `${fmtNum(pr.have)}/${fmtNum(pr.need)}`, TXT.num(20, INK.graphite)).setOrigin(1, 0));
      y += 40;
    }
    // Control's personal file: typed lines on a paper slip.
    if (known && hasText(`dossier.file.${h.id}.1`)) {
      const fileTop = y;
      y += 18;
      const head = this.add.text(pad + 22, y, t('dossier.hero.file').toUpperCase(), { ...TXT.caps(INK.deep), fontSize: '15px' });
      sheet.add(head);
      y += 32;
      for (let k = 1; k <= 3; k++) {
        if (!hasText(`dossier.file.${h.id}.${k}`)) continue;
        const tx = this.add.text(pad + 22, y, t(`dossier.file.${h.id}.${k}`), { fontFamily: FONT, fontStyle: k === 3 ? 'italic 500' : '500', fontSize: '19px', color: k === 3 ? INK.deep : INK.graphite, wordWrap: { width: iw - 44 }, lineSpacing: 2 });
        sheet.add(tx);
        y += tx.height + 8;
      }
      y += 10;
      const slip = this.add.graphics();
      slip.fillStyle(0xfff8e6, 1);
      slip.fillRect(pad, fileTop, iw, y - fileTop);
      slip.fillStyle(C.amber, 1);
      slip.fillRect(pad, fileTop, 6, y - fileTop);
      sheet.addAt(slip, 1);
      y += 20;
    }
    // Buttons: take into the next shift (returned heroes), close.
    if (st === 'unlocked') {
      const chosen = this.meta.allyChoice.includes(h.id);
      sheet.add(
        button(this, pad, y, iw, 92, chosen ? t('ally.select.go') : t('dossier.hero.take'), () => {
          const list = chosen ? this.meta.allyChoice : [h.id, ...this.meta.allyChoice.filter((id) => id !== h.id)];
          pickAllies(this.meta, list);
          close();
          this.show('heroes');
        }, true),
      );
      y += 106;
    }
    sheet.add(button(this, pad, y, iw, 80, t('menu.back'), close));
    y += 80 + 34;
    plate(g, 0, 0, pw, y, 28);
    // Bottom sheet on a phone, centred panel on PC; shrink if the file is long.
    const k = Math.min(1, (VIEW.height - 60) / y);
    sheet.setScale(k);
    sheet.x = (W - pw * k) / 2;
    sheet.y = LANDSCAPE ? (VIEW.height - y * k) / 2 : VIEW.height - y * k - 24;
    root.add(sheet);
    const sy = sheet.y;
    sheet.y += 80;
    sheet.alpha = 0;
    this.tweens.add({ targets: sheet, y: sy, alpha: 1, duration: 240, ease: 'Cubic.out' });
    sound.play('ui_tap');
  }

  // ------------------------------------------------------------------ stats

  private stats(): void {
    const m = this.meta;
    const tiles: [string, string, string?][] = [
      ['dossier.stat.runs', `${fmtNum(stat(m, 'runs_played'))} / ${fmtNum(stat(m, 'runs_won'))}`],
      ['dossier.stat.play_time', fmtTime(stat(m, 'play_seconds'))],
      ['dossier.stat.energy', fmtNum(stat(m, 'energy_earned'))],
      ['dossier.stat.nests', fmtNum(stat(m, 'nests_destroyed'))],
      ['dossier.stat.heroes', fmtNum(stat(m, 'heroes_defeated'))],
      ['dossier.stat.caches', fmtNum(stat(m, 'caches_opened'))],
      ['dossier.stat.reactions', fmtNum(stat(m, 'reactions_total'))],
      ['dossier.stat.lost', fmtNum(stat(m, 'residents_lost')), 'dossier.stat.lost.note'],
    ];
    const cols = LANDSCAPE ? 4 : 2;
    const gap = 16;
    const x0 = this.x0();
    const tw = (this.cw() - gap * (cols - 1)) / cols;
    const top = 250;
    const rows = Math.ceil(tiles.length / cols);
    const th = Math.min(LANDSCAPE ? 280 : 300, (VIEW.height - top - 30 - gap * (rows - 1)) / rows);
    tiles.forEach(([label, value, note], i) => {
      const x = x0 + (i % cols) * (tw + gap);
      const y = top + Math.floor(i / cols) * (th + gap);
      const g = this.add.graphics();
      plate(g, x, y, tw, th, 20);
      const v = this.add.text(x + 30, y + th * 0.3, value, TXT.num(LANDSCAPE ? 50 : 46, i === 7 ? INK.coral : INK.graphite)).setOrigin(0, 0.5);
      if (v.width > tw - 60) v.setScale((tw - 60) / v.width);
      const l = this.add.text(x + 30, y + th * 0.3 + 44, t(label), { ...TXT.body(21, INK.dim, '600'), wordWrap: { width: tw - 60 } });
      this.page!.add([g, v, l]);
      if (note) this.page!.add(this.add.text(x + 30, y + th - 22, t(note), { fontFamily: FONT, fontStyle: 'italic 500', fontSize: '16px', color: INK.dim, wordWrap: { width: tw - 60 } }).setOrigin(0, 1));
    });
  }

  // ---------------------------------------------------------------- records

  private records(): void {
    const m = this.meta;
    const x0 = this.x0();
    const cw = this.cw();
    const rows: [string, string][] = [
      [t('difficulty.intern.name'), 'call.intern'],
      [t('difficulty.shift.name'), 'call.shift'],
      [t('difficulty.rush.name'), 'call.rush'],
      [t('mode.quick.name'), 'quick'],
    ];
    const any = Object.keys(m.records).length > 0 || stat(m, 'best_run_energy') > 0;
    let y = 250;
    if (!any) {
      this.page!.add(this.add.text(VIEW.width / 2, 420, t('dossier.records.none'), { ...TXT.body(26, INK.dim, '600'), align: 'center', wordWrap: { width: cw - 80 } }).setOrigin(0.5));
      return;
    }
    // Column heads, then one plate per mode.
    const c1 = x0 + cw * 0.5;
    const c2 = x0 + cw - 30;
    this.page!.add([
      this.add.text(c1, y, t('dossier.records.best_time').toUpperCase(), { ...TXT.caps(), fontSize: '14px' }).setOrigin(1, 0),
      this.add.text(c2, y, t('dossier.records.best_score').toUpperCase(), { ...TXT.caps(), fontSize: '14px' }).setOrigin(1, 0),
    ]);
    y += 36;
    for (const [label, key] of rows) {
      const r = m.records[key];
      const g = this.add.graphics();
      plate(g, x0, y, cw, 118, 18);
      const l = this.add.text(x0 + 32, y + 59, label, TXT.num(LANDSCAPE ? 28 : 24, INK.graphite)).setOrigin(0, 0.5);
      const tv = this.add.text(c1, y + 59, r?.bestSeconds ? fmtTime(r.bestSeconds) : '—', TXT.num(30, INK.teal)).setOrigin(1, 0.5);
      const sv = this.add.text(c2, y + 59, r?.bestScore ? fmtNum(r.bestScore) : '—', TXT.num(30, INK.graphite)).setOrigin(1, 0.5);
      this.page!.add([g, l, tv, sv]);
      y += 134;
    }
    y += 20;
    const g = this.add.graphics();
    chip(g, x0, y, cw, 130, C.cobalt, 0.12, 18, { color: C.cobalt, width: 2 });
    this.page!.add([
      g,
      this.add.text(x0 + 32, y + 30, t('dossier.records.energy_run'), TXT.body(22, INK.cobalt, '700')),
      this.add.text(x0 + 32, y + 66, fmtNum(stat(m, 'best_run_energy')), TXT.num(38, INK.cobalt)),
    ]);
  }

  // ------------------------------------------------------------------- rank

  private rank(): void {
    const m = this.meta;
    const score = stat(m, 'total_score');
    const cur = rankAt(score);
    const x0 = this.x0();
    const cw = this.cw();
    const p = this.page!;
    // Current rank plate.
    const g = this.add.graphics();
    plate(g, x0, 246, cw, 250, 24);
    rankBadge(g, x0 + 110, 360, 150, cur.index);
    p.add(g);
    p.add(this.add.text(x0 + 220, 278, t(`rank.${cur.rank.id}`), { ...TXT.num(34, INK.graphite), wordWrap: { width: cw - 260 } }));
    const desc = this.add.text(x0 + 222, 330, t(`rank.${cur.rank.id}.desc`), { ...TXT.body(20, INK.dim, '500'), wordWrap: { width: cw - 260 } });
    p.add(desc);
    const bg = this.add.graphics();
    bar(bg, x0 + 222, 430, cw - 262, 14, rankFraction(score), C.teal);
    p.add(bg);
    p.add(this.add.text(x0 + 222, 452, cur.next ? t('rank.next', { rank: t(`rank.${cur.next.id}`), value: fmtNum(cur.next.from - score) }) : t('rank.max'), TXT.body(19, INK.dim, '600')));
    // Ladder of all ranks with what each opens in caches.
    const top = 530;
    const rowH = Math.min(150, (VIEW.height - top - 30) / RANKS.length);
    RANKS.forEach((r, i) => {
      const y = top + i * rowH;
      const reached = i <= cur.index;
      const rg = this.add.graphics();
      chip(rg, x0, y, cw, rowH - 10, i === cur.index ? C.seam : C.paper, i === cur.index ? 0.22 : reached ? 0.9 : 0.5, 14, i === cur.index ? { color: C.teal, width: 2 } : undefined);
      rankBadge(rg, x0 + 52, y + (rowH - 10) / 2, Math.min(64, rowH - 30), i);
      if (!reached) rg.setAlpha(0.6);
      const name = this.add.text(x0 + 104, y + 14, t(`rank.${r.id}`), TXT.num(LANDSCAPE ? 22 : 21, reached ? INK.graphite : INK.dim));
      const from = this.add.text(x0 + cw - 24, y + 16, fmtNum(r.from), TXT.num(18, INK.dim)).setOrigin(1, 0);
      const list = r.unlocksBoons.map((b) => t(`boon.${b}.name`)).join(', ');
      const unl = this.add.text(x0 + 104, y + 48, list ? t('rank.unlocks', { list }) : t('rank.unlocks_none'), { ...TXT.body(18, INK.dim, '500'), wordWrap: { width: cw - 140 } });
      if (unl.height > rowH - 64) unl.setScale(Math.max(0.75, (rowH - 64) / unl.height));
      p.add([rg, name, from, unl]);
    });
  }
}
