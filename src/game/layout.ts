/**
 * Screen layout and brand tokens (ui/BRAND_UI.md, ui/UI_SPEC.md).
 * The UI spec is drawn for a 390 px wide phone; the canvas is twice that,
 * so the cell-52 art set (art/export/x2) lands on whole pixels.
 */
export const VIEW = { width: 780, height: 1600 };

/**
 * Wide screens (desktop browser) get a landscape layout: the board on the left
 * at full height, HUD and dock in a column on the right. Chosen once at boot.
 */
export let LANDSCAPE = false;

/** Board cell 52 + 2 px gap (UI_SPEC §2.3 at 2×). */
export const CELL = 52;
export const STEP = 54;

export const HUD = { x: 16, y: 18, w: 748, h: 116 };
export const GOAL = { y: 150 };
/** Board area: 14 × 18 cells at most. Smaller boards are centered in it. */
export const BOARD = { x: 12, y: 196, w: 756, h: 972 };
export const DOCK = { x: 16, y: 1268, w: 748, h: 300 };
/** Where the tutorial card goes; in portrait it takes the top of the board area. */
export const GUIDE = { x: 16, y: 192, w: 748, h: 0 };

export function chooseLayout(screenW: number, screenH: number): void {
  LANDSCAPE = screenW > screenH * 1.15;
  if (!LANDSCAPE) return;
  Object.assign(VIEW, { width: 1600, height: 900 });
  Object.assign(BOARD, { x: 20, y: 20, w: 860, h: 860 });
  Object.assign(HUD, { x: 908, y: 18, w: 676, h: 116 });
  GOAL.y = 150;
  Object.assign(DOCK, { x: 908, y: 584, w: 676, h: 300 });
  Object.assign(GUIDE, { x: 908, y: 210, w: 676, h: 270 });
}

export const FONT_NUM = 'Unbounded, "Golos Text", system-ui, sans-serif';
export const FONT = '"Golos Text", system-ui, -apple-system, "Segoe UI", sans-serif';

/** Palette from BRAND_UI.md. Numbers for Graphics, strings for Text. */
export const C = {
  night: 0x0b1117,
  graphite: 0x10171c,
  paper: 0xf4f7f7,
  paper2: 0xedf4f5,
  seam: 0x57d8f2,
  glow: 0x9ff4ff,
  deep: 0x115a80,
  teal: 0x007e89,
  cobalt: 0x2e55c8,
  coral: 0xef5c73,
  coralInk: 0xe03552,
  amber: 0xe8a33a,
  violet: 0x8a4dff,
  green: 0x6fbf3a,
  sky: 0xdfeef3,
  sky2: 0xc9e2ea,
  white: 0xffffff,
};

export const INK = {
  graphite: '#10171C',
  dim: '#5B6B75',
  deep: '#115A80',
  teal: '#007E89',
  cobalt: '#2E55C8',
  coral: '#E03552',
  amber: '#B5761A',
  violet: '#8A4DFF',
  white: '#FFFFFF',
  paper: '#F4F7F7',
};

/** Clue channels: color and the shape that repeats it (UI_SPEC §3.2). */
export const CHANNEL = {
  finds: { color: INK.teal, num: C.teal },
  threat: { color: INK.coral, num: C.coralInk },
  demon: { color: INK.violet, num: C.violet },
} as const;

export const TECH_COLOR: Record<string, number> = {
  thermo: 0xff7a3d,
  cryo: 0x7fd8ff,
  volt: 0xffe14d,
  impact: 0xc9a27a,
  toxin: 0x8cff5a,
};
