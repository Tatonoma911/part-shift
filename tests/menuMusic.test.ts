import { describe, expect, it } from 'vitest';
import { MENU_HOLD_MAX, MENU_HOLD_MIN, MENU_TRACKS, menuHold, nextMenuTrack } from '../src/game/menuMusic';

describe('title music rotation', () => {
  it('has four themes and never repeats the one playing', () => {
    expect(MENU_TRACKS).toHaveLength(4);
    for (const cur of MENU_TRACKS)
      for (const r of [0, 0.25, 0.5, 0.75, 0.999]) expect(nextMenuTrack(cur, r)).not.toBe(cur);
  });

  it('starts from any theme when nothing plays yet', () => {
    expect(MENU_TRACKS).toContain(nextMenuTrack(null, 0.5));
    expect(nextMenuTrack(null, 1)).toBe(MENU_TRACKS[MENU_TRACKS.length - 1]);
  });

  it('holds each theme for 1–2 minutes', () => {
    expect(menuHold(0)).toBe(MENU_HOLD_MIN);
    expect(menuHold(1)).toBe(MENU_HOLD_MAX);
    expect(MENU_HOLD_MIN).toBe(60_000);
    expect(MENU_HOLD_MAX).toBe(120_000);
  });
});
