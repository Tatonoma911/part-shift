import Phaser from 'phaser';
import { hasText, t } from '../i18n';
import { playIntro } from '../intro';
import { openLibrary } from './library';
import { setBackHandler } from '../platform/native';
import { sound } from './audio';
import { preloadComm } from './Comm';
import { HEROES as HERO_INFO } from './meta/store';
import { C, INK, LANDSCAPE, VIEW } from './layout';
import { drawMenuBackdrop } from './MenuBackdrop';
import { FOLLOW } from '../social/config';
import { chip, plate, TXT } from './ui';
import { drawTechOrb } from './Vitals';

/**
 * «Познакомиться со вселенной» (Антон 10.10 11:22: «чтобы люди влюблялись в этих персонажей, в этот город,
 * чтобы хотели изучать это, читать, смотреть, подписываться»).
 * A short, beautiful door into the universe from the game:
 *   - the heroes as big comic figures with their bios, swipe through them, tap opens the hero's page on the site;
 *   - four comic tiles: comics and the artbook (open here, game/library.ts), the city under the Dome (site page), the intro comic (plays here);
 *   - «Следите за сменой»: YouTube Shorts and Instagram (hidden until the links exist) and the universe site.
 * The stories themselves live on the site (Сайт вселенной thread), so nothing is written twice.
 * One layer: comic art + BRAND_UI plates.
 */

const heroName = (id: string): string => (hasText(`ally.${id}.name`) ? t(`ally.${id}.name`) : t(`enemy.${id}.name`));
const techOf = (id: string): string => HERO_INFO.find((h) => h.id === id)?.tech ?? 'kinetic';
/** The site when the game runs elsewhere (Android app, previews). On GitHub Pages the game sits at /play/ under it. */
const SITE_URL = 'https://tatonoma911.github.io/part-shift/';

export function siteBase(): string {
  const p = location.pathname;
  const at = p.indexOf('/play/');
  if (location.protocol.startsWith('http') && at >= 0) return `${location.origin}${p.slice(0, at + 1)}`;
  return SITE_URL;
}

export function openExternal(url: string): void {
  window.open(url, '_blank', 'noopener');
}

/** Order of the heroes: the four starters first (the player knows them), then the rest of HeroOut. */
const HEROES = ['standard', 'patch', 'canopy', 'current', 'frostline', 'kiln', 'lineman', 'seraph', 'mason', 'sweep', 'beacon', 'hive', 'doctor', 'n73', 'demon'];

const PANEL = (f: string) => new URL(`../assets/comic/panels/${f}.jpg`, import.meta.url).href;
const TILES: { id: string; pic: string; hash?: string; lib?: 'comics' | 'artbook' }[] = [
  { id: 'comics', pic: 'city_rescue', lib: 'comics' },
  { id: 'world', pic: 'dome_city', hash: '#world' },
  { id: 'artbook', pic: 'heroes_team', lib: 'artbook' },
  { id: 'intro', pic: 'city_sunset' },
];

type Ev = Phaser.Types.Input.EventData;
const stop = (ev: Ev) => ev.stopPropagation();

export class UniverseScene extends Phaser.Scene {
  private strip: Phaser.GameObjects.Container | null = null;
  private scroll = 0;
  private maxScroll = 0;
  private stripX = 0;
  private drag: { x: number; s: number; moved: boolean } | null = null;
  private cards: { x: number; id: string }[] = [];
  private dots: Phaser.GameObjects.Graphics | null = null;
  private dotsY = 0;
  private cardW = 0;
  private playing = false;

  constructor() {
    super('universe');
  }

  preload(): void {
    // Comic portraits stand in for the full-height figures until menu_heroes art is in the build.
    if (!this.textures.exists('comm.kiln')) preloadComm(this);
    for (const tile of TILES) if (!this.textures.exists(`uni.${tile.pic}`)) this.load.image(`uni.${tile.pic}`, PANEL(tile.pic));
  }

  create(): void {
    const W = VIEW.width;
    const H = VIEW.height;
    drawMenuBackdrop(this);
    const veil = this.add.graphics();
    veil.fillStyle(0xf4f7f7, 0.55);
    veil.fillRect(0, 0, W, H);
    const pad = LANDSCAPE ? 48 : 28;
    // Head: back, title, one line of why.
    const bg = this.add.graphics();
    chip(bg, pad, 34, 88, 72, C.graphite, 1, 14);
    this.add.text(pad + 44, 70, '←', TXT.num(30, INK.white)).setOrigin(0.5);
    const back = this.add.zone(pad - 8, 26, 104, 88).setOrigin(0).setInteractive({ useHandCursor: true });
    back.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => {
      stop(ev);
      this.leave();
    });
    this.add.text(pad + 112, 40, t('universe.kicker').toUpperCase(), TXT.caps(INK.teal));
    const title = this.add.text(pad + 112, 62, t('universe.title'), TXT.num(LANDSCAPE ? 40 : 36, INK.graphite));
    if (title.width > W - pad * 2 - 112) title.setScale((W - pad * 2 - 112) / title.width);
    const lead = this.add.text(pad, 128, t('universe.lead'), { ...TXT.body(LANDSCAPE ? 22 : 23, INK.graphite, '600'), wordWrap: { width: W - pad * 2 }, lineSpacing: 4 });

