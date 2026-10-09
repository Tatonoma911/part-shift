import { animSets, drawFrame, frameAt, urlOf } from './art';
import { render, Stage, Timeline } from './clip';
import type { Visual } from './content';

/** Small DOM helper: h('div.class', {attrs}, children). */
export function h<T extends HTMLElement = HTMLElement>(tag: string, attrs: Record<string, unknown> = {}, ...kids: (Node | string | null | undefined | false)[]): T {
  const [name, ...cls] = tag.split('.');
  const el = document.createElement(name) as T;
  if (cls.length) el.className = cls.join(' ');
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'html') el.innerHTML = String(v);
    else el.setAttribute(k, String(v));
  }
  for (const kid of kids) if (kid !== null && kid !== undefined && kid !== false) el.append(kid);
  return el;
}

export const ICON = {
  close: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M5 5l10 10M15 5L5 15"/></svg>',
  back: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12.5 4L6.5 10l6 6"/></svg>',
  next: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 4l6 6-6 6"/></svg>',
  play: '<svg viewBox="0 0 12 12" fill="currentColor"><path d="M3 1.5v9l7.5-4.5z"/></svg>',
};

/** A looping sprite animation on its own small canvas; stops when removed from the page. */
export function spriteView(set: string, anim: string, scale = 3): HTMLCanvasElement {
  const a = animSets[set];
  const c = document.createElement('canvas');
  if (!a) return c;
  const [fw, fh] = a.frameSize;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = fw * scale * dpr;
  c.height = fh * scale * dpr;
  c.style.width = `${fw * scale}px`;
  c.style.height = `${fh * scale}px`;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const def = a.anims[anim];
  const length = def ? def.frames.length / def.fps : 1;
  const t0 = performance.now();
  const draw = (ms: number) => {
    if (!c.isConnected && ms - t0 > 500) return;
    requestAnimationFrame(draw);
    // one-shot animations replay after a short hold
    const t = ((ms - t0) / 1000) % (def?.loop ? 1e9 : length + 0.8);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    ctx.clearRect(0, 0, fw, fh);
    ctx.imageSmoothingEnabled = false;
    drawFrame(ctx, set, frameAt(set, anim, t), a.anchor[0], a.anchor[1]);
  };
  requestAnimationFrame(draw);
  return c;
}

/** One board cell (or three for "several numbers") drawn by the clip renderer, as a still image. */
export function glyphView(channel: Extract<Visual, { kind: 'glyph' }>['channel'], scale = 2.4): HTMLCanvasElement {
  const s = new Stage(1, 1, new Timeline(), {});
  const c = s.cell(0, 0);
  switch (channel) {
    case 'threat':
      Object.assign(c, { open: true, tile: 'ground_0', clue: { threat: 1 } });
      break;
    case 'finds':
      Object.assign(c, { open: true, tile: 'ground_grass_1', clue: { finds: 2 } });
      break;
    case 'demon':
      Object.assign(c, { open: true, tile: 'ground_1', clue: { demon: 1 } });
      break;
    case 'many':
      Object.assign(c, { open: true, tile: 'ground_0', clue: { finds: 1, threat: 2, demon: 1 } });
      break;
    case 'empty':
      Object.assign(c, { open: true, tile: 'ground_grass_0' });
      break;
    case 'safe':
      Object.assign(c, { mark: 'safe', markT: -9 });
      break;
    case 'danger':
      Object.assign(c, { mark: 'threat', markT: -9 });
      break;
    case 'caution':
      Object.assign(c, { mark: 'caution', markT: -9 });
      break;
  }
  const canvas = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = s.width * scale * dpr;
  canvas.height = s.height * scale * dpr;
  canvas.style.width = `${s.width * scale}px`;
  canvas.style.height = `${s.height * scale}px`;
  const ctx = canvas.getContext('2d')!;
  const paint = () => {
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    render(ctx, s, 0.6);
  };
  paint();
  // fonts may land after the first paint
  document.fonts?.ready.then(paint).catch(() => undefined);
  return canvas;
}

/** The picture for a guide entry: animated sprite, pixel image or a drawn cell. */
export function visualView(v: Visual | undefined, size: 'thumb' | 'big'): HTMLElement | null {
  if (!v) return null;
  if (v.kind === 'anim') {
    const a = animSets[v.set];
    if (!a) return null;
    const max = size === 'thumb' ? 52 : 168;
    const scale = Math.max(1, Math.min(v.scale ?? 3, max / Math.max(a.frameSize[0], a.frameSize[1])));
    return spriteView(v.set, v.set === 'fx' && v.anim === 'energy_orb' ? v.anim : v.anim, size === 'thumb' ? max / Math.max(a.frameSize[0], a.frameSize[1]) : scale);
  }
  if (v.kind === 'image') {
    const url = urlOf(v.key);
    if (!url) return null;
    const img = h<HTMLImageElement>('img', { src: url, alt: '', draggable: 'false' });
    const s = v.scale ?? 2;
    img.style.width = size === 'thumb' ? '48px' : 'auto';
    if (size === 'big') img.addEventListener('load', () => (img.style.width = `${Math.min(img.naturalWidth * s, 300)}px`), { once: true });
    if (size === 'big' && img.complete) img.style.width = `${Math.min(img.naturalWidth * s, 300)}px`;
    return img;
  }
  return glyphView(v.channel, size === 'thumb' ? 0.9 : 2.6);
}
