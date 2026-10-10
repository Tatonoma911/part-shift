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
const urls = import.meta.glob('../assets/art/**/*.{png,jpg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

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
  const m = path.match(/art\/(tiles|buildings|icons|portraits|screens|anim|buildings_gpt|nests_gpt|villains_mixed)\/(.+)\.(?:png|jpg)$/);
  if (!m) return null;
  const [, dir, name] = m;
  if (dir === 'anim') return name;
  const singular: Record<string, string> = {
    tiles: 'tile', buildings: 'building', icons: 'icon', portraits: 'portrait', screens: 'screen',
    buildings_gpt: 'bldg', nests_gpt: 'nest_gpt', villains_mixed: 'villain',
  };
  return `${singular[dir]}.${name.replace('@2x', '')}`;
}

/** Queues the art; `only` picks a subset (the loading screen takes its few pictures first). Loaded keys are skipped. */
export function preloadArt(scene: Phaser.Scene, only?: (key: string) => boolean): void {
  for (const [path, url] of Object.entries(urls)) {
    const key = keyOf(path);
    if (!key || (only && !only(key)) || scene.textures.exists(key)) continue;
    const set = animSets[key];
    if (set) scene.load.spritesheet(key, url, { frameWidth: set.frameSize[0], frameHeight: set.frameSize[1] });
    else scene.load.image(key, url);
  }
}

/** Pixel art stays crisp; text and vector UI keep smooth filtering. */
export function createArt(scene: Phaser.Scene): void {
  for (const path of Object.keys(urls)) {
    const key = keyOf(path);
    // Comic screens and comic UI icons (bonuses, menu row, Control mask) are painted, not pixel art: they keep smooth filtering.
    const painted = !key || key.startsWith('screen.') || /^icon\.(boon|menu|control)_/.test(key);
    if (key && !painted && scene.textures.exists(key)) scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
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

/** Anchor of the static building sprites — [anchorX, anchorY, width, height] in px (buildings_gpt.json @x2). */
export const BUILDING_ANCHOR: Record<string, [number, number, number, number]> = {
  command: [26, 75, 52, 88],
  home: [26, 67, 52, 80],
  reactor: [26, 67, 52, 80],
  cooler: [26, 67, 52, 80],
  school: [26, 67, 52, 80],
  medcenter: [26, 67, 52, 80],
  apartments: [26, 67, 52, 80],
  backup_archive: [26, 67, 52, 80],
  checkpoint: [26, 67, 52, 80],
  comms_tower: [26, 67, 52, 80],
  element_forge: [52, 66, 104, 92],
  greenhouse: [26, 67, 52, 80],
  hero_station: [26, 67, 52, 80],
  limb_rotation_center: [52, 94, 104, 120],
  monorail: [26, 67, 52, 80],
  monitoring_tower: [26, 67, 52, 80],
  radar_tower: [26, 67, 52, 80],
  repair_crew: [26, 67, 52, 80],
  residents_shelter: [26, 67, 52, 80],
  shield_spire: [26, 67, 52, 80],
  skyscraper: [26, 67, 52, 80],
  splice_jammer: [26, 67, 52, 80],
  workshop: [26, 67, 52, 80],
};
