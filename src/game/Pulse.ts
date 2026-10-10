import Phaser from 'phaser';
import { hasText, t } from '../i18n';
import { sound } from './audio';
import { C, INK, LANDSCAPE, VIEW } from './layout';
import { chip, plate, TXT } from './ui';
import { drawTechOrb } from './Vitals';

/**
 * The pace of a shift on screen (Антон 10.10 10:49, MVP_RULES §17, Геймдизайнер's requests):
 *   TempoMeter  — «Темп» next to Energy: 4 segments grey → orange, a flame at the top, «Застой» caption;
 *   RaidTimer   — «Рейд через 1:42» with the raid's elements; tap → «Позвать рейд сейчас? +N ⚡», second tap calls it;
 *   controlCall — the «Звонок Контроля» card: portrait, text, two answers with their price, 15 s, co-op votes.
 * All vector UI (BRAND_UI); the flame is a stand-in until the artist's pixel flame (requested 11:15) lands as `icon.tempo_*`.
 */

type Ev = Phaser.Types.Input.EventData;
type G = Phaser.GameObjects.Graphics;
const stopEv = (fn: () => void) => (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => {
  ev.stopPropagation();
  fn();
};

const SEG = [0x9aa8ae, 0xf2b84b, 0xff8a3d, 0xff5a1f];

/** Vector flame (stand-in for the pixel `icon.tempo_3`). */
function flame(g: G, x: number, y: number, s: number, hot: boolean, now: number): void {
  const flick = hot ? 1 + Math.sin(now / 90) * 0.06 : 1;
  const h = s * flick;
  g.fillStyle(hot ? 0xff5a1f : 0x9aa8ae, 1);
  g.fillPoints([new Phaser.Math.Vector2(x, y - h), new Phaser.Math.Vector2(x + s * 0.55, y - s * 0.15), new Phaser.Math.Vector2(x + s * 0.4, y + s * 0.35), new Phaser.Math.Vector2(x - s * 0.4, y + s * 0.35), new Phaser.Math.Vector2(x - s * 0.55, y - s * 0.15)], true);
  g.fillStyle(hot ? 0xffd34d : 0xc6d4d9, 1);
  g.fillPoints([new Phaser.Math.Vector2(x, y - h * 0.45), new Phaser.Math.Vector2(x + s * 0.28, y + s * 0.05), new Phaser.Math.Vector2(x + s * 0.2, y + s * 0.3), new Phaser.Math.Vector2(x - s * 0.2, y + s * 0.3), new Phaser.Math.Vector2(x - s * 0.28, y + s * 0.05)], true);
}

export class TempoMeter {
  private g: G;
  private label: Phaser.GameObjects.Text;
  private stag: Phaser.GameObjects.Text;
  private last = -1;
  private flashAt = -9999;

  constructor(
    scene: Phaser.Scene,
    private x: number,
    private y: number,
    private w: number,
    depth: number,
  ) {
    this.g = scene.add.graphics().setDepth(depth);
    this.label = scene.add.text(x, y + 22, t('tempo.label').toUpperCase(), TXT.caps(INK.deep)).setOrigin(0, 0.5).setDepth(depth);
    this.stag = scene.add.text(x, y - 2, t('tempo.stagnation'), { ...TXT.body(14, INK.white, '800'), backgroundColor: '#E03552', padding: { x: 8, y: 2 } }).setOrigin(0, 1).setDepth(depth).setVisible(false);
  }

  /** level 0..3, frac = progress inside the level (0..1), stagnant = «Застой» is on. */
  update(level: number, frac: number, stagnant: boolean, now: number): void {
    if (this.last >= 0 && level > this.last) {
      this.flashAt = now;
      sound.play('ui_tap');
    }
    this.last = level;
    const g = this.g;
    g.clear();
    const lx = this.x + this.label.width + 12;
    const fw = 34;
    const segW = (this.w - (lx - this.x) - fw - 6 - 3 * 5) / 4;
    const h = 22;
    const y = this.y + 11;
    const flash = Math.max(0, 1 - (now - this.flashAt) / 400);
    for (let k = 0; k < 4; k++) {
      const sx = lx + k * (segW + 5);
      const on = k <= level;
      // Parallelogram segments, like hazard tape.
      const pts = [new Phaser.Math.Vector2(sx + 6, y), new Phaser.Math.Vector2(sx + segW, y), new Phaser.Math.Vector2(sx + segW - 6, y + h), new Phaser.Math.Vector2(sx, y + h)];
      g.fillStyle(0x10171c, 0.85);
      g.fillPoints(pts, true);
      if (on) {
        // The current segment fills by progress; lower ones are full.
        const f = k < level ? 1 : Math.max(0.25, frac);
        g.fillStyle(SEG[k], 1);
        g.fillPoints([new Phaser.Math.Vector2(sx + 6, y + 3), new Phaser.Math.Vector2(sx + 6 + (segW - 9) * f, y + 3), new Phaser.Math.Vector2(sx + 3 + (segW - 9) * f, y + h - 3), new Phaser.Math.Vector2(sx + 3, y + h - 3)], true);
      }
      if (flash > 0) {
        g.fillStyle(0xffffff, 0.7 * flash);
        g.fillPoints(pts, true);
      }
    }
    flame(g, lx + 4 * (segW + 5) + fw / 2 - 2, y + h / 2 - 2, 16, level >= 3, now);
    this.stag.setVisible(stagnant);
    if (stagnant) this.stag.setAlpha(0.65 + 0.35 * Math.sin(now / 260));
    this.label.setColor(level >= 3 ? '#E2541B' : INK.deep);
  }
}

/** «Рейд через 1:42»: tap to call it early, second tap within 3 s confirms (MVP_RULES §17.4). */
export class RaidTimer {
  private g: G;
  private text: Phaser.GameObjects.Text;
  private hit: Phaser.GameObjects.Zone;
  private armedAt = -1;
  private state = { left: 0, reward: 0, techs: [] as string[], active: false, can: true };

  constructor(
    scene: Phaser.Scene,
    private x: number,
    private y: number,
    private w: number,
    private h: number,
    depth: number,
    private onCall: () => void,
    /** Width while asking «Позвать рейд сейчас?»: the question spreads over the goal chip next to it. */
    private wideW = w,
  ) {
    this.g = scene.add.graphics().setDepth(depth);
    this.text = scene.add.text(x + 40, y + h / 2, '', TXT.body(19, INK.white, '800')).setOrigin(0, 0.5).setDepth(depth);
    this.hit = scene.add.zone(x, y, w, h).setOrigin(0).setDepth(depth).setInteractive({ useHandCursor: true });
    this.hit.on('pointerdown', stopEv(() => this.tap()));
  }

  private tap(): void {
    const s = this.state;
    if (s.active || !s.can) return;
    const now = performance.now();
    if (this.armedAt > 0 && now - this.armedAt < 3000) {
      this.armedAt = -1;
      sound.play('ui_tap');
      this.onCall();
      return;
    }
    this.armedAt = now;
    sound.play('ui_tap');
  }

  /** left = seconds to the next raid; reward = Energy for calling now; active = a raid is on. */
  update(left: number, reward: number, techs: string[], active: boolean, can: boolean, now: number): void {
    this.state = { left, reward, techs, active, can };
    const armed = this.armedAt > 0 && performance.now() - this.armedAt < 3000;
    if (!armed) this.armedAt = -1;
    const g = this.g;
    g.clear();
    const fill = active ? C.coralInk : armed ? C.amber : C.graphite;
    const cw = armed ? this.wideW : this.w;
    chip(g, this.x, this.y, cw, this.h, fill, 1, 12);
    this.hit.setSize(cw, this.h);
    this.hit.input?.hitArea.setTo(0, 0, cw, this.h);
    // Siren lamp: blinks faster as the raid gets close.
    const blink = active ? Math.sin(now / 90) > 0 : left < 20 ? Math.sin(now / 160) > 0 : true;
    g.fillStyle(active ? 0xffffff : C.coral, blink ? 1 : 0.3);
    g.fillCircle(this.x + 22, this.y + this.h / 2, 8);
    const mm = Math.floor(left / 60);
    const ss = String(Math.floor(left % 60)).padStart(2, '0');
    const label = active ? t('raid.now') : armed ? t('raid.call_early', { n: reward }) : t('raid.timer', { time: `${mm}:${ss}` });
    if (this.text.text !== label) this.text.setText(label);
    this.text.setColor(armed ? INK.graphite : INK.white);
    // The raid's elements, small orbs on the right (players read what's coming).
    const room = cw - 40 - (armed || active ? 12 : techs.length * 22 + 14);
    this.text.setScale(this.text.width > room ? room / this.text.width : 1);
    if (!armed && !active)
      techs.slice(0, 3).forEach((tech, k) => drawTechOrb(g, tech, this.x + this.w - 16 - k * 22, this.y + this.h / 2, 8));
  }

  /** Hidden on maps without raids (tutorial, raids off): nothing to count down to. */
  setVisible(on: boolean): void {
    if (this.g.visible === on) return;
    this.g.setVisible(on);
    this.text.setVisible(on);
    this.hit.setVisible(on);
    if (this.hit.input) this.hit.input.enabled = on;
  }

  destroy(): void {
    this.g.destroy();
    this.text.destroy();
    this.hit.destroy();
  }
}

// ------------------------------------------------------------------ Звонок Контроля

export interface CallChoice {
  label: string;
  /** Effects from events.json: { energy: -30, nextRaidSooner: 30, … } */
  effect: Record<string, unknown>;
}
export interface CallSpec {
  id: string;
  title: string;
  line: string;
  a: CallChoice;
  b: CallChoice;
  seconds: number;
  /** Co-op: everyone votes; no pause. */
  coop?: boolean;
}

/** The price of an answer in a few words (Сценарист: call.cost.*). Unknown effects stay silent: the line says them. */
export function costLine(effect: Record<string, unknown>): string {
  const out: string[] = [];
  const n = (k: string) => (typeof effect[k] === 'number' ? (effect[k] as number) : null);
  const e = n('energy');
  if (e) out.push(`${e > 0 ? '+' : '−'}${Math.abs(e)} ⚡`);
  for (const k of ['nextRaidSooner', 'commandHpPercent', 'randomHeroAwaySeconds', 'civiliansLose', 'scoreBonus', 'nextRaidExtraEnemies', 'reactorsOffSeconds', 'nextBuildingCostFactor', 'returnsWithStar']) {
    // events.json v0.2 sells townsfolk off the balance (civiliansFromBalance); same price line as civiliansLose.
    const v = n(k) ?? (k === 'civiliansLose' ? n('civiliansFromBalance') : null);
    if (v === null) continue;
    const key = `call.cost.${k}`;
    if (hasText(key)) out.push(t(key, { n: k === 'nextBuildingCostFactor' ? Math.round((1 - v) * 100) : Math.abs(v) }));
  }
  return out.join(' · ');
}

export interface CallCard {
  container: Phaser.GameObjects.Container;
  /** Co-op votes for a and b, and the players who haven't voted yet. */
  update(now: number, votes?: { a: number; b: number; waiting: number }): void;
  /** Show the result line, then close by itself. */
  result(text: string): void;
}

/**
 * The card. Solo: the caller pauses the game while it is open; with no answer in `seconds` the caller
 * picks «b» (events.json timeoutChoice) and shows call.timeout.
 */
export function controlCall(scene: Phaser.Scene, spec: CallSpec, depth: number, pick: (c: 'a' | 'b') => void): CallCard {
  const W = VIEW.width;
  const H = VIEW.height;
  const c = scene.add.container(0, 0).setDepth(depth);
  const shade = scene.add.rectangle(0, 0, W, H, 0x0a1218, 0.55).setOrigin(0).setInteractive();
  shade.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => ev.stopPropagation());
  c.add(shade);
  const w = Math.min(LANDSCAPE ? 760 : 716, W - 40);
  const x = (W - w) / 2;
  const b = scene.add.container(x, 0);
  c.add(b);
  const g = scene.add.graphics();
  b.add(g);
  const pad = 28;
  let y = pad;
  // Incoming call strip.
  const strip = scene.add.text(pad, y, `☎  ${t('call.incoming').toUpperCase()}`, { ...TXT.caps('#FFFFFF'), backgroundColor: '#8A4DFF', padding: { x: 12, y: 7 } });
  b.add(strip);
  y += strip.height + 18;
  // Portrait: Контроль speaks (comm portraits; the mask icon as a fallback).
  const R = 64;
  const key = ['comm.control_speaking', 'comm.control', 'icon.control_mask'].find((k) => scene.textures.exists(k));
  const pg = scene.add.graphics();
  pg.fillStyle(0x1b1030, 1);
  pg.fillCircle(pad + R, y + R, R);
  pg.lineStyle(5, C.violet, 1);
  pg.strokeCircle(pad + R, y + R, R);
  b.add(pg);
  if (key) {
    const img = scene.add.image(pad + R, y + R, key);
    img.setScale(((R - 4) * 2) / Math.max(img.width, img.height));
    const m = scene.make.graphics({}, false);
    b.add(img);
    // Masks live in world space: placed after the card is positioned (below).
    img.setData('maskG', m);
  }
  // Rings around the portrait while it "rings".
  const rings = scene.add.graphics();
  b.add(rings);
  const tx = pad + R * 2 + 22;
  const tw = w - tx - pad;
  const title = scene.add.text(tx, y + 4, spec.title, { ...TXT.num(LANDSCAPE ? 26 : 27, INK.graphite), wordWrap: { width: tw } });
  b.add(title);
  const line = scene.add.text(tx, title.y + title.height + 8, spec.line, { ...TXT.body(LANDSCAPE ? 20 : 21, INK.graphite, '600'), wordWrap: { width: tw }, lineSpacing: 3 });
  b.add(line);
  y = Math.max(y + R * 2, line.y + line.height) + 22;
  // Timer bar: 15 s to answer.
  const timerY = y;
  const tg = scene.add.graphics();
  b.add(tg);
  const tl = scene.add.text(w - pad, timerY - 4, '', TXT.num(16, INK.dim)).setOrigin(1, 1);
  b.add(tl);
  y += 22;
  // Two answers, each with its price under the label.
  const gap = 16;
  const bw = (w - pad * 2 - gap) / 2;
  const bh = 112;
  const voteT: Phaser.GameObjects.Text[] = [];
  let picked = false;
  (['a', 'b'] as const).forEach((id, k) => {
    const ch = spec[id];
    const bx = pad + k * (bw + gap);
    const bg = scene.add.graphics();
    chip(bg, bx, y, bw, bh, id === 'a' ? C.violet : C.white, 1, 14, id === 'b' ? { color: C.graphite, width: 3 } : undefined);
    const ink = id === 'a' ? INK.white : INK.graphite;
    const lab = scene.add.text(bx + bw / 2, y + 38, ch.label, { ...TXT.body(22, ink, '800'), align: 'center', wordWrap: { width: bw - 20 } }).setOrigin(0.5);
    if (lab.height > 56) lab.setScale(56 / lab.height);
    const cost = costLine(ch.effect);
    const ct = scene.add.text(bx + bw / 2, y + 86, cost, { ...TXT.body(18, id === 'a' ? '#E9DDFF' : INK.dim, '700'), align: 'center' }).setOrigin(0.5);
    if (ct.width > bw - 16) ct.setScale((bw - 16) / ct.width);
    const vt = scene.add.text(bx + bw - 10, y - 8, '', { ...TXT.num(15, INK.white), backgroundColor: '#10171C', padding: { x: 8, y: 3 } }).setOrigin(1, 0.5).setVisible(false);
    voteT.push(vt);
    const hit = scene.add.zone(bx, y, bw, bh).setOrigin(0).setInteractive({ useHandCursor: true });
    hit.on(
      'pointerdown',
      stopEv(() => {
        if (picked && !spec.coop) return;
        picked = true;
        sound.play('ui_tap');
        bg.lineStyle(5, C.amber, 1);
        bg.strokeRect(bx - 3, y - 3, bw + 6, bh + 6);
        pick(id);
      }),
    );
    b.add([bg, lab, ct, vt, hit]);
  });
  y += bh + 14;
  const foot = scene.add.text(w / 2, y, spec.coop ? t('call.vote_hint') : t('call.choose'), { ...TXT.body(17, INK.dim, '600'), align: 'center', wordWrap: { width: w - pad * 2 } }).setOrigin(0.5, 0);
  b.add(foot);
  y += foot.height + pad;
  plate(g, 0, 0, w, y, 26);
  const top = Math.round((H - y) / 2);
  b.setY(top);
  const img = b.list.find((o) => o.getData && o.getData('maskG')) as Phaser.GameObjects.Image | undefined;
  if (img) {
    const m = img.getData('maskG') as G;
    m.fillCircle(x + pad + R, top + pad + strip.height + 18 + R, R - 4);
    img.setMask(m.createGeometryMask());
  }
  const started = performance.now();
  // Slide in like a phone notification.
  b.y = top - 40;
  b.alpha = 0;
  scene.tweens.add({ targets: b, y: top, alpha: 1, duration: 220, ease: 'Cubic.easeOut' });
  return {
    container: c,
    update(now: number, votes?: { a: number; b: number; waiting: number }) {
      const left = Math.max(0, spec.seconds - (performance.now() - started) / 1000);
      tg.clear();
      chip(tg, pad, timerY, w - pad * 2, 12, 0xdfe7ea, 1, 4);
      chip(tg, pad, timerY, Math.max(8, (w - pad * 2) * (left / spec.seconds)), 12, left < 5 ? C.coralInk : C.violet, 1, 4);
      tl.setText(t('call.seconds_left', { n: Math.ceil(left) }));
      rings.clear();
      const ph = (now % 1200) / 1200;
      rings.lineStyle(3, C.violet, 1 - ph);
      rings.strokeCircle(pad + R, pad + strip.height + 18 + R, R + 4 + ph * 18);
      if (votes) {
        voteT[0].setText(String(votes.a)).setVisible(true);
        voteT[1].setText(String(votes.b)).setVisible(true);
        foot.setText(votes.waiting > 0 ? t('call.waiting', { n: votes.waiting }) : t('call.vote_hint'));
      }
    },
    result(text: string) {
      foot.setText(text).setColor(INK.violet).setFontStyle('800');
      scene.time.delayedCall(2200, () => scene.tweens.add({ targets: c, alpha: 0, duration: 200, onComplete: () => c.destroy() }));
    },
  };
}
