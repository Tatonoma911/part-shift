import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import comm from '../src/data/text/comm.json';

type Line = { ru: string; en: string };
const heroes = (comm as unknown as { heroes: Record<string, { portrait: string; lines: Line[]; build: Line[]; defeat: Line }> }).heroes;

describe('hero comm lines', () => {
  it('covers all 15 heroes with RU and EN lines and a portrait', () => {
    expect(Object.keys(heroes)).toHaveLength(15);
    for (const [id, h] of Object.entries(heroes)) {
      expect(h.lines.length, id).toBeGreaterThanOrEqual(6);
      expect(h.build.length, id).toBeGreaterThanOrEqual(2);
      for (const l of [...h.lines, ...h.build, h.defeat]) {
        expect(l.ru, id).toBeTruthy();
        expect(l.en, id).toBeTruthy();
      }
      expect(existsSync(`src/assets/comm/${h.portrait}.webp`), id).toBe(true);
    }
  });
});
