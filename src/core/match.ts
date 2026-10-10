/**
 * Online matches for 2–4 players (design/MVP_RULES.md §14, data/multiplayer.json).
 * The server creates the World here: board size by player count, centers placed
 * by the server symmetrically, and the same surroundings mirrored around each
 * center so nobody starts luckier than the others.
 */
import multiplayerJson from '../data/design/multiplayer.json';
import { cellAt, cheb, inBounds } from './grid';
import { generateField } from './mapgen';
import type { AssistMode, MatchMode } from './state';
import { World } from './world';

export const multiplayer = multiplayerJson;

export interface MatchOptions {
  seed: number;
  mode: MatchMode;
  names: string[];
  /** Each player's own helper setting (design/ONBOARDING.md §1.3). */
  assist?: AssistMode[];
}

type Spot = { x: number; y: number; fx: 1 | -1; fy: 1 | -1 };

export function boardFor(players: number): { width: number; height: number } {
  const b = multiplayer.board as unknown as Record<string, { width: number; height: number }>;
  return b[String(Math.max(2, Math.min(4, players)))];
}

/** Center spots: point-symmetric for two, the four corners (mirrored) for three or four. */
export function commandSpots(players: number, width: number, height: number): Spot[] {
  const inset = players <= 2 ? 4 : 5;
  const left = inset;
  const right = width - 1 - inset;
  const top = inset + (players <= 2 ? 1 : 0);
  const bottom = height - 1 - top;
  if (players <= 2) {
    const two: Spot[] = [
      { x: left, y: top, fx: 1, fy: 1 },
      { x: right, y: bottom, fx: -1, fy: -1 },
    ];
    // One player only in local testing (server SOLO=1).
    return two.slice(0, Math.max(1, players));
  }
  return [
    { x: left, y: top, fx: 1, fy: 1 },
    { x: right, y: bottom, fx: -1, fy: -1 },
    { x: right, y: top, fx: -1, fy: 1 },
    { x: left, y: bottom, fx: 1, fy: -1 },
  ].slice(0, players) as Spot[];
}

export function createMatch(opts: MatchOptions): World {
  const players = opts.names.length;
  const { width, height } = boardFor(players);
  const ruleConfig: Record<string, number | boolean> = { 'dig.autoQueueZeroNeighbors': false };
  // Coop: 2× faster threat escalation — players must communicate or fall behind.
  if (opts.mode === 'coop') ruleConfig['threat.secondsPerLevel'] = multiplayer.coop.threatSecondsPerLevel;
  // FFA has no shared Demon bonus HP: it hunts whoever is closest.
  const w = new World({ seed: opts.seed, players, width, height, rules: { config: ruleConfig } });
  const s = w.s;
  s.match = { mode: opts.mode, names: [...opts.names], winner: null };
  if (opts.mode === 'ffa') s.boss.hpScale = 1;
  opts.assist?.forEach((mode, i) => {
    if (s.players[i]) s.players[i].assist.mode = mode;
  });

  const spots = commandSpots(players, width, height);
  generateField(s, { commands: spots, nests: multiplayer.scaling.nestsPerPlayer * players, countScale: players });
  mirrorStarts(w, spots, multiplayer.fairStart.mirroredRadius);
  w.placeCommands(spots.map((p, player) => ({ player, x: p.x, y: p.y })));
  return w;
}

/** Copies the field around the first center onto the others (multiplayer.json fairStart). */
function mirrorStarts(w: World, spots: Spot[], r: number): void {
  const s = w.s;
  const [a] = spots;
  for (const b of spots.slice(1)) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const sx = a.x + dx;
        const sy = a.y + dy;
        // Spot b's offsets mirror spot a's: same sign pattern relative to the board edges.
        const tx = b.x + dx * a.fx * b.fx;
        const ty = b.y + dy * a.fy * b.fy;
        if (!inBounds(s, sx, sy) || !inBounds(s, tx, ty)) continue;
        const src = cellAt(s, sx, sy);
        const dst = cellAt(s, tx, ty);
        if (src.content === 'boss_hatch' || dst.content === 'boss_hatch') continue;
        dst.content = src.content;
        dst.tech = src.tech;
        dst.stock = src.stock;
      }
    }
  }
  // Mirrored water must not wall anyone in; if it does, the start areas go dry for everyone.
  if (!spots.every((p) => dryReachable(w, p))) {
    for (const p of spots) {
      for (let y = p.y - r; y <= p.y + r; y++) {
        for (let x = p.x - r; x <= p.x + r; x++) {
          if (inBounds(s, x, y) && cheb(x, y, p.x, p.y) <= r && cellAt(s, x, y).content === 'water') cellAt(s, x, y).content = 'ground';
        }
      }
    }
  }
}

function dryReachable(w: World, from: { x: number; y: number }): boolean {
  const s = w.s;
  const seen = new Uint8Array(s.width * s.height);
  const stack = [from];
  seen[from.y * s.width + from.x] = 1;
  let count = 1;
  while (stack.length) {
    const p = stack.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = p.x + dx;
      const ny = p.y + dy;
      if (!inBounds(s, nx, ny) || seen[ny * s.width + nx] || cellAt(s, nx, ny).content === 'water') continue;
      seen[ny * s.width + nx] = 1;
      count++;
      stack.push({ x: nx, y: ny });
    }
  }
  return count === s.cells.filter((c) => c.content !== 'water').length;
}
