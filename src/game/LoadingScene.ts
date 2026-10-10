import Phaser from 'phaser';
import { hasText, t } from '../i18n';
import { animSets, createArt, preloadArt } from './assets';
import { C, INK, LANDSCAPE, VIEW } from './layout';
import { preloadComm } from './Comm';
import { drawMenuBackdrop } from './MenuBackdrop';
import { preloadMetaArt } from './meta/art';
import { chip, plate, TXT } from './ui';

/**
 * Loading screen (Антон 10.10: «чтобы было приятно и интересно ждать»).
 * Loads a handful of pictures first (the menu city, the starters' walk sheets,
 * the board tiles), then shows them while the rest of the art loads:
 *   - the comic city of the menu with the logo in the same place, so the menu takes over seamlessly;
 *   - «Эфир» card: rotating tips and Контроль announcements from the writer (tip.*, control.bark.*), tap for the next one;
 *   - HeroOut street camera: the four starters walk to their shift over a strip of board blocks.
 *     The heroes are the animator's frame sheets (ally_*.walk, drawn frames, no code motion);
 *     only the street under them scrolls, at the pace of the steps;
 *   - a hazard-tape progress bar with a funny status line under the camera.
 * Style per layer: city and card = menu (comic + BRAND_UI), the camera = a framed piece of the pixel board.
 */

