import Phaser from 'phaser';
import commJson from '../data/text/comm.json';
import type { GameEvent } from '../core/world';
import { lang, t } from '../i18n';
import { sound } from './audio';
import { UI_DEPTH } from './cameras';
import { BOARD, DOCK, INK, LANDSCAPE } from './layout';
import { TECH_HEX, techOrb } from './techIcon';
import { plate, TXT } from './ui';
import heroesJson from '../data/design/heroes.json';

/**
 * Comix Zone style pop-up: a round artbook portrait of a maddened hero slides
 * out of the board's top-left corner with a comic speech bubble.
 * Lines and portraits: text/comm.json and art/comm (copied by `npm run sync-data`).
 */

interface Line {
  ru: string;
  en: string;
}
interface HeroComm {
  name: Line;
  tech: string;
  portrait: string;
  voice: string;
  lines: Line[];
  build: Line[];
  defeat: Line;
}

/** Heroes cut from the game: the infected Standard was removed for good (Антон, 2026-10-10). */
const RETIRED = new Set(['standard']);
const HEROES = Object.fromEntries(
  Object.entries((commJson as unknown as { heroes: Record<string, HeroComm> }).heroes).filter(([id]) => !RETIRED.has(id)),
);
const IDS = Object.keys(HEROES);
const RESIST: Record<string, Record<string, number>> = Object.fromEntries(
  (heroesJson as unknown as { heroes: { id: string; enemy: { resist: Record<string, number> } }[] }).heroes.map((x) => [x.id, x.enemy.resist]),
);

