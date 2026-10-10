import Phaser from 'phaser';
import achievementsJson from '../../data/design/achievements.json';
import { hasText, t } from '../../i18n';
import { sound } from '../audio';
import { calmFx } from '../comfort';
import { C, FONT, INK, LANDSCAPE, VIEW } from '../layout';
import { chip, plate, TXT } from '../ui';
import { bar, button, fmtNum, onTap, shade } from './kit';
import { MEDAL, statValue } from './medals';
import { saveMeta, type MetaSave } from './store';

/**
 * Medals, rank cups and the small badges of art 172/174 (design/ACHIEVEMENTS.md, data/achievements.json).
 * Cut from the GPT sheets into assets/art/awards/: rank_1..7 (cups; 1–4 double as medal tiers), role_*,
 * stamp_star / stamp_red, sync_0..5, chevron_1..4. Comic/menu layer, so images, not vector.
 */
const urls = import.meta.glob('../../assets/art/awards/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export function preloadAwards(scene: Phaser.Scene): void {
  for (const [path, url] of Object.entries(urls)) {
    const id = path.match(/([\w-]+)\.png$/)?.[1];
    if (id && !scene.textures.exists(`award.${id}`)) scene.load.image(`award.${id}`, url);
  }
}

type Tiered = { id: string; stat: string; thresholds: (number | 'all')[] };
type Special = { id: string; tier: 'diamond' };
const A = achievementsJson as unknown as { tiered: Tiered[]; special: Special[]; show?: { inRunToast?: { seconds?: number }; profileShowcase?: { max?: number } } };

export interface MedalDef {
  id: string;
  special: boolean;
  stat?: string;
  thresholds?: (number | 'all')[];
}
/** 22 tiered + 6 special, in the designer's order. */
export const MEDALS: MedalDef[] = [...A.tiered.map((m) => ({ id: m.id, special: false, stat: m.stat, thresholds: m.thresholds })), ...A.special.map((m) => ({ id: m.id, special: true }))];
export const SHOWCASE_MAX = A.show?.profileShowcase?.max ?? 3;
const TOAST_MS = (A.show?.inRunToast?.seconds ?? 2) * 1000;

/** 0 none, 1 bronze, 2 silver, 3 gold, 4 diamond (special medals). */
export type Tier = 0 | 1 | 2 | 3 | 4;
const TIER_ID = ['', 'bronze', 'silver', 'gold', 'diamond'];
export const TIER_HEX = [0x9aa8ae, 0xc07a3c, 0x9fb3c8, 0xf2b84b, 0x57d8f2];
export const tierName = (tier: Tier): string => (tier ? t(`medal.tier.${TIER_ID[tier]}`) : '');

type Saved = MetaSave & { medals?: Record<string, { tier: number; at?: string }>; showcase?: string[] };

/**
 * Counters and thresholds come from the rules in medals.ts: "a+b" sums, the «Аврал» alias,
 * derived counters (daily streak, records, blueprints) and «all» resolved from the data
 * (gold is left out while «all» is unknown).
 */
const thresholdsOf = (def: MedalDef): number[] => MEDAL[def.id]?.thresholds ?? [];
const value = (m: MetaSave, key: string): number => statValue(m, key);

export interface MedalState {
  def: MedalDef;
  tier: Tier;
  /** Counter now (special medals: 0/1). */
  cur: number;
  /** Threshold of the next tier, or of the last one when maxed. */
  max: number;
  frac: number;
  maxed: boolean;
  at?: string;
}

/** What the player has: the saved tier (core writes it, `medals.<id>.tier`), or the one the counters already reached. */
export function medalState(m: MetaSave, def: MedalDef): MedalState {
  const saved = (m as Saved).medals?.[def.id];
  if (def.special) {
    const got = !!saved?.tier;
    return { def, tier: got ? 4 : 0, cur: got ? 1 : 0, max: 1, frac: got ? 1 : 0, maxed: got, at: saved?.at };
  }
  const th = thresholdsOf(def);
  const cur = value(m, def.stat ?? '');
  let tier = th.filter((v) => cur >= v).length;
  tier = Math.max(tier, Math.min(3, saved?.tier ?? 0));
  const maxed = tier >= th.length;
  const max = th[Math.min(tier, th.length - 1)] ?? 1;
  const from = tier > 0 && !maxed ? th[tier - 1] : 0;
  return { def, tier: tier as Tier, cur, max, frac: maxed ? 1 : Math.min(1, (cur - from) / Math.max(1, max - from)), maxed, at: saved?.at };
}

