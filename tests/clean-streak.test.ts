import { describe, expect, it } from 'vitest';
import { config } from '../src/core/data';
import { handWorld } from './helpers';

type Inner = { countCleanQuarter(): void; resetCleanStreak(): void };
const inner = (w: ReturnType<typeof handWorld>) => w as unknown as Inner;

describe('clean streak (MVP_RULES §22.4)', () => {
  it('adds a step every stepCells quarters, capped at maxBonus', () => {
    const w = handWorld(['.......']);
    const cs = config.cleanStreak;
    for (let i = 0; i < cs.stepCells; i++) inner(w).countCleanQuarter();
    expect(w.cleanStreakState().bonus).toBeCloseTo(cs.bonusPerStep);
    for (let i = 0; i < cs.stepCells * 10; i++) inner(w).countCleanQuarter();
    expect(w.cleanStreakState().bonus).toBeCloseTo(cs.maxBonus);
  });

  it('a step lapses after bonusDurationSeconds', () => {
    const w = handWorld(['.......']);
    const cs = config.cleanStreak;
    for (let i = 0; i < cs.stepCells; i++) inner(w).countCleanQuarter();
    w.s.time += cs.bonusDurationSeconds + 1;
    expect(w.cleanStreakState().bonus).toBe(0);
  });

  it('a reset (mine, damage, raid) clears the streak', () => {
    const w = handWorld(['.......']);
    for (let i = 0; i < config.cleanStreak.stepCells; i++) inner(w).countCleanQuarter();
    inner(w).resetCleanStreak();
    expect(w.cleanStreakState()).toEqual({ count: 0, bonus: 0 });
  });
});
