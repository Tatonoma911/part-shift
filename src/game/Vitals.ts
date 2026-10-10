import Phaser from 'phaser';
import elementsJson from '../data/design/elements.json';
import heroesJson from '../data/design/heroes.json';
import { C } from './layout';

/**
 * Health bars and weakness orbs over units and buildings (ui/UI_SPEC.md §3.5,
 * Антон 2026-10-09: "чтобы было понятно, кто кого побеждает" and "шарики над
 * злодеями, какими силами его лучше убивать").
 *
 * Bars: a dark capsule with quarter ticks; our side in seam cyan, enemies in
 * the danger colour, buildings green → amber → danger. A white "lag" segment
 * shows the damage just taken and drains after it, so a fight reads at a glance.
 *
 * Orbs: one per technology the enemy is weak to, in the element colour from
 * design/data/elements.json, each with its own shape (colour-blind safe):
 * Огонь ▲, Лёд ✱, Молния ⚡, Токсин ●, Удар ■. Strong weakness (×1.5) gets a
 * bigger orb with a white ring.
 */
type Tech = 'thermo' | 'cryo' | 'volt' | 'toxin' | 'impact';
const TECHS: Tech[] = ['volt', 'cryo', 'thermo', 'toxin', 'impact'];

interface ElementsData {
  techs: { id: string; color: string }[];
  beats: Record<string, string>;
  defaultResistForOwnTech: number;
  defaultWeakToPredator: number;
}
interface HeroData {
  id: string;
  tech: string;
  enemy?: { resist?: Record<string, number> };
}

const ELEMENTS = elementsJson as unknown as ElementsData;
const HEROES = ((heroesJson as unknown as { heroes?: HeroData[] }).heroes ?? (heroesJson as unknown as HeroData[])) as HeroData[];

export const TECH_HEX: Record<string, number> = Object.fromEntries(ELEMENTS.techs.map((t) => [t.id, parseInt(t.color.slice(1), 16)]));

/** What beats `tech`: the technology whose `beats` points at it. */
function predatorOf(tech: string): string | undefined {
  return Object.keys(ELEMENTS.beats).find((k) => ELEMENTS.beats[k] === tech);
}

export interface Weakness {
  tech: Tech;
  strong: boolean;
}

/** Weaknesses from a resist table: every tech with a multiplier above 1, strongest first. */
export function weaknessesFrom(resist: Partial<Record<string, number>> | undefined): Weakness[] {
  if (!resist) return [];
  return TECHS.filter((t) => (resist[t] ?? 1) > 1.001)
    .map((t) => ({ tech: t, strong: (resist[t] ?? 1) >= 1.5, m: resist[t] ?? 1 }))
    .sort((a, b) => b.m - a.m)
    .map(({ tech, strong }) => ({ tech, strong }));
}

/**
 * Weaknesses of an enemy: a maddened hero by id (heroes.json), otherwise an
 * adaptant of a technology (weak to its predator, elements.json defaults).
 */
export function weaknessesOf(opts: { heroId?: string; tech?: string; resist?: Record<string, number> }): Weakness[] {
  if (opts.resist) return weaknessesFrom(opts.resist);
  const hero = opts.heroId ? HEROES.find((h) => h.id === opts.heroId) : undefined;
  if (hero?.enemy?.resist) return weaknessesFrom(hero.enemy.resist);
  if (opts.tech) {
    const p = predatorOf(opts.tech);
    if (p) return [{ tech: p as Tech, strong: ELEMENTS.defaultWeakToPredator >= 1.5 }];
  }
  return [];
}

type G = Phaser.GameObjects.Graphics;

/** Small shape inside an orb, white on the element colour. */
function techGlyph(g: G, tech: Tech, x: number, y: number, r: number): void {
  g.fillStyle(0x10171c, 0.9);
  g.lineStyle(Math.max(1.5, r * 0.28), 0x10171c, 0.9);
  switch (tech) {
    case 'thermo':
      g.fillTriangle(x, y - r * 0.62, x + r * 0.58, y + r * 0.45, x - r * 0.58, y + r * 0.45);
      break;
    case 'cryo':
      for (let k = 0; k < 3; k++) {
        const a = (Math.PI / 3) * k + Math.PI / 2;
        g.lineBetween(x - Math.cos(a) * r * 0.62, y - Math.sin(a) * r * 0.62, x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62);
      }
      break;
    case 'volt':
      g.fillTriangle(x + r * 0.15, y - r * 0.7, x - r * 0.45, y + r * 0.1, x + r * 0.05, y + r * 0.1);
      g.fillTriangle(x - r * 0.15, y + r * 0.7, x + r * 0.45, y - r * 0.1, x - r * 0.05, y - r * 0.1);
      break;
    case 'toxin':
      g.fillCircle(x, y + r * 0.15, r * 0.42);
      g.fillTriangle(x - r * 0.36, y, x + r * 0.36, y, x, y - r * 0.65);
      break;
    case 'impact':
      g.fillRect(x - r * 0.42, y - r * 0.42, r * 0.84, r * 0.84);
      break;
  }
}

