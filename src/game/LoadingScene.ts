import Phaser from 'phaser';
import { hasText, t } from '../i18n';
import { createArt, preloadArt } from './assets';
import { C, INK, LANDSCAPE, VIEW } from './layout';
import { preloadComm } from './Comm';
import { drawMenuBackdrop } from './MenuBackdrop';
import { preloadMetaArt } from './meta/art';
import { chip, plate, TXT } from './ui';

/**
 * Loading screen (Антон 10.10: «чтобы было приятно и интересно ждать»; 11:22: no walking heroes,
 * «очень красивый баннер со статикой, и логотип будет переливаться, пока идёт полоска»).
 *   - the comic city of the menu with the logo in the same place, so the menu takes over seamlessly;
 *     a light glint runs across PART SHIFT while the game loads;
 *   - a big still comic banner (HeroOut at work over Lumen City, one of three panels per launch),
 *     framed like a comic page; the artist's 184/185 loading art replaces it when it lands;
 *   - «Эфир» card: rotating tips and Контроль announcements from the writer (tip.*, control.bark.*), tap for the next one;
 *   - a hazard-tape progress bar with a funny status line.
 * One layer, comic + BRAND_UI. No code-made motion of characters.
 */

/** Still comic banners (comic/assets/panels), one per launch. */
const BANNERS = [
  new URL('../assets/comic/panels/city_rescue.jpg', import.meta.url).href,
  new URL('../assets/comic/panels/heroes_turn.jpg', import.meta.url).href,
  new URL('../assets/comic/panels/roof_wide.jpg', import.meta.url).href,
];
/** Generic Контроль lines that fit anywhere (no board event needed). */
const CONTROL = ['hold_line', 'plus', 'rate', 'resist', 'dome', 'dome_fee', 'care_zone', 'limbs_warranty', 'lost_arm', 'cat', 'hero_on_shift', 'survey', 'warehouse', 'idle', 'run_start'];
const STEPS = 8;
/** Shortest time on screen, so the first line can be read; tests and deep links skip it. */
const MIN_MS = 2200;
const LINE_MS = 4600;
/** Logo glint: one pass across the letters, then a pause. */
const GLINT_MS = 2200;
const GLINT_PAUSE_MS = 400;

type Line = { kind: 'tip' | 'fact' | 'control'; text: string };

function lines(): Line[] {
  const out: Line[] = [];
  for (let k = 1; k <= 20; k++) {
    const key = `tip.${k}`;
    if (!hasText(key)) continue;
    const raw = t(key);
    // «Совет: …» / «Факт: …» (EN «Tip: …» / «Fact: …»): the label goes to the chip.
    const m = raw.match(/^([^:]{2,12}):\s*(.+)$/s);
    const fact = /^(факт|fact)/i.test(raw);
    out.push({ kind: fact ? 'fact' : 'tip', text: m ? m[2] : raw });
  }
  for (const id of CONTROL) {
    const key = `control.bark.${id}`;
    if (hasText(key)) out.push({ kind: 'control', text: t(key) });
  }
  Phaser.Utils.Array.Shuffle(out);
  // Alternate a tip and an announcement where possible.
  const tips = out.filter((l) => l.kind !== 'control');
  const ctrl = out.filter((l) => l.kind === 'control');
  const mixed: Line[] = [];
  while (tips.length || ctrl.length) {
    const a = ctrl.shift();
    if (a) mixed.push(a);
    const b = tips.shift();
    if (b) mixed.push(b);
  }
  return mixed;
}

export class LoadingScene extends Phaser.Scene {
  private shown = 0;
  private target = 0;
  private bar!: Phaser.GameObjects.Graphics;
  private barBox = { x: 0, y: 0, w: 0, h: 0 };
  private pct!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private logo: Phaser.GameObjects.Text[] = [];
  private startedAt = 0;
  private loaded = false;
  private leaving = false;

  constructor() {
    super('boot');
  }

