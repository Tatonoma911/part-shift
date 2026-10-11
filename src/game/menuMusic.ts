/**
 * Title-screen themes (audio/tools/music4.py). The menu rotates through them:
 * a new theme every 1–2 minutes, crossfaded, never the same one twice in a row.
 */
export const MENU_TRACKS = ['menu', 'menu2', 'menu3', 'menu4'] as const;

/** How long one title theme plays before the next one fades in (ms). */
export const MENU_HOLD_MIN = 60_000;
export const MENU_HOLD_MAX = 120_000;

/** The next title theme: any one but `current`, picked by `rand` (0..1). */
export function nextMenuTrack(current: string | null, rand: number): string {
  const pool = MENU_TRACKS.filter((t) => t !== current);
  return pool[Math.min(pool.length - 1, Math.floor(rand * pool.length))];
}

/** A random hold inside the 1–2 minute window (ms). */
export function menuHold(rand: number): number {
  return MENU_HOLD_MIN + rand * (MENU_HOLD_MAX - MENU_HOLD_MIN);
}
