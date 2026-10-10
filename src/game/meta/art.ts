import Phaser from 'phaser';
import { C } from '../layout';
import { preloadAwards } from './Awards';
import type { HeroState } from './store';

/**
 * Shared drawing for the meta screens: comic hero portraits (art/comm/game,
 * the same round 192 px webp the radio pop-up uses), boon icons, rank badges.
 * Style per layer: these screens belong to the comic/menu layer, so portraits
 * are the comic ones, never the pixel sprites.
 */
const urls = import.meta.glob('../../assets/comm/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** Hero parts as drawn by the artist (art/export/trophies/<partId>.png, first pose of each sheet). */
const trophies = import.meta.glob('../../assets/art/trophies/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export function preloadMetaArt(scene: Phaser.Scene): void {
  for (const [path, url] of Object.entries(urls)) {
    const id = path.match(/([\w-]+)\.webp$/)?.[1];
    if (id && !scene.textures.exists(`comm.${id}`)) scene.load.image(`comm.${id}`, url);
  }
  for (const [path, url] of Object.entries(trophies)) {
    const id = path.match(/([\w-]+)\.png$/)?.[1];
    if (id && !scene.textures.exists(`trophy.${id}`)) scene.load.image(`trophy.${id}`, url);
  }
  preloadAwards(scene);
}

type G = Phaser.GameObjects.Graphics;

/**
 * Round portrait with an ink ring. Unknown heroes are a dark silhouette with "?",
 * seen ones are full colour with a danger ring, returned ones get the seam ring.
 */
export function portrait(scene: Phaser.Scene, x: number, y: number, r: number, id: string, state: HeroState): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x0b1117, 0.25);
  g.fillCircle(2, 4, r + 4);
  g.fillStyle(state === 'unknown' ? 0x22313c : 0xf3f2ee, 1);
  g.fillCircle(0, 0, r);
  c.add(g);
  const key = `comm.${id}`;
  if (scene.textures.exists(key)) {
    const img = scene.add.image(0, 0, key);
    img.setScale((r * 2) / img.width);
    if (state === 'unknown') img.setTintFill(0x10171c).setAlpha(0.92);
    c.add(img);
  }
  const ring = scene.add.graphics();
  ring.lineStyle(Math.max(3, r * 0.08), C.graphite, 1);
  ring.strokeCircle(0, 0, r);
  if (state === 'unlocked') {
    ring.lineStyle(Math.max(2, r * 0.05), C.seam, 1);
    ring.strokeCircle(0, 0, r + Math.max(4, r * 0.1));
  } else if (state === 'seen') {
    ring.lineStyle(Math.max(2, r * 0.05), C.coral, 0.9);
    ring.strokeCircle(0, 0, r + Math.max(4, r * 0.1));
  }
  c.add(ring);
  if (state === 'unknown') {
    c.add(
      scene.add
        .text(0, 2, '?', { fontFamily: 'Unbounded, sans-serif', fontStyle: '800', fontSize: `${Math.round(r * 0.9)}px`, color: '#57D8F2' })
        .setOrigin(0.5),
    );
  }
  return c;
}

const V = (x: number, y: number) => new Phaser.Math.Vector2(x, y);

