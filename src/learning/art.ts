import animJson from '../assets/art/anim/anim.json';

/**
 * The same art the board uses (src/assets/art, copied by `npm run sync-data`),
 * loaded as plain images so the learning screens can draw it without Phaser.
 * Keys follow game/assets.ts: tile.<name>, building.<type>, icon.<name>,
 * portrait.<name>, and the animation set name (resident, demon, fx, …).
 */
const urls = import.meta.glob('../assets/art/**/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export interface AnimSet {
  sheet: string;
  frameSize: [number, number];
  cols: number;
  anchor: [number, number];
  faces?: 'front' | 'left' | 'right';
  anims: Record<string, { frames: number[]; fps: number; loop: boolean }>;
}

export const animSets = (animJson as unknown as { sets: Record<string, AnimSet> }).sets;

/** Anchor points of the static building sprites, as in game/assets.ts. */
export const BUILDING_ANCHOR: Record<string, [number, number]> = {
  command: [52, 150],
  home: [36, 94],
  reactor: [36, 94],
  cooler: [36, 94],
  school: [36, 94],
  medcenter: [36, 94],
};

function keyOf(path: string): string | null {
  const m = path.match(/art\/(tiles|buildings|icons|portraits|anim)\/(.+)\.png$/);
  if (!m) return null;
  const [, dir, name] = m;
  if (dir === 'anim') return name;
  const singular = { tiles: 'tile', buildings: 'building', icons: 'icon', portraits: 'portrait' }[dir];
  return `${singular}.${name.replace('@2x', '')}`;
}

export const art = new Map<string, HTMLImageElement>();
let loading: Promise<void> | null = null;

/** Starts loading every image once; resolves when all are decoded (missing ones are skipped). */
export function loadArt(): Promise<void> {
  if (loading) return loading;
  const jobs: Promise<void>[] = [];
  for (const [path, url] of Object.entries(urls)) {
    const key = keyOf(path);
    if (!key) continue;
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    art.set(key, img);
    jobs.push(img.decode().catch(() => undefined));
  }
  loading = Promise.all(jobs).then(() => undefined);
  return loading;
}

export function urlOf(key: string): string | undefined {
  return art.get(key)?.src;
}

/** Draws frame `frame` of an animation set with its anchor at (x, y). */
export function drawFrame(ctx: CanvasRenderingContext2D, set: string, frame: number, x: number, y: number, opts: { flip?: boolean; scale?: number; alpha?: number } = {}): void {
  const a = animSets[set];
  const img = art.get(set);
  if (!a || !img || !img.complete) return;
  const [fw, fh] = a.frameSize;
  const sx = (frame % a.cols) * fw;
  const sy = Math.floor(frame / a.cols) * fh;
  const s = opts.scale ?? 1;
  ctx.save();
  ctx.globalAlpha *= opts.alpha ?? 1;
  ctx.translate(Math.round(x), Math.round(y));
  if (opts.flip) ctx.scale(-1, 1);
  ctx.drawImage(img, sx, sy, fw, fh, -a.anchor[0] * s, -a.anchor[1] * s, fw * s, fh * s);
  ctx.restore();
}

/** Frame of `anim` at `t` seconds since it started (loops or holds on the last frame). */
export function frameAt(set: string, anim: string, t: number): number {
  const a = animSets[set]?.anims[anim];
  if (!a) return 0;
  const i = Math.floor(Math.max(0, t) * a.fps);
  return a.frames[a.loop ? i % a.frames.length : Math.min(i, a.frames.length - 1)];
}

export function animLength(set: string, anim: string): number {
  const a = animSets[set]?.anims[anim];
  return a ? a.frames.length / a.fps : 0;
}

export function drawImage(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, w?: number, h?: number): void {
  const img = art.get(key);
  if (!img || !img.complete || !img.naturalWidth) return;
  ctx.drawImage(img, Math.round(x), Math.round(y), w ?? img.naturalWidth, h ?? img.naturalHeight);
}