export const medalName = (id: string): string => t(`medal.${id}.name`);

/** «Ближе всего»: the unfinished tiered medal with the biggest share of its next step. */
export function closestMedal(m: MetaSave): MedalState | undefined {
  return MEDALS.filter((d) => !d.special)
    .map((d) => medalState(m, d))
    .filter((s) => !s.maxed && s.cur > 0)
    .sort((a, b) => b.cur / b.max - a.cur / a.max)[0];
}

export function showcaseOf(m: MetaSave): string[] {
  return ((m as Saved).showcase ?? []).filter((id) => medalState(m, MEDALS.find((d) => d.id === id) ?? MEDALS[0]).tier > 0).slice(0, SHOWCASE_MAX);
}

/** Adds or removes a medal from the profile showcase; returns false when it is full. */
export function toggleShowcase(m: MetaSave, id: string): boolean {
  const s = m as Saved;
  const cur = s.showcase ?? [];
  if (cur.includes(id)) s.showcase = cur.filter((x) => x !== id);
  else if (cur.length >= SHOWCASE_MAX) return false;
  else s.showcase = [...cur, id];
  saveMeta(m);
  return true;
}

// ---------------------------------------------------------------- pictures

/** Medal cup: tiers 1–4 are cups 1–4 of art 172. Tier 0 is the bronze cup in grey. */
export function medalCup(scene: Phaser.Scene, x: number, y: number, size: number, tier: Tier): Phaser.GameObjects.Image {
  const img = scene.add.image(x, y, `award.rank_${Math.max(1, tier)}`).setOrigin(0.5, 1);
  img.setScale(size / img.height);
  if (!tier) img.setTint(0xb7c2c7).setAlpha(0.55);
  return img;
}

/** Rank regalia: cups 1–7 of art 172 = ranks r1–r7. Bottom-centre origin. */
export function rankCup(scene: Phaser.Scene, x: number, y: number, size: number, index: number): Phaser.GameObjects.Image {
  const img = scene.add.image(x, y, `award.rank_${Phaser.Math.Clamp(index + 1, 1, 7)}`).setOrigin(0.5, 1);
  img.setScale(size / img.height);
  return img;
}

/** Co-op role icon (art 172 row 2). The assault icon (guns) is being redrawn and is not shipped. */
export function roleIcon(scene: Phaser.Scene, x: number, y: number, size: number, role: 'scout' | 'support' | 'engineer'): Phaser.GameObjects.Image {
  const img = scene.add.image(x, y, `award.role_${role}`);
  return img.setScale(size / Math.max(img.width, img.height));
}

/** Backup sync 0–5 (art 174 circles). */
export function syncBadge(scene: Phaser.Scene, x: number, y: number, size: number, level: number): Phaser.GameObjects.Image {
  const img = scene.add.image(x, y, `award.sync_${Phaser.Math.Clamp(Math.round(level), 0, 5)}`);
  return img.setScale(size / img.width);
}

/** Hero level 1–4 (art 174 chevrons). */
export function levelChevron(scene: Phaser.Scene, x: number, y: number, size: number, level: number): Phaser.GameObjects.Image {
  const img = scene.add.image(x, y, `award.chevron_${Phaser.Math.Clamp(Math.round(level), 1, 4)}`);
  return img.setScale(size / img.height);
}