/** Vector boon icon on a dark rounded tile until the artist's `icon.boon_<id>` arrives. */
export function boonIcon(scene: Phaser.Scene, x: number, y: number, size: number, id: string, rare: boolean): Phaser.GameObjects.GameObject[] {
  const key = `icon.boon_${id}`;
  const g = scene.add.graphics();
  const h = size / 2;
  // The artist's comic icon has its own dark ink, so it sits on a light tile; the vector fallback glows on a dark one.
  const drawn = scene.textures.exists(key);
  g.fillStyle(drawn ? (rare ? 0xfff1d6 : C.paper2) : rare ? 0x2a1d06 : C.graphite, 1);
  g.fillRoundedRect(x - h, y - h, size, size, size * 0.22);
  g.lineStyle(3, rare ? C.amber : C.seam, 1);
  g.strokeRoundedRect(x - h + 5, y - h + 5, size - 10, size - 10, size * 0.18);
  if (drawn) {
    const img = scene.add.image(x, y, key);
    img.setScale((size * 0.84) / Math.max(img.width, img.height));
    return [g, img];
  }
  const s = size * 0.3;
  const ink = rare ? 0xffd27a : C.glow;
  g.fillStyle(ink, 1);
  g.lineStyle(Math.max(3, size * 0.05), ink, 1);
  switch (id) {
    case 'energy_cache': // battery
      g.fillRect(x - s * 0.55, y - s * 0.75, s * 1.1, s * 1.6);
      g.fillRect(x - s * 0.22, y - s * 0.95, s * 0.44, s * 0.2);
      g.fillStyle(rare ? 0x2a1d06 : C.graphite, 1);
      g.fillTriangle(x + s * 0.1, y - s * 0.5, x - s * 0.3, y + s * 0.1, x, y + s * 0.1);
      g.fillTriangle(x - s * 0.1, y + s * 0.55, x + s * 0.3, y - s * 0.05, x, y - s * 0.05);
      break;
    case 'reactor_overclock': // reactor ring + arrow up
      g.strokeCircle(x - s * 0.15, y + s * 0.15, s * 0.65);
      g.fillCircle(x - s * 0.15, y + s * 0.15, s * 0.25);
      g.fillTriangle(x + s * 0.65, y - s, x + s * 1.05, y - s * 0.45, x + s * 0.25, y - s * 0.45);
      g.fillRect(x + s * 0.55, y - s * 0.5, s * 0.2, s * 0.6);
      break;
    case 'sharp_shovels': // shovel
      g.lineBetween(x - s * 0.8, y - s * 0.8, x + s * 0.25, y + s * 0.25);
      g.fillPoints([V(x + s * 0.05, y + s * 0.05), V(x + s * 0.7, y + s * 0.2), V(x + s * 0.95, y + s * 0.95), V(x + s * 0.2, y + s * 0.7)], true);
      g.lineBetween(x - s * 1.0, y - s * 0.6, x - s * 0.6, y - s * 1.0);
      break;
    case 'reinforcements': // two figures and a plus
      for (const dx of [-0.45, 0.25]) {
        g.fillCircle(x + s * dx, y - s * 0.45, s * 0.24);
        g.fillRoundedRect(x + s * (dx - 0.3), y - s * 0.15, s * 0.6, s * 0.85, s * 0.2);
      }
      g.fillRect(x + s * 0.75, y - s * 0.95, s * 0.14, s * 0.5);
      g.fillRect(x + s * 0.57, y - s * 0.77, s * 0.5, s * 0.14);
      break;
    case 'field_training': // graduation cap
      g.fillPoints([V(x, y - s * 0.7), V(x + s, y - s * 0.25), V(x, y + s * 0.2), V(x - s, y - s * 0.25)], true);
      g.fillRect(x - s * 0.5, y, s, s * 0.45);
      g.lineBetween(x + s * 0.8, y - s * 0.2, x + s * 0.8, y + s * 0.5);
      break;
    case 'armor_plates': // shield
      g.fillPoints([V(x - s * 0.75, y - s * 0.75), V(x + s * 0.75, y - s * 0.75), V(x + s * 0.7, y + s * 0.1), V(x, y + s * 0.9), V(x - s * 0.7, y + s * 0.1)], true);
      break;
    case 'drone_scan': // drone with radar arcs
      g.fillRoundedRect(x - s * 0.45, y - s * 0.15, s * 0.9, s * 0.4, s * 0.12);
      g.lineBetween(x - s * 0.95, y - s * 0.35, x - s * 0.35, y - s * 0.35);
      g.lineBetween(x + s * 0.35, y - s * 0.35, x + s * 0.95, y - s * 0.35);
      g.beginPath();
      g.arc(x, y + s * 0.3, s * 0.6, Math.PI * 0.2, Math.PI * 0.8);
      g.strokePath();
      break;
    case 'first_aid': // cross
      g.fillRect(x - s * 0.25, y - s * 0.8, s * 0.5, s * 1.6);
      g.fillRect(x - s * 0.8, y - s * 0.25, s * 1.6, s * 0.5);
      break;
    case 'nest_tracker': // map pin
      g.fillCircle(x, y - s * 0.3, s * 0.55);
      g.fillTriangle(x - s * 0.48, y - s * 0.05, x + s * 0.48, y - s * 0.05, x, y + s * 0.9);
      g.fillStyle(rare ? 0x2a1d06 : C.graphite, 1);
      g.fillCircle(x, y - s * 0.3, s * 0.22);
      break;
    case 'spare_part': // gear
      for (let k = 0; k < 8; k++) {
        const a = (Math.PI / 4) * k;
        g.fillCircle(x + Math.cos(a) * s * 0.7, y + Math.sin(a) * s * 0.7, s * 0.2);
      }
      g.fillCircle(x, y, s * 0.65);
      g.fillStyle(rare ? 0x2a1d06 : C.graphite, 1);
      g.fillCircle(x, y, s * 0.25);
      break;
    case 'weak_spot': // crosshair
      g.strokeCircle(x, y, s * 0.7);
      g.lineBetween(x - s, y, x - s * 0.35, y);
      g.lineBetween(x + s * 0.35, y, x + s, y);
      g.lineBetween(x, y - s, x, y - s * 0.35);
      g.lineBetween(x, y + s * 0.35, x, y + s);
      g.fillCircle(x, y, s * 0.15);
      break;
    case 'hotline': // phone handset
      g.fillRoundedRect(x - s * 0.9, y - s * 0.55, s * 0.55, s * 0.4, s * 0.12);
      g.fillRoundedRect(x + s * 0.35, y - s * 0.55, s * 0.55, s * 0.4, s * 0.12);
      g.lineBetween(x - s * 0.55, y - s * 0.4, x + s * 0.55, y - s * 0.4);
      g.fillRoundedRect(x - s * 0.55, y, s * 1.1, s * 0.7, s * 0.15);
      break;
    default:
      g.fillCircle(x, y, s * 0.6);
  }
  return [g];
}