  preload(): void {
    // Only what the loading screen itself shows: small and fast.
    const want = new Set(['screen.menu_bg_vertical', 'icon.control_mask']);
    preloadArt(this, (key) => want.has(key));
    this.load.image('boot.banner', Phaser.Utils.Array.GetRandom(BANNERS));
  }

  create(): void {
    this.startedAt = performance.now();
    document.getElementById('boot')?.classList.add('gone');
    setTimeout(() => document.getElementById('boot')?.remove(), 600);

    drawMenuBackdrop(this);
    this.drawLogo();
    // Right column on PC (where the menu panel will be), the lower half on a phone.
    const x0 = LANDSCAPE ? VIEW.width / 2 + 40 : 32;
    const w = LANDSCAPE ? 680 : VIEW.width - 64;
    const cardH = LANDSCAPE ? 216 : 250;
    // The banner keeps the panel's 2:1 shape; the whole stack is centred under the logo on a phone.
    const banH = Math.round(w * (LANDSCAPE ? 0.46 : 0.62));
    const stack = banH + 28 + cardH + 28 + 128;
    const top = LANDSCAPE ? Math.round((VIEW.height - stack) / 2) : Math.round(300 + (VIEW.height - 340 - stack) / 2);
    this.drawBanner(x0, top, w, banH);
    this.drawCard(x0, top + banH + 28, w, cardH);
    this.drawProgress(x0, top + banH + 28 + cardH + 28, w);

    // Load the rest of the game with this screen on top.
    preloadArt(this);
    preloadMetaArt(this);
    preloadComm(this);
    // ?loading=hold keeps the screen up at 62% for reviews and screenshots.
    const hold = new URLSearchParams(location.search).get('loading') === 'hold';
    this.load.on('progress', (v: number) => (this.target = hold ? Math.min(v, 0.62) : v));
    this.load.once('complete', () => {
      this.target = hold ? 0.62 : 1;
      this.loaded = !hold;
    });
    this.load.start();
  }

  private lastReal = 0;

  /** Tests and deep links (?seed=, ?tutorial=, ?fast=1) don't wait for the screen. */
  private fast = /[?&](seed|tutorial|fast)=/.test(location.search);

  update(_time: number, frameDelta: number): void {
    // Real elapsed time: on a slow device Phaser smooths the frame delta, which would make the bar crawl.
    const real = performance.now();
    const delta = this.lastReal ? Math.min(250, real - this.lastReal) : frameDelta;
    this.lastReal = real;
    // Bar eases toward the loader's value so it never jumps, but always moves at least a bit, so it can't crawl at the end.
    if (this.fast && this.loaded) this.shown = 1;
    this.shown = Math.min(this.target, this.shown + Math.max((this.target - this.shown) * Math.min(1, delta / 180), delta / 1200));
    this.drawBar(this.time.now);
    const step = this.loaded && this.shown >= 0.98 ? -1 : Math.min(STEPS - 1, Math.floor(this.shown * STEPS));
    const msg = step < 0 ? t('loading.ready') : t(`loading.step.${step + 1}`);
    if (this.status.text !== msg) this.status.setText(msg);
    this.pct.setText(`${Math.round(this.shown * 100)}%`);
    this.glint(real);
    if (this.loaded && !this.leaving && this.shown >= 0.999 && (this.fast || performance.now() - this.startedAt >= MIN_MS)) this.leave();
  }