/** «ЧЕРНОВОЙ» on a backup card: the red empty stamp of art 174 with the word printed by the game. */
export function draftStamp(scene: Phaser.Scene, x: number, y: number, w: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const img = scene.add.image(0, 0, 'award.stamp_red');
  img.setScale(w / img.width);
  // The frame sits a little right of and below the picture's centre (the sparks take the top left).
  const word = scene.add.text(-w * 0.01, img.displayHeight * 0.1, t('backup.draft.stamp'), { fontFamily: FONT, fontStyle: '900', fontSize: `${Math.round(w * 0.13)}px`, color: '#D9262B' }).setOrigin(0.5);
  word.setAngle(13);
  if (word.width > w * 0.54) word.setScale((w * 0.54) / word.width);
  c.add([img, word]);
  return c;
}

/** Rank cup + nick + up to 3 showcase cups: one line for the world leaderboard, the co-op lobby and the profile. */
export function nickLine(
  scene: Phaser.Scene,
  x: number,
  y: number,
  o: { nick: string; rankIndex: number; showcase?: { id: string; tier: Tier }[]; size?: number; maxW?: number; color?: string },
): Phaser.GameObjects.Container {
  const s = o.size ?? 44;
  const c = scene.add.container(x, y);
  c.add(rankCup(scene, s / 2, s, s, o.rankIndex));
  const name = scene.add.text(s + 10, s / 2 + 2, o.nick, TXT.num(Math.round(s * 0.5), o.color ?? INK.graphite)).setOrigin(0, 0.5);
  const cups = (o.showcase ?? []).slice(0, SHOWCASE_MAX);
  const cupW = s * 0.62;
  const room = (o.maxW ?? 600) - s - 10 - cups.length * (cupW + 4) - 8;
  if (name.width > room) name.setScale(Math.max(0.6, room / name.width));
  c.add(name);
  let cx = s + 10 + name.displayWidth + 12;
  for (const m of cups) {
    c.add(medalCup(scene, cx + cupW / 2, s * 0.86, s * 0.66, m.tier));
    cx += cupW + 4;
  }
  return c;
}

// ---------------------------------------------------------------- Dossier: grid and card

/** One cell of the 4×7 grid: cup, three tier pips, name, a bar to the next tier. */
export function medalTile(scene: Phaser.Scene, x: number, y: number, w: number, h: number, st: MedalState, showcased: boolean, onOpen: () => void): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const got = st.tier > 0;
  chip(g, 0, 0, w, h, got ? C.paper : C.paper2, got ? 1 : 0.75, 12, { color: got ? TIER_HEX[st.tier] : C.sky2, width: got ? 3 : 2 });
  c.add(g);
  const cupH = Math.round(h * 0.42);
  c.add(medalCup(scene, w / 2, 8 + cupH, cupH, st.tier));
  if (showcased) {
    // A small yellow star: this medal is in the profile showcase.
    const sg = scene.add.graphics();
    sg.fillStyle(0xffe14d, 1).lineStyle(2, C.graphite, 1);
    const pts: Phaser.Math.Vector2[] = [];
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (Math.PI / 5) * k;
      pts.push(new Phaser.Math.Vector2(w - 18 + Math.cos(a) * (k % 2 ? 5 : 11), 18 + Math.sin(a) * (k % 2 ? 5 : 11)));
    }
    sg.fillPoints(pts, true).strokePoints(pts, true);
    c.add(sg);
  }
  const py = 14 + cupH;
  if (!st.def.special) {
    // Tier pips: bronze, silver, gold.
    const pg = scene.add.graphics();
    for (let k = 0; k < 3; k++) {
      pg.fillStyle(k < st.tier ? TIER_HEX[k + 1] : 0xc9d3d7, 1);
      pg.fillCircle(w / 2 + (k - 1) * 14, py, 4.5);
    }
    c.add(pg);
  }
  // Name on up to two lines; longer ones shrink rather than run into the bar.
  const name = scene.add.text(w / 2, py + 9, medalName(st.def.id), { ...TXT.body(LANDSCAPE ? 16 : 15, got ? INK.graphite : INK.dim, '700'), align: 'center', wordWrap: { width: w - 14 }, lineSpacing: -2 }).setOrigin(0.5, 0);
  const room = h - (py + 9) - 22;
  if (name.height > room) name.setScale(room / name.height);
  c.add(name);
  if (!st.maxed) {
    const bg = scene.add.graphics();
    bar(bg, 12, h - 16, w - 24, 6, st.frac, got ? TIER_HEX[Math.min(3, st.tier + 1)] : C.teal);
    c.add(bg);
  }
  const hit = scene.add.zone(0, 0, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
  onTap(hit, onOpen);
  c.add(hit);
  return c;
}

