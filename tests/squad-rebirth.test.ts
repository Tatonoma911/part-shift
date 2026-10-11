import { expect, it } from 'vitest';
import { handWorld } from './helpers';
import type { World } from '../src/core/world';

type Inner = {
  kill(v: unknown, by?: unknown): void;
  spawnAllyFromPool(p: unknown, x: number, y: number, tiers?: number[]): unknown;
};
const inner = (w: World) => w as unknown as Inner;

it('a knocked-out squad hero is reborn at the next birth, not replaced by another hero', () => {
  const w = handWorld(['.......', '.......', '......n']);
  w.apply({ type: 'placeCommand', x: 0, y: 1 });
  const hero = w.s.units.find((u) => u.kind === 'ally')!;
  const id = hero.hero!;
  inner(w).kill(hero);
  expect(w.s.players[0].allyBack?.[id]).toBeDefined();
  inner(w).spawnAllyFromPool(w.s.players[0], 2, 2);
  const back = w.s.units.find((u) => u.kind === 'ally' && u.hero === id && u.hp > 0);
  expect(back).toBeDefined();
  expect(back!.x).toBe(2);
  expect(w.s.players[0].allyBack?.[id]).toBeUndefined();
});