/** Elements that hit a hero harder (resist > 1 in design/data/heroes.json), strongest first; ×1.5 is a strong weakness. */
function weaknessOf(hero: string): { tech: string; strong: boolean }[] {
  return Object.entries(RESIST[hero] ?? {})
    .filter(([, m]) => m > 1.001)
    .sort((a, b) => b[1] - a[1])
    .map(([tech, m]) => ({ tech, strong: m >= 1.5 }));
}
const portraits = import.meta.glob('../assets/comm/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const BAG_KEY = 'partshift.comm.bag.v1';
const DEPTH = UI_DEPTH + 5;
/** Portrait radius on the 2× canvas. */
const R = 70;
/** Quiet time after a pop-up before an optional one may show. */
const COOLDOWN_MS = 9000;

export function preloadComm(scene: Phaser.Scene): void {
  for (const [path, url] of Object.entries(portraits)) {
    const id = path.match(/\/([\w-]+)\.webp$/)?.[1];
    if (id) scene.load.image(`comm.${id}`, url);
  }
}

type Kind = 'lines' | 'build' | 'defeat';
interface Pop {
  hero: string;
  kind: Kind;
  priority: boolean;
}

export class Comm {
  private box: Phaser.GameObjects.Container | null = null;
  private queued: Pop | null = null;
  private quietUntil = 0;
  private typer: Phaser.Time.TimerEvent | null = null;
  private hideTimer: Phaser.Time.TimerEvent | null = null;
  private recent: string[] = [];
  private greeted = false;

  constructor(private scene: Phaser.Scene) {}

  /** World events that bring a hero on the line. */
  onEvent(e: GameEvent): void {
    switch (e.type) {
      case 'hero_spawn':
        if (e.text && HEROES[e.text]) this.push({ hero: e.text, kind: 'lines', priority: true });
        break;
      case 'hero_defeated':
        if (e.text && HEROES[e.text]) this.push({ hero: e.text, kind: 'defeat', priority: true });
        break;
      // The call target (any hero, not only the Demon) warns before it comes out; its spawn and fall are hero_spawn / hero_defeated.
      case 'boss_warning':
        if (e.text && HEROES[e.text]) this.push({ hero: e.text, kind: 'lines', priority: true });
        break;
      case 'build_place':
        // The command center goes down: the first hero cuts into the city channel.
        if (!this.greeted) {
          this.greeted = true;
          this.scene.time.delayedCall(2500, () => this.push({ hero: this.nextHero(), kind: 'lines', priority: true }));
        }
        break;
      case 'threat_level_up':
        this.push({ hero: this.nextHero(), kind: 'lines', priority: true });
        break;
      case 'nest_open':
      case 'heavy_nest_open':
        if (Math.random() < 0.5) this.push({ hero: this.nextHero(), kind: 'lines', priority: false });
        break;
      case 'build_done':
        if (Math.random() < 0.75) this.push({ hero: this.nextHero(), kind: 'build', priority: false });
        break;
    }
  }

  /** Heroes take turns from a shuffled bag kept between shifts, so players meet all of them. */
  private nextHero(): string {
    let bag: string[] = [];
    try {
      bag = (JSON.parse(localStorage.getItem(BAG_KEY) ?? '[]') as string[]).filter((id) => HEROES[id] && id !== 'demon');
    } catch {
      /* ignore */
    }
    if (!bag.length) bag = Phaser.Utils.Array.Shuffle(IDS.filter((id) => id !== 'demon'));
    const id = bag.shift()!;
    try {
      localStorage.setItem(BAG_KEY, JSON.stringify(bag));
    } catch {
      /* ignore */
    }
    return id;
  }

  private push(p: Pop): void {
    if (this.box) {
      if (p.priority || !this.queued) this.queued = p;
      return;
    }
    if (!p.priority && this.scene.time.now < this.quietUntil) return;
    this.show(p);
  }

  private pickLine(p: Pop): Line {
    const h = HEROES[p.hero];
    if (p.kind === 'defeat') return h.defeat;
    const pool = h[p.kind];
    const fresh = pool.filter((l) => !this.recent.includes(l.ru));
    const line = Phaser.Utils.Array.GetRandom(fresh.length ? fresh : pool);
    this.recent = [line.ru, ...this.recent].slice(0, 24);
    return line;
  }

  private show(p: Pop): void {
    const s = this.scene;
    const h = HEROES[p.hero];
    const text = this.pickLine(p)[lang];
    const tech = TECH_HEX[h.tech] ?? 0xffffff;

    // F-11: on a wide screen the call sits in the right panel (over the dock), never over the field.
    const area = LANDSCAPE ? DOCK : BOARD;
    const cx = area.x + 16 + R;
    const cy = area.y + 16 + R;
    const box = s.add.container(cx, cy).setDepth(DEPTH);

    // Portrait: ink ring, element ring, round artbook face.
    const ring = s.add.graphics();
    ring.fillStyle(0x0b1117, 0.25).fillCircle(4, 8, R + 8);
    ring.fillStyle(0x10171c, 1).fillCircle(0, 0, R + 8);
    ring.fillStyle(tech, 1).fillCircle(0, 0, R + 3);
    const face = s.textures.exists(`comm.${h.portrait}`) ? s.add.image(0, 0, `comm.${h.portrait}`).setDisplaySize(R * 2 - 2, R * 2 - 2) : null;
    const name = s.add.text(0, R + 4, h.name[lang].toUpperCase(), { ...TXT.caps(INK.white), fontSize: '16px', backgroundColor: '#10171C', padding: { x: 10, y: 5 } }).setOrigin(0.5, 0.5);
    const head = s.add.container(0, 0, face ? [ring, face, name] : [ring, name]);

    // Speech bubble: white, thick ink outline, tail pointing at the face.
    const maxW = Math.min(480, area.x + area.w - (cx + R + 30) - 16);
    const body = s.add.text(0, 0, text, { ...TXT.body(24, INK.graphite, '700'), lineSpacing: 3, wordWrap: { width: maxW - 40, useAdvancedWrap: true } });
    // Footer: the hero's element and what beats it, so the player knows whom to send.
    // Same orbs as over enemies on the board (UI_SPEC §3.5).
    const orbs = s.add.graphics();
    const label = (tech: string) => s.add.text(0, 0, t(`tech.${tech}`).toUpperCase(), { ...TXT.caps(INK.graphite), fontSize: '14px' });
    const foot: { obj: Phaser.GameObjects.Text; orb?: string; strong?: boolean }[] = [];
    if (h.tech !== 'kinetic') foot.push({ obj: label(h.tech), orb: h.tech });
    else foot.push({ obj: label('kinetic') });
    const weak = weaknessOf(p.hero);
    if (weak.length) {
      foot.push({ obj: s.add.text(0, 0, t('resist.weak_to', { tech: '' }).trim(), TXT.body(19, INK.dim, '700')) });
      for (const w of weak) foot.push({ obj: label(w.tech), orb: w.tech, strong: w.strong });
    } else foot.push({ obj: s.add.text(0, 0, t('comm.no_weakness'), TXT.body(19, INK.dim, '700')) });
    const ORB = 11;
    const itemW = (f: (typeof foot)[number]) => f.obj.width + (f.orb ? ORB * 2 + 6 : 0);
    const rowW = (row: typeof foot) => row.reduce((sum, f) => sum + itemW(f) + 12, -12);
    // Element and weaknesses on one line when they fit, else the weaknesses get their own line.
    const rows = rowW(foot) + 40 <= maxW ? [foot] : [foot.slice(0, 1), foot.slice(1)];
    const bw = Math.max(170, Math.min(maxW, Math.max(body.width, ...rows.map(rowW)) + 40));
    const bh = body.height + 30 + 10 + rows.length * 34;
    const bx = R + 30;
    const by = -R + 6;
    const bubble = s.add.graphics();
    const draw = (color: number, grow: number) => {
      bubble.fillStyle(color, 1);
      bubble.fillRoundedRect(bx - grow, by - grow, bw + grow * 2, bh + grow * 2, 22 + grow);
      bubble.fillTriangle(bx - 24 - grow * 1.6, by + 44, bx + 2, by + 22 - grow, bx + 2, by + 58 + grow);
    };
    draw(0x10171c, 4);
    draw(0xffffff, 0);
    const footTop = by + bh - 12 - rows.length * 34;
    bubble.lineStyle(2, 0xdde4e8, 1).lineBetween(bx + 16, footTop, bx + bw - 16, footTop);
    rows.forEach((row, i) => {
      let fx = bx + 20;
      const fy = footTop + 22 + i * 34;
      for (const f of row) {
        if (f.orb) techOrb(orbs, f.orb, fx + ORB, fy, ORB, f.strong);
        f.obj.setOrigin(0, 0.5).setPosition(fx + (f.orb ? ORB * 2 + 6 : 0), fy);
        fx += itemW(f) + 12;
      }
    });
    body.setPosition(bx + 20, by + 15).setText('');
    const talk = s.add.container(0, 0, [bubble, body, orbs, ...foot.map((f) => f.obj)]).setAlpha(0).setScale(0.6);

    // On the dock the call gets its own plate, so the dock's hint text doesn't show through.
    if (LANDSCAPE) {
      const back = s.add.graphics();
      plate(back, DOCK.x - cx, DOCK.y - cy, DOCK.w, DOCK.h, 28);
      box.add(back);
    }
    box.add([talk, head]);
    head.setScale(0.2).setAngle(-12);
    s.tweens.add({ targets: head, scale: 1, angle: 0, duration: 280, ease: 'Back.easeOut' });
    s.tweens.add({ targets: talk, alpha: 1, scale: 1, duration: 200, delay: 140, ease: 'Back.easeOut' });

    // No hit area: the pop-up never takes a tap meant for the board under it.
    this.box = box;

    s.time.delayedCall(160, () => sound.play(h.voice));
    // Typewriter by elapsed time, so slow frames don't slow the reading down.
    const t0 = s.time.now;
    this.typer = s.time.addEvent({
      delay: 30,
      loop: true,
      callback: () => {
        const n = Math.min(text.length, Math.ceil((s.time.now - t0) / 20));
        body.setText(text.slice(0, n));
        if (n >= text.length) this.typer?.remove();
      },
    });
    const holdMs = Math.min(7000, 2200 + text.length * 55);
    this.hideTimer = s.time.delayedCall(holdMs, () => this.hide());
  }

  private hide(): void {
    const box = this.box;
    if (!box) return;
    this.box = null;
    this.typer?.remove();
    this.hideTimer?.remove();
    this.quietUntil = this.scene.time.now + COOLDOWN_MS;
    this.scene.tweens.add({
      targets: box,
      alpha: 0,
      x: box.x - 40,
      duration: 180,
      onComplete: () => {
        box.destroy();
        const next = this.queued;
        this.queued = null;
        if (next) this.scene.time.delayedCall(400, () => this.push({ ...next, priority: true }));
      },
    });
  }

  destroy(): void {
    this.typer?.remove();
    this.hideTimer?.remove();
    this.box?.destroy();
    this.box = null;
    this.queued = null;
  }
}