  private leave(): void {
    this.leaving = true;
    if (!this.anims.exists('resident.idle')) createArt(this);
    this.cameras.main.fadeOut(220, 244, 247, 247);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('menu'));
  }

  private drawLogo(): void {
    // Same place and size as the menu logo, so it stays put when the menu takes over.
    const ax = LANDSCAPE ? (VIEW.width / 2 - 780) / 2 + 40 : 0;
    const ay = LANDSCAPE ? 60 : 0;
    const part = this.add.text(0, 150 + ay, 'PART', { ...TXT.num(96, INK.graphite), fontStyle: '900' }).setOrigin(0, 0.5);
    const shift = this.add.text(0, 150 + ay, 'SHIFT', { ...TXT.num(96, INK.teal), fontStyle: '900' }).setOrigin(0, 0.5);
    part.x = ax + (780 - part.width - shift.width) / 2;
    shift.x = part.x + part.width;
    this.logo = [part, shift];
    this.add.text(ax + 390, 236 + ay, t('game.subtitle').toUpperCase(), TXT.caps()).setOrigin(0.5);
  }

  /**
   * The logo shimmers while loading: a light band slides across PART SHIFT as one word.
   * Done with a text gradient fill (works on WebGL and canvas), letters stay in place.
   */
  private glint(now: number): void {
    const [part, shift] = this.logo;
    if (!part || !shift) return;
    const cycle = GLINT_MS + GLINT_PAUSE_MS;
    const ph = ((now - this.startedAt) % cycle) / GLINT_MS;
    const total = part.width + shift.width;
    // Band centre in logo pixels; off the word during the pause.
    const at = ph <= 1 ? -0.35 * total + ph * 1.7 * total : -2 * total;
    const paint = (txt: Phaser.GameObjects.Text, base: string, mid: string, glow: string, offset: number) => {
      const ctx = txt.context;
      const gr = ctx.createLinearGradient(-offset + at - 260, 0, -offset + at + 260, txt.height * 0.5);
      gr.addColorStop(0, base);
      gr.addColorStop(0.3, base);
      gr.addColorStop(0.44, mid);
      gr.addColorStop(0.5, glow);
      gr.addColorStop(0.56, mid);
      gr.addColorStop(0.7, base);
      gr.addColorStop(1, base);
      txt.setFill(gr as unknown as string);
    };
    paint(part, INK.graphite, '#115A80', '#9FF4FF', 0);
    paint(shift, INK.teal, '#57D8F2', '#F2FFFF', part.width);
  }

  /** Big still comic banner in a comic-page frame: thick ink border, offset shadow, a caption tag. */
  private drawBanner(x: number, y: number, w: number, h: number): void {
    const g = this.add.graphics();
    g.fillStyle(C.night, 0.22);
    g.fillRect(x + 8, y + 10, w, h);
    g.fillStyle(C.graphite, 1);
    g.fillRect(x - 6, y - 6, w + 12, h + 12);
    g.fillStyle(C.white, 1);
    g.fillRect(x - 2, y - 2, w + 4, h + 4);
    if (this.textures.exists('boot.banner')) {
      const img = this.add.image(x + w / 2, y + h / 2, 'boot.banner');
      // Cover the frame without stretching; crop what sticks out.
      img.setScale(Math.max(w / img.width, h / img.height));
      const mask = this.make.graphics({}, false);
      mask.fillRect(x, y, w, h);
      img.setMask(mask.createGeometryMask());
    }
    // Caption box, like a comic narration box.
    const cap = this.add.text(x + 18, y + h - 16, t('loading.banner').toUpperCase(), { ...TXT.caps(INK.graphite), backgroundColor: '#FFE14D', padding: { x: 12, y: 6 } }).setOrigin(0, 1);
    if (cap.width > w - 36) cap.setScale((w - 36) / cap.width);
  }

  /** «Эфир» card: one line at a time, a new one every few seconds or on tap. */
  private drawCard(x: number, y: number, w: number, h: number): void {
    const g = this.add.graphics();
    plate(g, x, y, w, h, 24);
    const all = lines();
    let i = 0;
    const c = this.add.container(0, 0);
    const pad = 36;
    const iconR = 34;
    const show = () => {
      c.removeAll(true);
      const line = all[i % all.length];
      i++;
      if (!line) return;
      const ctrl = line.kind === 'control';
      const fill = ctrl ? C.violet : line.kind === 'fact' ? C.amber : C.teal;
      const label = t(ctrl ? 'loading.label.control' : line.kind === 'fact' ? 'loading.label.fact' : 'loading.label.tip').toUpperCase();
      const lg = this.add.graphics();
      const cap = this.add.text(0, 0, label, TXT.caps('#FFFFFF'));
      const chipW = cap.width + 36;
      chip(lg, x + pad, y + 30, chipW, 38, fill, 1, 12);
      cap.setPosition(x + pad + 18, y + 49).setOrigin(0, 0.5);
      c.add([lg, cap]);
      const tx = x + pad;
      if (ctrl && this.textures.exists('icon.control_mask')) {
        // Контроль speaks with its mask, like the in-game radio.
        const mask = this.add.image(x + w - pad - iconR, y + 30 + iconR, 'icon.control_mask');
        mask.setScale((iconR * 2) / mask.width);
        c.add(mask);
      }
      const tw = w - pad * 2 - (ctrl ? iconR * 2 + 16 : 0);
      const body = this.add.text(tx, y + 88, line.text, { ...TXT.body(LANDSCAPE ? 24 : 27, INK.graphite, '600'), wordWrap: { width: tw }, lineSpacing: 6 });
      // Long lines shrink to fit the card.
      const room = h - 88 - 28;
      if (body.height > room) body.setScale(Math.max(0.72, room / body.height));
      c.add(body);
      c.setAlpha(0);
      this.tweens.add({ targets: c, alpha: 1, duration: 260 });
    };
    show();
    const timer = this.time.addEvent({ delay: LINE_MS, loop: true, callback: show });
    const hit = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => {
      timer.reset({ delay: LINE_MS, loop: true, callback: show });
      show();
    });
  }

  /** Paper plate with a status line and a hazard-tape bar with the percent. */
  private drawProgress(x: number, y: number, w: number): void {
    const h = 128;
    const g = this.add.graphics();
    plate(g, x, y, w, h, 20);
    this.status = this.add.text(x + 32, y + 36, '', TXT.body(LANDSCAPE ? 22 : 24, INK.graphite, '700')).setOrigin(0, 0.5);
    this.pct = this.add.text(x + w - 32, y + 36, '0%', TXT.num(26, INK.teal)).setOrigin(1, 0.5);
    this.barBox = { x: x + 32, y: y + 66, w: w - 64, h: 34 };
    this.bar = this.add.graphics();
  }

  private drawBar(now: number): void {
    const { x, y, w, h } = this.barBox;
    const g = this.bar;
    g.clear();
    chip(g, x, y, w, h, C.graphite, 1, 10);
    const fw = Math.max(0, (w - 8) * this.shown);
    if (fw > 1) {
      // Quarantine tape: amber with ink stripes that crawl to the right.
      g.fillStyle(C.amber, 1);
      g.fillRect(x + 4, y + 4, fw, h - 8);
      g.fillStyle(C.graphite, 1);
      const off = (now / 30) % 28;
      const bh = h - 8;
      for (let sx = x + 4 - 28 - bh + off; sx < x + 4 + fw; sx += 28) {
        // Slanted stripe clipped to the filled part: a parallelogram leaning right.
        const pts = [
          new Phaser.Math.Vector2(Math.max(x + 4, Math.min(x + 4 + fw, sx)), y + 4 + bh),
          new Phaser.Math.Vector2(Math.max(x + 4, Math.min(x + 4 + fw, sx + 12)), y + 4 + bh),
          new Phaser.Math.Vector2(Math.max(x + 4, Math.min(x + 4 + fw, sx + 12 + bh * 0.6)), y + 4),
          new Phaser.Math.Vector2(Math.max(x + 4, Math.min(x + 4 + fw, sx + bh * 0.6)), y + 4),
        ];
        g.fillPoints(pts, true);
      }
      // Seam-blue leading edge.
      g.fillStyle(C.seam, 1);
      g.fillRect(x + 4 + fw - 4, y + 4, 4, h - 8);
    }
  }
}