/** Full card of one medal: what it takes, progress, date, a Контроль line, «в витрину». */
export function medalCard(scene: Phaser.Scene, m: MetaSave, def: MedalDef, onClose: () => void, depth = 60): Phaser.GameObjects.Container {
  const st = medalState(m, def);
  const root = scene.add.container(0, 0).setDepth(depth);
  const close = () => {
    root.destroy();
    onClose();
  };
  root.add(shade(scene, VIEW.width, VIEW.height, 0.62, close));
  const w = LANDSCAPE ? 640 : Math.min(700, VIEW.width - 56);
  const pad = 36;
  const iw = w - pad * 2;
  const body = scene.add.container((VIEW.width - w) / 2, 0);
  const bg = scene.add.graphics();
  body.add(bg);
  let y = 36;
  const cup = medalCup(scene, w / 2, y + 170, 170, st.tier);
  body.add(cup);
  if (st.tier && st.at) {
    const stamp = scene.add.image(w / 2 + 120, y + 150, 'award.stamp_star').setAngle(-10).setAlpha(0.9);
    stamp.setScale(120 / stamp.width);
    body.add(stamp);
  }
  y += 190;
  const name = scene.add.text(w / 2, y, medalName(def.id), TXT.num(36, INK.graphite)).setOrigin(0.5, 0);
  if (name.width > iw) name.setScale(iw / name.width);
  body.add(name);
  y += 50;
  const tierLine = st.tier ? tierName(st.tier) : t('medal.locked');
  body.add(scene.add.text(w / 2, y, tierLine.toUpperCase(), { ...TXT.caps(st.tier ? INK.amber : INK.dim), fontSize: '17px' }).setOrigin(0.5, 0));
  y += 40;
  const desc = scene.add.text(w / 2, y, t(`medal.${def.id}.desc`, { n: fmtNum(st.max) }), { ...TXT.body(24, INK.graphite, '600'), align: 'center', wordWrap: { width: iw } }).setOrigin(0.5, 0);
  body.add(desc);
  y += desc.height + 22;
  if (!def.special) {
    const bg2 = scene.add.graphics();
    bar(bg2, pad, y, iw, 14, st.frac, st.maxed ? TIER_HEX[3] : C.teal);
    body.add(bg2);
    const line = st.maxed ? t('medal.progress', { cur: fmtNum(st.cur), max: fmtNum(st.max) }) : t('medal.next', { tier: tierName(Math.min(3, st.tier + 1) as Tier), cur: fmtNum(st.cur), max: fmtNum(st.max) });
    body.add(scene.add.text(pad, y + 24, line, TXT.body(20, INK.dim, '600')));
    y += 62;
  }
  if (st.at) {
    body.add(scene.add.text(pad, y, t('medal.earned_at', { date: fmtDate(st.at) }), TXT.body(20, INK.dim, '600')));
    y += 36;
  }
  // Контроль's comment, in its violet, like every Control line.
  const jk = `medal.${def.id}.joke`;
  if (hasText(jk)) {
    const jg = scene.add.graphics();
    const jt = scene.add.text(pad + 24, y + 16, `${t('control.prefix')} ${t(jk)}`, { fontFamily: FONT, fontStyle: 'italic 600', fontSize: '20px', color: INK.violet, wordWrap: { width: iw - 48 } });
    chip(jg, pad, y, iw, jt.height + 32, C.violet, 0.08, 12, { color: C.violet, width: 2, alpha: 0.5 });
    body.add([jg, jt]);
    y += jt.height + 52;
  }
  // Showcase toggle (only for earned medals), then «Назад».
  if (st.tier) {
    const inCase = showcaseOf(m).includes(def.id);
    const full = !inCase && showcaseOf(m).length >= SHOWCASE_MAX;
    const label = inCase ? t('medal.showcase_remove') : full ? t('medal.showcase_full') : t('medal.showcase_add');
    body.add(
      button(scene, pad, y, iw, 84, label, () => {
        if (full) return;
        toggleShowcase(m, def.id);
        close();
      }, !inCase && !full, 26),
    );
    y += 100;
  }
  body.add(button(scene, pad, y, iw, 76, t('menu.back'), close, false, 24));
  y += 76 + pad;
  plate(bg, 0, 0, w, y, 26);
  // Taps on the card itself must not reach the shade (which closes it).
  body.addAt(scene.add.zone(0, 0, w, y).setOrigin(0).setInteractive(), 1);
  body.y = Math.max(20, (VIEW.height - y) / 2);
  root.add(body);
  if (!calmFx()) {
    body.setScale(0.92).setAlpha(0);
    scene.tweens.add({ targets: body, scale: 1, alpha: 1, duration: 180, ease: 'Back.out' });
  }
  return root;
}