    // Heroes: a swipe strip of big comic figures.
    const top = lead.y + lead.height + 48;
    // Tiles and the follow plate keep their size; the hero strip takes what is left (a long lead must not push them off screen,
    // or the follow button gets zero height and hovering it throws hitAreaCallback errors).
    const cols = LANDSCAPE ? 4 : 2;
    const gap = 18;
    const tw = (W - pad * 2 - gap * (cols - 1)) / cols;
    const th = LANDSCAPE ? 130 : 190;
    const rows = Math.ceil(TILES.length / cols);
    const below = (LANDSCAPE ? 16 : 44) + rows * (th + gap) + 10 + (LANDSCAPE ? 84 : 150) + 24;
    const stripH = Math.min(LANDSCAPE ? 440 : 640, H - top - below);
    this.cardW = LANDSCAPE ? Math.round(250 * Math.min(1, stripH / 440)) : 320;
    this.drawHeroes(pad, top, W - pad * 2, stripH);
    // Tiles.
    const ty = top + stripH + (LANDSCAPE ? 16 : 44);
    TILES.forEach((tile, k) => this.drawTile(pad + (k % cols) * (tw + gap), ty + Math.floor(k / cols) * (th + gap), tw, th, tile));
    // Follow.
    const fy = ty + rows * (th + gap) + 10;
    this.drawFollow(pad, fy, W - pad * 2, H - fy - 24);

