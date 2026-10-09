/** Logical portrait canvas; Phaser scales it to fit the phone screen without scrolling. */
export const VIEW = { width: 720, height: 1280 };

export const HUD_HEIGHT = 120;
export const FOOTER_HEIGHT = 150;
export const SIDE_MARGIN = 16;

/** Placeholder palette until the artist's tiles arrive. */
export const COLORS = {
  covered: 0x2a3550,
  coveredEdge: 0x3b4a6e,
  frontier: 0x33426a,
  opened: 0x1a2133,
  openedEdge: 0x232c42,
  queued: 0x7ee0a1,
  marked: 0xff9f43,
  core: 0x2f80ed,
  threat: 0x5a1f2b,
  worker: 0xf2f2f2,
  text: '#e8ecf5',
  textDim: '#8a93a8',
};

/** One color per clue channel (Keepsweeper: lairs are sky blue). */
export const CHANNEL_STYLE = {
  nest: { color: '#4fc3f7', label: 'channel.nest' },
  demon: { color: '#ff5252', label: 'channel.demon' },
  cache: { color: '#ffd54f', label: 'channel.cache' },
  depot: { color: '#b388ff', label: 'channel.depot' },
} as const;

export const SITE_GLYPH = { nest: '☣', depot: '▣', demon: '☠', cache: '◆' } as const;
