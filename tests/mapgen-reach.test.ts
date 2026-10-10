import { describe, expect, it } from 'vitest';
import { World } from '../src/core/world';
import type { GameState } from '../src/core/state';
import { getCampaignWorld } from '../src/game/campaign';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

function place(w: World): GameState {
  const { width, height } = w.s;
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  expect(w.apply({ type: 'placeCommand', x: cx, y: cy }).ok).toBe(true);
  return w.s;
}

function unreachable(s: GameState): number {
  const cmd = s.buildings.find((b) => b.type === 'command')!;
  const seen = new Uint8Array(s.width * s.height);
  const stack = [[cmd.x, cmd.y]];
  seen[cmd.y * s.width + cmd.x] = 1;
  while (stack.length) {
    const [x, y] = stack.pop()!;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= s.width || ny >= s.height) continue;
      const i = ny * s.width + nx;
      if (seen[i] || s.cells[i].content === 'water') continue;
      seen[i] = 1;
      stack.push([nx, ny]);
    }
  }
  let bad = 0;
  for (let i = 0; i < s.cells.length; i++) if (s.cells[i].content !== 'water' && !seen[i]) bad++;
  return bad;
}

describe('every non-water cell is reachable from the command center', () => {
  it('holds on random boards of every difficulty', () => {
    const failures: string[] = [];
    for (const difficulty of ['intern', 'shift', 'rush']) {
      for (let seed = 1; seed <= 60; seed++) {
        const w = new World({ seed, difficulty });
        const bad = unreachable(place(w));
        if (bad) failures.push(`${difficulty} seed ${seed}: ${bad}`);
      }
    }
    expect(failures).toEqual([]);
  }, 60000);

  it('holds on campaign shifts', () => {
    const failures: string[] = [];
    for (let n = 1; n <= 12; n++) {
      const o = getCampaignWorld(n);
      for (let seed = 1; seed <= 12; seed++) {
        const w = new World({ seed, difficulty: o.difficulty, width: o.width, height: o.height, rules: { counts: { nests: o.nestCount } } });
        const bad = unreachable(place(w));
        if (bad) failures.push(`shift ${n} seed ${seed}: ${bad}`);
      }
    }
    expect(failures).toEqual([]);
  }, 60000);
});
