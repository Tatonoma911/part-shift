import { describe, expect, it } from 'vitest';
import { handWorld } from './helpers';

type Inner = { cascadeWave(x: number, y: number, owner: number, depth: number): void };

describe('sound events from the core', () => {
  it('a cascade that opens cells emits one wave_clear', () => {
    const w = handWorld(['.......', '.......', '.......']);
    (w as unknown as Inner).cascadeWave(3, 1, 0, 9999);
    const waves = w.drainEvents().filter((e) => e.type === 'wave_clear');
    expect(waves).toHaveLength(1);
    expect(waves[0].amount).toBeGreaterThan(0);
  });

  it('a cascade with nothing to open emits no wave_clear', () => {
    const w = handWorld(['.......', '.......', '.......']);
    (w as unknown as Inner).cascadeWave(3, 1, 0, 0);
    expect(w.drainEvents().filter((e) => e.type === 'wave_clear')).toHaveLength(0);
  });
});
