/**
 * Small JSON diffs for the online match. The server keeps the last state it
 * sent and ships only what changed; the client applies the diff in place, so
 * BoardView and GameScene keep reading the same GameState object.
 *
 * Delta forms:
 *   { r: value }                       replace
 *   { o: { key: Delta }, d?: keys }    object: changed keys, deleted keys
 *   { a: { index: Delta } }            array of the same length
 *   { k: { id: Delta }, n?: [values], i?: ids }  array of objects with numeric `id`
 *                                     (units, buildings): changed, new, new id order
 */
export type Delta =
  | { r: unknown }
  | { o: Record<string, Delta>; d?: string[] }
  | { a: Record<string, Delta> }
  | { k: Record<string, Delta>; n?: unknown[]; i?: number[] };

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const hasIds = (a: unknown[]): a is { id: number }[] => a.every((e) => isObj(e) && typeof e.id === 'number');

/** Coordinates and timers do not need 17 digits on the wire. */
export function compact(v: unknown): unknown {
  if (typeof v === 'number') return Number.isInteger(v) || !Number.isFinite(v) ? v : Math.round(v * 1000) / 1000;
  if (Array.isArray(v)) return v.map(compact);
  if (isObj(v)) {
    const out: Obj = {};
    for (const [k, x] of Object.entries(v)) if (x !== undefined) out[k] = compact(x);
    return out;
  }
  return v;
}

const same = (a: unknown, b: unknown) => a === b || (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b));

export function diff(prev: unknown, next: unknown): Delta | undefined {
  if (same(prev, next)) return undefined;
  if (isObj(prev) && isObj(next)) {
    const o: Record<string, Delta> = {};
    const d: string[] = [];
    for (const k of Object.keys(next)) {
      if (next[k] === undefined) {
        if (prev[k] !== undefined) d.push(k);
        continue;
      }
      const dk = prev[k] === undefined ? { r: compact(next[k]) } : diff(prev[k], next[k]);
      if (dk) o[k] = dk;
    }
    for (const k of Object.keys(prev)) if (prev[k] !== undefined && !(k in next)) d.push(k);
    if (!Object.keys(o).length && !d.length) return undefined;
    return d.length ? { o, d } : { o };
  }
  if (Array.isArray(prev) && Array.isArray(next)) {
    if (next.length && prev.length && hasIds(prev) && hasIds(next)) {
      const old = new Map(prev.map((e) => [e.id, e]));
      const k: Record<string, Delta> = {};
      const n: unknown[] = [];
      for (const e of next) {
        const was = old.get(e.id);
        if (!was) n.push(compact(e));
        else {
          const de = diff(was, e);
          if (de) k[e.id] = de;
        }
      }
      const reordered = prev.length !== next.length || n.length > 0 || next.some((e, i) => prev[i].id !== e.id);
      if (!Object.keys(k).length && !reordered) return undefined;
      const out: { k: Record<string, Delta>; n?: unknown[]; i?: number[] } = { k };
      if (n.length) out.n = n;
      if (reordered) out.i = next.map((e) => e.id);
      return out;
    }
    if (prev.length === next.length) {
      const a: Record<string, Delta> = {};
      next.forEach((e, i) => {
        const de = diff(prev[i], e);
        if (de) a[i] = de;
      });
      return Object.keys(a).length ? { a } : undefined;
    }
  }
  return { r: compact(next) };
}

/** Applies a delta to `target` in place where it can; returns the (possibly new) value. */
export function patch<T>(target: T, delta: Delta): T {
  if ('r' in delta) return structuredClone(delta.r) as T;
  if ('o' in delta) {
    const t = target as Obj;
    for (const [k, dk] of Object.entries(delta.o)) t[k] = t[k] === undefined && 'r' in dk ? structuredClone(dk.r) : patch(t[k], dk);
    for (const k of delta.d ?? []) delete t[k];
    return target;
  }
  if ('a' in delta) {
    const t = target as unknown[];
    for (const [i, di] of Object.entries(delta.a)) t[Number(i)] = patch(t[Number(i)], di);
    return target;
  }
  const t = target as { id: number }[];
  const byId = new Map(t.map((e) => [e.id, e]));
  for (const [id, de] of Object.entries(delta.k)) {
    const e = byId.get(Number(id));
    if (e) byId.set(Number(id), patch(e, de));
  }
  for (const e of (delta.n ?? []) as { id: number }[]) byId.set(e.id, structuredClone(e));
  if (delta.i) {
    const order = delta.i.map((id) => byId.get(id)).filter((e): e is { id: number } => !!e);
    t.length = 0;
    t.push(...order);
  }
  return target;
}