/** Starters walk on the camera (MVP_RULES §4: birth roster at the start). The dog leads. */
const SQUAD = ['patch', 'standard', 'current', 'canopy'];
/** Back row: quarantined blocks and rubble; front row: opened ground. */
const BACK_TILES = ['closed_0', 'closed_1', 'closed_2', 'closed_3', 'closed_1', 'rubble_0', 'closed_2', 'closed_0', 'closed_3'];
const FRONT_TILES = ['ground_0', 'ground_1', 'ground_grass_0', 'ground_0', 'ground_grass_1', 'ground_1', 'ground_grass_2', 'ground_0'];
/** Generic Контроль lines that fit anywhere (no board event needed). */
const CONTROL = ['hold_line', 'plus', 'rate', 'resist', 'dome', 'dome_fee', 'care_zone', 'limbs_warranty', 'lost_arm', 'cat', 'hero_on_shift', 'survey', 'warehouse', 'idle', 'run_start'];
const STEPS = 8;
/** Shortest time on screen, so the first line can be read; tests and deep links skip it. */
const MIN_MS = 2200;
const LINE_MS = 4600;
/** Street speed in px/s at tile scale 2: matches the walk cycle (8 frames at 10 fps, two steps). */
const STREET_SPEED = 96;
const SCALE = 2;
const TILE = 52 * SCALE;

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
  private street: Phaser.GameObjects.Image[] = [];
  private streetW = 0;
  private startedAt = 0;
  private loaded = false;
  private leaving = false;

  constructor() {
    super('boot');
  }

  preload(): void {
    // Only what the loading screen itself shows: small and fast.
    const want = new Set(['screen.menu_bg_vertical', 'icon.control_mask', ...SQUAD.map((id) => `ally_${id}`), ...BACK_TILES.map((k) => `tile.${k}`), ...FRONT_TILES.map((k) => `tile.${k}`)]);
    preloadArt(this, (key) => want.has(key));
  }

  create(): void {
    this.startedAt = this.time.now;
    for (const k of this.textures.getTextureKeys()) if (k.startsWith('tile.') || k.startsWith('ally_')) this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
    document.getElementById('boot')?.classList.add('gone');
    setTimeout(() => document.getElementById('boot')?.remove(), 600);

    drawMenuBackdrop(this);
    this.drawLogo();
    // Right column on PC (where the menu panel will be), the lower half on a phone.
    const x0 = LANDSCAPE ? VIEW.width / 2 + 40 : 32;
    const w = LANDSCAPE ? 680 : VIEW.width - 64;
    const cardH = LANDSCAPE ? 230 : 250;
    // Phone: a taller camera (three rows) and the whole stack centred under the logo.
    const camH = (LANDSCAPE ? 2 : 3) * TILE + 52;
    const stack = cardH + 36 + camH + 28 + 128;
    const top = LANDSCAPE ? 70 : Math.round(300 + (VIEW.height - 340 - stack) / 2);
    this.drawCard(x0, top, w, cardH);
    const camY = top + cardH + 36;
    this.drawCamera(x0, camY, w, camH);
    this.drawProgress(x0, camY + camH + 28, w);

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

  update(_time: number, delta: number): void {
    // Bar eases toward the loader's value so it never jumps, but always moves at least a bit, so it can't crawl at the end.
    this.shown = Math.min(this.target, this.shown + Math.max((this.target - this.shown) * Math.min(1, delta / 180), delta / 1200));
    this.drawBar(this.time.now);
    const step = this.loaded && this.shown >= 0.98 ? -1 : Math.min(STEPS - 1, Math.floor(this.shown * STEPS));
    const msg = step < 0 ? t('loading.ready') : t(`loading.step.${step + 1}`);
    if (this.status.text !== msg) this.status.setText(msg);
    this.pct.setText(`${Math.round(this.shown * 100)}%`);
    // Street under the walking squad.
    const dx = (STREET_SPEED * delta) / 1000;
    for (const img of this.street) {
      img.x -= dx;
      if (img.x + TILE <= img.getData('x0')) img.x += this.streetW;
    }
    const fast = /[?&](seed|tutorial|fast)=/.test(location.search);
    if (this.loaded && !this.leaving && this.shown >= 0.999 && (fast || this.time.now - this.startedAt >= MIN_MS)) this.leave();
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
    this.add.text(ax + 390, 236 + ay, t('game.subtitle').toUpperCase(), TXT.caps()).setOrigin(0.5);
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

  /** HeroOut street camera: a framed strip of the pixel board with the squad walking to the shift. */
  private drawCamera(x: number, y: number, w: number, h: number): void {
    const g = this.add.graphics();
    g.fillStyle(C.night, 0.18);
    g.fillRect(x + 4, y + 8, w, h);
    chip(g, x, y, w, h, C.graphite, 1, 18);
    const ix = x + 12;
    const iy = y + 40;
    const iw = w - 24;
    const ih = h - 52;
    // The street: back row of quarantined blocks, front row of opened ground. Wraps around while the squad walks.
    const cols = Math.ceil(iw / TILE) + 2;
    this.streetW = cols * TILE;
    // Phone adds a second row of quarantined blocks in front: the squad walks a cleared street between them.
    const rows: [string[], number][] = [
      [BACK_TILES, iy],
      [FRONT_TILES, iy + TILE],
    ];
    if (!LANDSCAPE) rows.push([[...BACK_TILES].reverse(), iy + 2 * TILE]);
    for (const [set, ry] of rows) {
      for (let k = 0; k < cols; k++) {
        const key = `tile.${set[k % set.length]}`;
        if (!this.textures.exists(key)) continue;
        const img = this.add.image(ix + k * TILE, ry, key).setOrigin(0).setScale(SCALE);
        img.setData('x0', ix - TILE);
        this.street.push(img);
      }
    }
    const mask = this.make.graphics({}, false);
    mask.fillRect(ix, iy, iw, ih);
    const geo = mask.createGeometryMask();
    this.street.forEach((s) => s.setMask(geo));
    // The squad: drawn walk frames from the animator's sheets, standing on the front row.
    const feet = iy + TILE + TILE * 0.62;
    const lead = ix + iw * (LANDSCAPE ? 0.8 : 0.82);
    const gap = Math.min(150, (iw * 0.7) / SQUAD.length);
    SQUAD.forEach((id, k) => {
      const key = `ally_${id}`;
      const set = animSets[key];
      if (!set || !this.textures.exists(key) || !set.anims.walk) return;
      const anim = `boot.${key}.walk`;
      if (!this.anims.exists(anim)) this.anims.create({ key: anim, frames: this.anims.generateFrameNumbers(key, { frames: set.anims.walk.frames }), frameRate: set.anims.walk.fps, repeat: -1 });
      const s = this.add.sprite(lead - k * gap, feet, key).setScale(SCALE);
      s.setOrigin(set.anchor[0] / set.frameSize[0], set.anchor[1] / set.frameSize[1]);
      if (set.faces === 'left') s.setFlipX(true);
      s.play({ key: anim, startFrame: (k * 3) % set.anims.walk.frames.length });
      s.setMask(geo);
    });
    // Camera overlay: «REC» dot, camera name, the 9:14 clock (tip.9: the crane went mad at 9:14).
    const rec = this.add.graphics();
    rec.fillStyle(C.coral, 1);
    rec.fillCircle(x + 30, y + 21, 7);
    this.tweens.add({ targets: rec, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });
    this.add.text(x + 46, y + 21, t('loading.camera').toUpperCase(), TXT.caps('#DCEBF0')).setOrigin(0, 0.5);
    this.add.text(x + w - 22, y + 21, '09:14', TXT.caps('#9FF4FF')).setOrigin(1, 0.5);
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