/** A single tech orb (no shadow) — use when embedding in other graphics layers. */
export function drawTechOrb(g: G, tech: string, x: number, y: number, r: number): void {
  g.fillStyle(TECH_HEX[tech] ?? 0xffffff, 1);
  g.fillCircle(x, y, r);
  g.lineStyle(1.5, 0xffffff, 0.8);
  g.strokeCircle(x, y, r);
  techGlyph(g, tech as Tech, x, y, r);
}

/** A row of weakness orbs centred on (x, y). Returns the row width. */
export function drawWeakOrbs(g: G, x: number, y: number, weak: Weakness[], max = 3): number {
  const list = weak.slice(0, max);
  if (!list.length) return 0;
  const sizes = list.map((w) => (w.strong ? 16 : 13));
  const gap = 5;
  const total = sizes.reduce((s, r) => s + r * 2, 0) + gap * (list.length - 1);
  let cx = x - total / 2;
  list.forEach((w, i) => {
    const r = sizes[i];
    cx += r;
    g.fillStyle(0x0b1117, 0.65);
    g.fillCircle(cx + 1, y + 2, r + 2);
    g.fillStyle(TECH_HEX[w.tech] ?? 0xffffff, 1);
    g.fillCircle(cx, y, r);
    g.lineStyle(w.strong ? 3 : 2, 0xffffff, w.strong ? 1 : 0.85);
    g.strokeCircle(cx, y, r);
    techGlyph(g, w.tech, cx, y, r);
    cx += r + gap;
  });
  return total;
}

export type BarSide = 'ally' | 'enemy' | 'building';

/**
 * Remembers the last shown fraction per id so a white "damage" segment can
 * trail the real value and drain over ~0.6 s.
 */
export class Bars {
  private lag = new Map<string, { lag: number; last: number; hitAt: number; t: number }>();

  draw(g: G, id: string, x: number, y: number, width: number, frac: number, side: BarSide, now: number): void {
    const f = Phaser.Math.Clamp(frac, 0, 1);
    const st = this.lag.get(id) ?? { lag: f, last: f, hitAt: 0, t: now };
    if (f < st.last) {
      st.lag = Math.max(st.lag, st.last);
      st.hitAt = now;
    }
    // Hold the white segment for 250 ms, then drain it at 160 % of the bar per second.
    if (now - st.hitAt > 250) st.lag = Math.max(f, st.lag - ((now - st.t) / 1000) * 1.6);
    if (st.lag < f) st.lag = f;
    st.last = f;
    st.t = now;
    this.lag.set(id, st);
    const shown = st.lag;

    const h = 8;
    const r = h / 2 + 2;
    g.fillStyle(0x0b1117, 0.82);
    g.fillRoundedRect(x - 3, y - 3, width + 6, h + 6, r);
    const color =
      side === 'enemy' ? C.coralInk : side === 'ally' ? (f > 0.35 ? C.seam : C.amber) : f > 0.6 ? C.green : f > 0.3 ? C.amber : C.coralInk;
    if (shown > f) {
      g.fillStyle(0xffffff, 0.9);
      g.fillRoundedRect(x, y, Math.max(h, width * shown), h, h / 2);
    }
    if (f > 0) {
      g.fillStyle(color, 1);
      g.fillRoundedRect(x, y, Math.max(h, width * f), h, h / 2);
      g.fillStyle(0xffffff, 0.25);
      g.fillRect(x + h / 2, y + 1, Math.max(0, width * f - h), 2);
    }
    // Quarter ticks so "half health" is readable without numbers.
    g.fillStyle(0x0b1117, 0.6);
    for (let k = 1; k < 4; k++) g.fillRect(x + (width * k) / 4 - 0.75, y, 1.5, h);
  }

  forget(id: string): void {
    this.lag.delete(id);
  }
}