function fmtDate(iso: string): string {
  const [y, mo, d] = iso.split('-');
  return d && mo && y ? `${d}.${mo}.${y}` : iso;
}

// ---------------------------------------------------------------- results and in-run toast

/**
 * «Медали смены» block of the results screen: each medal drops in and gets the yellow star stamp,
 * one after another; then «Ближе всего: …». `schedule(at, fn)` is the results screen's own clock.
 * Returns the block height.
 */
export function resultsMedals(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  earned: { id: string; tier: Tier }[],
  closest: { id: string; cur: number; max: number } | undefined,
  schedule: (at: number, fn: () => void) => void,
  at: number,
): { height: number; at: number } {
  const caps = scene.add.text(x, y, t('results.medals').toUpperCase(), TXT.caps()).setAlpha(0);
  parent.add(caps);
  schedule(at, () => scene.tweens.add({ targets: caps, alpha: 1, duration: 200 }));
  let h = 40;
  if (!earned.length) {
    const none = scene.add.text(x, y + h, t('results.medals_none'), { ...TXT.body(21, INK.dim, '600'), wordWrap: { width: w } }).setAlpha(0);
    parent.add(none);
    schedule((at += 200), () => scene.tweens.add({ targets: none, alpha: 1, duration: 220 }));
    h += none.height + 12;
  } else {
    const cols = Math.min(earned.length, LANDSCAPE ? 4 : 4);
    const cell = Math.min(160, w / cols);
    const cupH = 92;
    earned.forEach((m, k) => {
      const cx = x + (k % cols) * cell + cell / 2;
      const top = y + h + Math.floor(k / cols) * (cupH + 64);
      const cup = medalCup(scene, cx, top + cupH, cupH, m.tier).setAlpha(0);
      const nm = scene.add.text(cx, top + cupH + 8, medalName(m.id), { ...TXT.body(17, INK.graphite, '700'), align: 'center' }).setOrigin(0.5, 0).setAlpha(0);
      if (nm.width > cell - 8) nm.setScale((cell - 8) / nm.width);
      const tn = scene.add.text(cx, top + cupH + 32, tierName(m.tier), { ...TXT.caps(INK.amber), fontSize: '13px' }).setOrigin(0.5, 0).setAlpha(0);
      const stamp = scene.add.image(cx + 40, top + cupH - 14, 'award.stamp_star').setAlpha(0).setAngle(-12);
      const sScale = 92 / stamp.width;
      parent.add([cup, nm, tn, stamp]);
      schedule((at += 420), () => {
        const s0 = cup.scale;
        cup.setScale(s0 * 1.7);
        scene.tweens.add({ targets: cup, alpha: 1, scale: s0, duration: 260, ease: 'Back.out' });
        scene.tweens.add({ targets: [nm, tn], alpha: 1, duration: 200, delay: 120 });
        // The stamp lands a beat later, big to small, like a hand stamping the form.
        stamp.setScale(sScale * 2.4);
        scene.tweens.add({
          targets: stamp,
          alpha: 0.85,
          scale: sScale,
          duration: 180,
          delay: 220,
          ease: 'Quad.in',
          onComplete: () => {
            sound.play('ui_tap');
            if (!calmFx()) scene.cameras.main.shake(70, 0.002);
          },
        });
      });
    });
    h += Math.ceil(earned.length / cols) * (cupH + 64);
  }
  if (closest) {
    const line = scene.add.text(x, y + h, t('results.medals_closest', { name: medalName(closest.id), cur: fmtNum(closest.cur), max: fmtNum(closest.max) }), TXT.body(21, INK.deep, '700')).setAlpha(0);
    if (line.width > w) line.setScale(w / line.width);
    const pb = scene.add.graphics().setAlpha(0);
    bar(pb, x, y + h + 34, w, 8, closest.cur / Math.max(1, closest.max), C.teal);
    parent.add([line, pb]);
    schedule((at += 300), () => scene.tweens.add({ targets: [line, pb], alpha: 1, duration: 220 }));
    h += 56;
  }
  return { height: h + 8, at };
}