    setBackHandler(() => {
      if (this.playing) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        return true;
      }
      this.leave();
      return true;
    });
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, dx: number, dy: number) => this.scrollTo(this.scroll + (Math.abs(dx) > Math.abs(dy) ? dx : dy)));
  }

  private leave(): void {
    sound.play('ui_tap');
    this.scene.start('menu');
  }

  private drawHeroes(x: number, y: number, w: number, h: number): void {
    // The strip's caption.
    this.add.text(x, y - 4, t('universe.heroes').toUpperCase(), TXT.caps(INK.deep)).setOrigin(0, 1);
    this.add.text(x + w, y - 4, t('universe.swipe'), TXT.body(18, INK.dim, '600')).setOrigin(1, 1);
    const strip = this.add.container(x, y + 12);
    this.strip = strip;
    this.stripX = x;
    const cw = this.cardW;
    const gap = 20;
    HEROES.forEach((id, k) => {
      const cx = k * (cw + gap);
      this.cards.push({ x: cx, id });
      strip.add(this.heroCard(cx, 0, cw, h - 40, id));
    });
    this.maxScroll = Math.max(0, HEROES.length * (cw + gap) - gap - w);
    const mask = this.make.graphics({}, false);
    mask.fillRect(x - 12, y, w + 24, h);
    strip.setMask(mask.createGeometryMask());
    // Dots under the strip.
    this.dots = this.add.graphics();
    this.dotsY = y + h - 10;
    this.drawDots();
    // Swipe: the zone covers the strip; a short tap opens the hero's page on the site.
    const zone = this.add.zone(x, y, w, h - 30).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => (this.drag = { x: p.x, s: this.scroll, moved: false }));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.drag || !p.isDown) return;
      if (Math.abs(p.x - this.drag.x) > 12) this.drag.moved = true;
      if (this.drag.moved) this.scrollTo(this.drag.s - (p.x - this.drag.x));
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      this.drag = null;
      if (!d || d.moved) return;
      const at = p.x - this.stripX + this.scroll;
      const hit = this.cards.find((c) => at >= c.x && at <= c.x + this.cardW);
      if (hit) {
        sound.play('ui_tap');
        openExternal(`${siteBase()}#hero-${hit.id}`);
      }
    });
  }

  private heroCard(x: number, y: number, w: number, h: number, id: string): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    // Comic page frame: ink border, offset shadow, paper inside.
    g.fillStyle(C.night, 0.2);
    g.fillRect(8, 10, w, h);
    g.fillStyle(C.graphite, 1);
    g.fillRect(-4, -4, w + 8, h + 8);
    g.fillStyle(0xfdfbf4, 1);
    g.fillRect(0, 0, w, h);
    const tech = techOf(id);
    // Element wash behind the figure.
    const tint = tech && tech !== 'kinetic' ? Phaser.Display.Color.HexStringToColor(this.techHex(tech)).color : 0xdfeef3;
    g.fillGradientStyle(tint, tint, 0xfdfbf4, 0xfdfbf4, 0.55, 0.55, 0, 0);
    g.fillRect(0, 0, w, h * 0.62);
    c.add(g);
    const picH = Math.round(h * 0.62);
    const key = `menuhero.${id}`;
    if (this.textures.exists(key)) {
      const img = this.add.image(w / 2, picH, key).setOrigin(0.5, 1);
      img.setScale(Math.min((picH - 16) / img.height, (w - 20) / img.width));
      c.add(img);
    } else if (this.textures.exists(`comm.${id}`) || this.textures.exists(`icon.hero_${id}`)) {
      const img = this.add.image(w / 2, picH / 2 + 8, this.textures.exists(`comm.${id}`) ? `comm.${id}` : `icon.hero_${id}`);
      img.setScale(Math.min((picH - 40) / img.height, (w - 40) / img.width));
      c.add(img);
    }
    const og = this.add.graphics();
    drawTechOrb(og, tech, 30, 30, 16);
    c.add(og);
    // Name plate across the bottom of the picture, like a comic caption.
    const name = this.add.text(16, picH + 2, heroName(id).toUpperCase(), { ...TXT.num(LANDSCAPE ? 20 : 24, INK.graphite), backgroundColor: '#FFE14D', padding: { x: 10, y: 6 } }).setOrigin(0, 0.5);
    if (name.width > w - 32) name.setScale((w - 32) / name.width);
    c.add(name);
    const bioKey = `ally.${id}.bio`;
    if (hasText(bioKey)) {
      const bio = this.add.text(16, picH + 30, t(bioKey), { ...TXT.body(LANDSCAPE ? 16 : 18, INK.graphite, '500'), wordWrap: { width: w - 32 }, lineSpacing: 2 });
      // Whole lines only: the rest of the story is one tap away on the site.
      const room = h - picH - 30 - 40;
      let words = t(bioKey).split(' ');
      while (bio.height > room && words.length > 4) {
        words = words.slice(0, -1);
        bio.setText(`${words.join(' ').replace(/[,.;:—-]+$/, '')}…`);
      }
      c.add(bio);
    }
    c.add(this.add.text(w - 16, h - 14, `${t('universe.more')} →`, TXT.body(LANDSCAPE ? 15 : 17, INK.teal, '800')).setOrigin(1, 1));
    return c;
  }

  private techHex(tech: string): string {
    return ({ thermo: '#FF8A3D', cryo: '#3DD6FF', volt: '#FFE14D', toxin: '#8CE04A', impact: '#C9B8A3' } as Record<string, string>)[tech] ?? '#DFEEF3';
  }

  private scrollTo(v: number): void {
    this.scroll = Phaser.Math.Clamp(v, 0, this.maxScroll);
    if (this.strip) this.strip.x = this.stripX - this.scroll;
    this.drawDots();
  }

  private drawDots(): void {
    const g = this.dots;
    if (!g) return;
    g.clear();
    const n = HEROES.length;
    const cur = Math.round((this.scroll / Math.max(1, this.maxScroll)) * (n - 1));
    const step = 18;
    const x0 = VIEW.width / 2 - ((n - 1) * step) / 2;
    for (let k = 0; k < n; k++) {
      g.fillStyle(k === cur ? C.teal : C.graphite, k === cur ? 1 : 0.25);
      g.fillCircle(x0 + k * step, this.dotsY, k === cur ? 6 : 4);
    }
  }

  private drawTile(x: number, y: number, w: number, h: number, tile: (typeof TILES)[number]): void {
    const g = this.add.graphics();
    g.fillStyle(C.night, 0.2);
    g.fillRect(x + 6, y + 8, w, h);
    g.fillStyle(C.graphite, 1);
    g.fillRect(x - 4, y - 4, w + 8, h + 8);
    const key = `uni.${tile.pic}`;
    if (this.textures.exists(key)) {
      const img = this.add.image(x + w / 2, y + h / 2, key);
      img.setScale(Math.max(w / img.width, h / img.height));
      const m = this.make.graphics({}, false);
      m.fillRect(x, y, w, h);
      img.setMask(m.createGeometryMask());
    }
    const cap = this.add.text(x + 12, y + h - 12, t(`universe.tile.${tile.id}`).toUpperCase(), { ...TXT.caps(INK.graphite), backgroundColor: '#FFE14D', padding: { x: 10, y: 6 } }).setOrigin(0, 1);
    if (cap.width > w - 24) cap.setScale((w - 24) / cap.width);
    const hit = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => {
      stop(ev);
      sound.play('ui_tap');
      if (tile.hash) return openExternal(`${siteBase()}${tile.hash}`);
      // Comics, the artbook and the intro comic open right here, over this screen.
      this.input.enabled = false;
      this.playing = true;
      (tile.lib ? openLibrary(tile.lib) : playIntro({ skipGate: true })).finally(() => {
        this.playing = false;
        if (this.scene.isActive()) this.input.enabled = true;
      });
    });
  }

  /** «Следите за сменой»: the socials that have links, and the universe site. */
  private drawFollow(x: number, y: number, w: number, h: number): void {
    const g = this.add.graphics();
    const ph = Math.min(h, LANDSCAPE ? 84 : 150);
    plate(g, x, y, w, ph, 20);
    const inX = x + 24;
    const links = FOLLOW.filter((f) => f.url);
    const btns: { label: string; color: number; ink: string; url: string }[] = [
      ...links.map((f) => ({ label: t(`universe.follow.${f.id}`), color: f.id === 'youtube' ? 0xff0033 : 0xc13584, ink: INK.white, url: f.url })),
      { label: t('universe.site'), color: C.teal, ink: INK.white, url: siteBase() },
    ];
    const capW = LANDSCAPE ? 300 : w - 48;
    this.add.text(inX, y + (LANDSCAPE ? ph / 2 : 34), t('universe.follow').toUpperCase(), TXT.caps(INK.deep)).setOrigin(0, 0.5);
    const bx0 = LANDSCAPE ? inX + capW : inX;
    const by = LANDSCAPE ? y + 16 : y + 62;
    const bh = LANDSCAPE ? ph - 32 : 68;
    const gap = 14;
    const bw = (x + w - 24 - bx0 - gap * (btns.length - 1)) / btns.length;
    btns.forEach((b, k) => {
      const bx = bx0 + k * (bw + gap);
      const bg = this.add.graphics();
      chip(bg, bx, by, bw, bh, b.color, 1, 14);
      const tl = this.add.text(bx + bw / 2, by + bh / 2, b.label, TXT.body(22, b.ink, '800')).setOrigin(0.5);
      if (tl.width > bw - 20) tl.setScale((bw - 20) / tl.width);
      const hit = this.add.zone(bx, by, bw, bh).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => {
        stop(ev);
        sound.play('ui_tap');
        openExternal(b.url);
      });
    });
  }
}

