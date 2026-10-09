import { describe, expect, it } from 'vitest';
import { cleanName, dailySeed, dayId, rankOf, runScore, weekId } from '../src/social/score';
import { readChallenge } from '../src/social/share';

describe('social', () => {
  it('scores a run with the designer formula', () => {
    expect(runScore({ victory: false, seconds: 400, nests: 2, energy: 120 })).toBe(120 + 100);
    // Win under 10 minutes: demon 500 + win 300 + time 200.
    expect(runScore({ victory: true, seconds: 500, nests: 0, energy: 0 })).toBe(1000);
    expect(runScore({ victory: true, seconds: 700, nests: 0, energy: 0 })).toBe(900);
    expect(runScore({ victory: true, seconds: 2000, nests: 0, energy: 0 })).toBe(800);
  });

  it('gives career titles by lifetime score', () => {
    expect(rankOf(0)).toBe(0);
    expect(rankOf(1500)).toBe(1);
    expect(rankOf(10 ** 7)).toBe(6);
  });

  it('builds day and ISO week ids in UTC', () => {
    const d = new Date(Date.UTC(2026, 9, 9, 23, 30));
    expect(dayId(d)).toBe('2026-10-09');
    expect(weekId(d)).toBe('2026-W41');
    expect(weekId(new Date(Date.UTC(2027, 0, 1)))).toBe('2026-W53');
  });

  it('gives everyone the same daily seed', () => {
    expect(dailySeed('2026-10-09')).toBe(dailySeed('2026-10-09'));
    expect(dailySeed('2026-10-09')).not.toBe(dailySeed('2026-10-10'));
    expect(dailySeed('2026-10-09')).toBeGreaterThan(0);
  });

  it('cleans nicknames', () => {
    expect(cleanName('  Антон <b>  ')).toBe('Антон b');
    expect(cleanName('a')).toBeNull();
    expect(cleanName('xXfuckXx')).toBeNull();
    expect(cleanName('Очень-длинное-имя-игрока-123')).toHaveLength(18);
  });

  it('reads a challenge link', () => {
    expect(readChallenge(new URLSearchParams('seed=42&vs=1234&by=Kiln<x>'))).toEqual({ seed: 42, score: 1234, name: 'Kilnx' });
    expect(readChallenge(new URLSearchParams('seed=42'))).toBeNull();
  });
});