/** Rank badge: a shield with one chevron per rank step (vector, BRAND_UI). */
export function rankBadge(g: G, x: number, y: number, size: number, index: number): void {
  const s = size / 2;
  const top = index >= 6;
  g.fillStyle(0x0b1117, 0.2);
  g.fillPoints([V(x - s + 2, y - s + 4), V(x + s + 2, y - s + 4), V(x + s * 0.9 + 2, y + s * 0.2 + 4), V(x + 2, y + s + 4), V(x - s * 0.9 + 2, y + s * 0.2 + 4)], true);
  g.fillStyle(top ? C.amber : index >= 4 ? C.deep : C.graphite, 1);
  g.fillPoints([V(x - s, y - s), V(x + s, y - s), V(x + s * 0.9, y + s * 0.2), V(x, y + s), V(x - s * 0.9, y + s * 0.2)], true);
  g.lineStyle(Math.max(2, s * 0.08), C.seam, 1);
  g.strokePoints([V(x - s * 0.8, y - s * 0.82), V(x + s * 0.8, y - s * 0.82), V(x + s * 0.72, y + s * 0.12), V(x, y + s * 0.8), V(x - s * 0.72, y + s * 0.12)], true);
  // Chevrons: ranks 1..6, the top rank gets a star instead.
  g.fillStyle(top ? 0xffffff : C.glow, 1);
  if (top) {
    const pts: Phaser.Math.Vector2[] = [];
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (Math.PI / 5) * k;
      const r = k % 2 ? s * 0.22 : s * 0.5;
      pts.push(V(x + Math.cos(a) * r, y - s * 0.05 + Math.sin(a) * r));
    }
    g.fillPoints(pts, true);
    return;
  }
  const n = index + 1;
  const rows = Math.min(n, 3);
  const cols = Math.ceil(n / 3);
  for (let k = 0; k < n; k++) {
    const row = k % rows;
    const col = Math.floor(k / rows);
    const cx = x + (col - (cols - 1) / 2) * s * 0.55;
    const cy = y - s * 0.45 + row * s * 0.32;
    const w = cols > 1 ? s * 0.25 : s * 0.5;
    g.fillPoints([V(cx - w, cy), V(cx, cy + s * 0.16), V(cx + w, cy), V(cx + w, cy + s * 0.12), V(cx, cy + s * 0.28), V(cx - w, cy + s * 0.12)], true);
  }
}