/**
 * The menu's door into the universe: a big comic call-to-action under the three heroes on call
 * (Антон 11:22: «отдельная кнопка на большой левой части, там, где три персонажа, где-то внизу»).
 */
export function universeButton(scene: Phaser.Scene, cx: number, y: number, w: number, onTap: () => void): Phaser.GameObjects.Container {
  const h = LANDSCAPE ? 76 : 80;
  const c = scene.add.container(cx - w / 2, y);
  const g = scene.add.graphics();
  g.fillStyle(C.night, 0.3);
  g.fillRect(8, 10, w, h);
  g.fillStyle(C.graphite, 1);
  g.fillRect(-4, -4, w + 8, h + 8);
  g.fillStyle(0xffe14d, 1);
  g.fillRect(0, 0, w, h);
  // A book-and-star mark on the left: «the world has stories».
  g.fillStyle(C.graphite, 1);
  g.fillRect(20, h / 2 - 18, 40, 36);
  g.fillStyle(0xffe14d, 1);
  g.fillRect(24, h / 2 - 14, 15, 28);
  g.fillRect(41, h / 2 - 14, 15, 28);
  c.add(g);
  const label = scene.add.text(80, h / 2, t('universe.button'), TXT.body(LANDSCAPE ? 25 : 27, INK.graphite, '800')).setOrigin(0, 0.5);
  const room = w - 80 - 56;
  if (label.width > room) label.setScale(room / label.width);
  c.add(label);
  c.add(scene.add.text(w - 22, h / 2, '→', TXT.num(28, INK.graphite)).setOrigin(1, 0.5));
  // A soft light pass every few seconds draws the eye without moving any character.
  const shine = scene.add.graphics();
  shine.fillStyle(0xffffff, 0.45);
  shine.fillPoints([new Phaser.Math.Vector2(0, 0), new Phaser.Math.Vector2(26, 0), new Phaser.Math.Vector2(6, h), new Phaser.Math.Vector2(-20, h)], true);
  const sm = scene.make.graphics({}, false);
  c.add(shine);
  const place = () => {
    sm.clear();
    sm.fillRect(c.x, c.y, w, h);
  };
  place();
  shine.setMask(sm.createGeometryMask());
  scene.tweens.add({ targets: shine, x: { from: -40, to: w + 40 }, duration: 900, delay: 2600, repeat: -1, repeatDelay: 2600, ease: 'Sine.easeInOut' });
  const hit = scene.add.zone(-4, -4, w + 8, h + 8).setOrigin(0).setInteractive({ useHandCursor: true });
  hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => {
    stop(ev);
    sound.play('ui_tap');
    onTap();
  });
  c.add(hit);
  return c;
}