/**
 * In-run plate «Землекоп: серебро»: slides down from the top for 2 s, never pauses the game.
 * Several in a row wait their turn.
 */
export class MedalToasts {
  private queue: { id: string; tier: Tier }[] = [];
  private busy = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cx: number,
    private readonly y: number,
    private readonly depth: number,
  ) {}

  push(id: string, tier: Tier): void {
    this.queue.push({ id, tier });
    if (!this.busy) this.next();
  }

  private next(): void {
    const m = this.queue.shift();
    if (!m) {
      this.busy = false;
      return;
    }
    this.busy = true;
    const sc = this.scene;
    const text = t('toast.medal', { name: medalName(m.id), tier: tierName(m.tier).toLowerCase() });
    const tx = sc.add.text(0, 0, text, TXT.num(26, INK.graphite)).setOrigin(0, 0.5);
    const w = Math.min(VIEW.width - 40, tx.width + 130);
    const h = 88;
    const g = sc.add.graphics();
    chip(g, -w / 2, -h / 2, w, h, C.paper, 0.98, 16, { color: TIER_HEX[m.tier], width: 4 });
    const cup = medalCup(sc, -w / 2 + 50, h / 2 - 8, h - 18, m.tier);
    tx.setPosition(-w / 2 + 100, 0);
    if (tx.width > w - 120) tx.setScale((w - 120) / tx.width);
    const box = sc.add.container(this.cx, -h, [g, cup, tx]).setDepth(this.depth);
    sound.play('ui_tap');
    sc.tweens.add({
      targets: box,
      y: this.y + h / 2,
      duration: calmFx() ? 1 : 260,
      ease: 'Back.out',
      onComplete: () =>
        sc.time.delayedCall(TOAST_MS, () =>
          sc.tweens.add({
            targets: box,
            y: -h,
            duration: 220,
            ease: 'Quad.in',
            onComplete: () => {
              box.destroy();
              this.next();
            },
          }),
        ),
    });
  }
}

// ---------------------------------------------------------------- shift stars, modes, difficulty (ACHIEVEMENTS.md §6, art 169/173)

export type StarCond = 'flag' | 'stopwatch' | 'swords' | 'team';
export interface ShiftStars {
  /** Stars earned, 0–3 (0 without a win). */
  got: number;
  /** One condition per star, in order; `ok` also for the grey «would have been met» on a loss. */
  conds: { icon: StarCond; ok: boolean; label?: string }[];
}
const COND_KEY: Record<StarCond, string> = { flag: 'results.stars.win', stopwatch: 'results.stars.fast', swords: 'results.stars.no_losses', team: 'results.stars.team' };

/** Mode icons of art 173 (+ the 169 stopwatch for the lunch call). */
export type ModeId = 'call' | 'coop' | 'tutorial' | 'daily' | 'quick';
export function modeIcon(scene: Phaser.Scene, x: number, y: number, size: number, mode: ModeId): Phaser.GameObjects.Image {
  const img = scene.add.image(x, y, mode === 'quick' ? 'award.cond_stopwatch' : `award.mode_${mode}`);
  return img.setScale(size / Math.max(img.width, img.height));
}

