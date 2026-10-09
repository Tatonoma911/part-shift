import Phaser from 'phaser';
import animJson from '../assets/art/anim/anim.json';

/**
 * The artist's and animator's exports (art/export/x2, art/anim/x2, cell 52),
 * copied in by `npm run sync-data`. Texture keys:
 *   tile.<name>, building.<type>, icon.<name>, portrait.<name>,
 *   screen.<name> (comic illustrations for the win/lose sheets), and a
 *   spritesheet per animation set (resident, demon, bld_home, fx, …)
 *   with Phaser animations "<set>.<anim>".
 */
const urls = import.meta.glob('../assets/art/**/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

interface AnimSet {
  sheet: string;
  frameSize: [number, number];
  cols: number;
  anchor: [number, number];
  faces?: 'front' | 'left' | 'right';
  anims: Record<string, { frames: number[]; fps: number; loop: boolean; pxPerCycle?: number }>;
}

export const animSets = (animJson as unknown as { sets: Record<string, AnimSet> }).sets;

function keyOf(path: string): string | null {
  const m = path.match(/art\/(tiles|buildings|icons|portraits|screens|anim)\/(.+)\.png$/);
  if (!m) return null;
  const [, dir, name] = m;
  if (dir === 'anim') return name;
  const singular = { tiles: 'tile', buildings: 'building', icons: 'icon', portraits: 'portrait', screens: 'screen' }[dir];
  return `${singular}.${name.replace('@2x', '')}`;
}

export function preloadArt(scene: Phaser.Scene): void {
  for (const [path, url] of Object.entries(urls)) {
    const key = keyOf(path);
    if (!key) continue;
    const set = animSets[key];
    if (set) scene.load.spritesheet(key, url, { frameWidth: set.frameSize[0], frameHeight: set.frameSize[1] });
    else scene.load.image(key, url);
  }
}

/** Pixel art stays crisp; text and vector UI keep smooth filtering. */
export function createArt(scene: Phaser.Scene): void {
  for (const path of Object.keys(urls)) {
    const key = keyOf(path);
    // Comic screens are painted, not pixel art: they keep smooth filtering.
    if (key && !key.startsWith('screen.') && scene.textures.exists(key)) scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  for (const [id, set] of Object.entries(animSets)) {
    for (const [name, a] of Object.entries(set.anims)) {
      scene.anims.create({
        key: `${id}.${name}`,
        frames: scene.anims.generateFrameNumbers(id, { frames: a.frames }),
        frameRate: a.fps,
        repeat: a.loop ? -1 : 0,
      });
    }
  }
}

/** Origin that puts the set's anchor point on the sprite's position. */
export function originOf(set: string): [number, number] {
  const a = animSets[set];
  return [a.anchor[0] / a.frameSize[0], a.anchor[1] / a.frameSize[1]];
}

/** Anchor of the static building sprites (art/export/x2/sprites.json). */
export const BUILDING_ANCHOR: Record<string, [number, number, number, number]> = {
  command: [44, 90, 88, 112],
  home: [36, 78, 72, 96],
  reactor: [36, 78, 72, 96],
  cooler: [36, 78, 72, 96],
  school: [36, 78, 72, 96],
  medcenter: [36, 78, 72, 96],
};
