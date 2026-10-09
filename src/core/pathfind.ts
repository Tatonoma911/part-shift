const STEPS: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export interface Point {
  x: number;
  y: number;
}

/**
 * Breadth-first search over a grid (4-directional moves).
 * Returns the path from start to the first cell accepted by `isGoal`, both ends
 * included, or null when no goal is reachable.
 */
export function findPath(
  width: number,
  height: number,
  start: Point,
  isWalkable: (x: number, y: number) => boolean,
  isGoal: (x: number, y: number) => boolean,
  /** No way to the goal: return the way to the reachable cell nearest this point instead. */
  fallback?: Point,
): Point[] | null {
  const prev = new Int32Array(width * height).fill(-1);
  const startIdx = start.y * width + start.x;
  prev[startIdx] = startIdx;
  const queue: number[] = [startIdx];
  const trace = (idx: number): Point[] => {
    const path: Point[] = [];
    for (let i = idx; ; i = prev[i]) {
      path.push({ x: i % width, y: Math.floor(i / width) });
      if (i === startIdx) break;
    }
    return path.reverse();
  };
  let best = startIdx;
  let bestD = Infinity;
  for (let head = 0; head < queue.length; head++) {
    const idx = queue[head];
    const x = idx % width;
    const y = (idx - x) / width;
    if (isGoal(x, y)) return trace(idx);
    if (fallback) {
      const d = Math.hypot(x - fallback.x, y - fallback.y);
      if (d < bestD) {
        bestD = d;
        best = idx;
      }
    }
    for (const [dx, dy] of STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nIdx = ny * width + nx;
      if (prev[nIdx] !== -1 || !isWalkable(nx, ny)) continue;
      prev[nIdx] = idx;
      queue.push(nIdx);
    }
  }
  return fallback ? trace(best) : null;
}