/** Difficulty podium 1–3 (Стажёр, Смена, Аврал). */
export function difficultyIcon(scene: Phaser.Scene, x: number, y: number, size: number, level: 1 | 2 | 3): Phaser.GameObjects.Image {
  const img = scene.add.image(x, y, `award.diff_${level}`);
  return img.setScale(size / Math.max(img.width, img.height));
}

/** Best rating as three small stars (menu next to a mode, Dossier → Records). Left-centre origin; returns the width. */
export function bestStars(scene: Phaser.Scene, parent: Phaser.GameObjects.Container | null, x: number, y: number, size: number, n: number): number {
  for (let k = 0; k < 3; k++) {
    const s = scene.add.image(x + size / 2 + k * (size + 2), y, 'award.star_gold');
    s.setScale(size / s.width);
    if (k >= n) s.setTint(0x9aa8ae).setAlpha(0.35);
    parent?.add(s);
  }
  return size * 3 + 4;
}

/**
 * «Оценка смены» on the results screen: three big stars rise one at a time (Kingdom Rush style),
 * each with its condition icon and line under it. Unmet conditions are grey. Returns the block height.
 */
export function resultsStars(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  v: ShiftStars,
  schedule: (at: number, fn: () => void) => void,
  at: number,
): { height: number; at: number } {
  const col = w / 3;
  const big = Math.min(110, col * 0.62);
  let tallest = 0;
  v.conds.slice(0, 3).forEach((c, k) => {
    const cx = x + col * k + col / 2;
    const earned = k < v.got;
    // Empty socket first: a grey star the real one lands on.
    const socket = scene.add.image(cx, y + big / 2, 'award.star_gold').setTint(0x9aa8ae).setAlpha(0.28);
    socket.setScale(big / socket.width);
    const star = scene.add.image(cx, y + big / 2, 'award.star_gold').setAlpha(0);
    const s0 = big / star.width;
    star.setScale(s0);
    const icon = scene.add.image(cx - col / 2 + 30, y + big + 34, `award.cond_${c.icon}`);
    icon.setScale(44 / Math.max(icon.width, icon.height));
    if (!c.ok) icon.setTint(0x9aa8ae).setAlpha(0.6);
    const label = scene.add.text(cx - col / 2 + 58, y + big + 14, c.label ?? t(COND_KEY[c.icon]), { ...TXT.body(17, c.ok ? INK.graphite : INK.dim, '700'), wordWrap: { width: col - 64 }, lineSpacing: -1 });
    if (label.height > 64) label.setScale(64 / label.height);
    tallest = Math.max(tallest, big + 14 + Math.max(44, label.displayHeight) + 10);
    const parts = [socket, star, icon, label];
    for (const o of [icon, label]) o.setAlpha(0);
    parent.add(parts);
    schedule((at += 380), () => {
      scene.tweens.add({ targets: icon, alpha: c.ok ? 1 : 0.6, duration: 200 });
      scene.tweens.add({ targets: label, alpha: 1, duration: 200 });
      if (!earned) return;
      star.setScale(s0 * 0.2).setAngle(-30);
      scene.tweens.add({ targets: star, alpha: 1, scale: s0, angle: 0, duration: calmFx() ? 1 : 340, ease: 'Back.out' });
      sound.play('ui_tap');
      if (!calmFx()) {
        // Short burst of rays behind the star.
        const rays = scene.add.graphics().setPosition(cx, y + big / 2);
        rays.lineStyle(5, 0xffc93a, 1);
        for (let r = 0; r < 8; r++) {
          const a = (Math.PI / 4) * r;
          rays.lineBetween(Math.cos(a) * big * 0.55, Math.sin(a) * big * 0.55, Math.cos(a) * big * 0.75, Math.sin(a) * big * 0.75);
        }
        parent.addAt(rays, parent.getIndex(star));
        scene.tweens.add({ targets: rays, scale: 1.35, alpha: 0, duration: 420, onComplete: () => rays.destroy() });
      }
    });
  });
  return { height: tallest + 12, at };
}
