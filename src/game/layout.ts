/** Logical portrait canvas; Phaser scales it to fit the phone screen without scrolling. */
export const VIEW = { width: 720, height: 1280 };

export const HUD_HEIGHT = 112;
export const BAR_HEIGHT = 180;
export const SIDE_MARGIN = 12;

/** Placeholder palette until the artist's tiles arrive. */
export const COLORS = {
  bg: 0x0f1420,
  covered: 0x2a3550,
  coveredEdge: 0x3b4a6e,
  frontier: 0x34446c,
  queued: 0x7ee0a1,
  autoQueued: 0x4d8a66,
  marked: 0xff9f43,
  opened: 0x1a2133,
  openedEdge: 0x232c42,
  water: 0x1d4e89,
  rubble: 0x6b5d4f,
  vein: 0x2bd9c8,
  hot: 0xff6b2b,
  territory: 0x23304a,
  resident: 0xf2f2f2,
  defender: 0x4f9dff,
  enemy: 0xff5a5a,
  demon: 0xb000ff,
  orb: 0xffd54f,
  hpBack: 0x000000,
  hpGood: 0x6fe08b,
  hpBad: 0xff5a5a,
  text: '#e8ecf5',
  textDim: '#8a93a8',
  energy: '#ffd54f',
};

/** Clue colors from the writer's help text: red nests, purple Demon, light-blue finds. */
export const CHANNEL_COLOR = { threat: '#ff5a5a', demon: '#c77dff', finds: '#5fd3ff' } as const;

export const TECH_COLOR: Record<string, number> = {
  thermo: 0xff7a3d,
  cryo: 0x7fd8ff,
  volt: 0xffe14d,
  impact: 0xc9a27a,
  toxin: 0x8cff5a,
};

export const BUILDING_STYLE: Record<string, { color: number; label: string }> = {
  command: { color: 0x2f80ed, label: 'КЦ' },
  home: { color: 0x5aa469, label: 'Д' },
  reactor: { color: 0x2b6cff, label: 'Р' },
  cooler: { color: 0x5ec8d8, label: 'О' },
  school: { color: 0xe0a33a, label: 'Ш' },
  medcenter: { color: 0xe06464, label: '+' },
};
