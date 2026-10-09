import { C, CHANNEL, INK } from './layout';

/**
 * «Удобство» settings (ui/UI_SPEC.md §4.7): colour-blind palettes, calmer
 * effects, screen shake, text size and vibration. Stored apart from the main
 * settings so the menu and the board can read them without a scene.
 */
export type Palette = 'normal' | 'deutan' | 'protan' | 'tritan';
export const PALETTES: Palette[] = ['normal', 'deutan', 'protan', 'tritan'];
export const TEXT_SCALES = [1, 1.15, 1.3];

export interface Comfort {
  palette: Palette;
  /** Fewer flashes: beacons stand still, fire does not flicker, reveal flashes are dim. */
  calm: boolean;
  shake: boolean;
  textScale: number;
  vibrate: boolean;
}

const KEY = 'partshift.comfort.v1';
const DEFAULTS: Comfort = { palette: 'normal', calm: false, shake: true, textScale: 1, vibrate: true };

let current: Comfort | null = null;

export function comfort(): Comfort {
  if (current) return current;
  current = { ...DEFAULTS };
  try {
    Object.assign(current, JSON.parse(localStorage.getItem(KEY) ?? '{}'));
  } catch {
    /* defaults */
  }
  return current;
}

export function setComfort(patch: Partial<Comfort>): void {
  current = { ...comfort(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* private mode: keep for this session */
  }
  applyPalette();
}

/**
 * Safe / danger colours per palette. Red-green blindness (deutan, protan) is
 * our worst case: green ✓ against red ▲. Those get sky blue against orange
 * (Okabe–Ito pair); tritan keeps red and moves "safe" to bluish green.
 */
const SWATCH: Record<Palette, { safe: number; danger: number; dangerInk: number; dangerCss: string }> = {
  normal: { safe: 0x6fbf3a, danger: 0xef5c73, dangerInk: 0xe03552, dangerCss: '#E03552' },
  deutan: { safe: 0x56b4e9, danger: 0xf0a020, dangerInk: 0xd55e00, dangerCss: '#D55E00' },
  protan: { safe: 0x56b4e9, danger: 0xf0b030, dangerInk: 0xe08a00, dangerCss: '#C77600' },
  tritan: { safe: 0x009e73, danger: 0xef5c73, dangerInk: 0xe03552, dangerCss: '#E03552' },
};

export function swatch(): (typeof SWATCH)[Palette] {
  return SWATCH[comfort().palette] ?? SWATCH.normal;
}

/** Rewrites the shared brand tokens so every scene draws danger and safe in the chosen palette. */
export function applyPalette(): void {
  const s = swatch();
  const c = C as { -readonly [K in keyof typeof C]: number };
  c.coral = s.danger;
  c.coralInk = s.dangerInk;
  c.green = s.safe;
  (INK as Record<string, string>).coral = s.dangerCss;
  const ch = CHANNEL as unknown as Record<string, { color: string; num: number }>;
  ch.threat = { color: s.dangerCss, num: s.dangerInk };
}

/** Short buzz on events that matter (nest opened, center hit), if the device can and the player allows. */
export function buzz(pattern: number | number[]): void {
  if (!comfort().vibrate || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/** Calm mode or the system "reduce motion" switch. */
export function calmFx(): boolean {
  return comfort().calm || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
}
