import { config } from '../core/data';
import type { AssistMode, GameState } from '../core/state';

/** Three save slots in localStorage; the pre-menu single save becomes slot 1. */
export const SLOTS = [1, 2, 3] as const;
const LEGACY_KEY = 'partshift.save.v1';
const SETTINGS_KEY = 'partshift.settings.v1';
const keyOf = (slot: number) => `partshift.slot${slot}.v1`;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function migrate(): void {
  const legacy = read(LEGACY_KEY);
  if (!legacy) return;
  try {
    if (!read(keyOf(1))) localStorage.setItem(keyOf(1), legacy);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}

export function loadSlot(slot: number): GameState | null {
  migrate();
  const raw = read(keyOf(slot));
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as GameState;
    if (s.version !== 1 || s.outcome !== 'playing') return null;
    // Saves from before the scanner existed.
    for (const p of s.players) p.assist ??= { mode: 'full', charges: config.assist.scanner.maxCharges, recharge: config.assist.scanner.rechargeSeconds, scanLeft: 0 };
    return s;
  } catch {
    return null;
  }
}

export function saveSlot(slot: number, s: GameState): void {
  try {
    localStorage.setItem(keyOf(slot), JSON.stringify(s));
  } catch {
    /* storage full or blocked: the run just isn't saved */
  }
}

export function clearSlot(slot: number): void {
  try {
    localStorage.removeItem(keyOf(slot));
  } catch {
    /* ignore */
  }
}

/** The most recently saved slot that holds a run in progress. */
export function lastSlot(): number | null {
  let best: { slot: number; at: number } | null = null;
  for (const slot of SLOTS) {
    const s = loadSlot(slot);
    const at = Number(read(`${keyOf(slot)}.at`) ?? 0);
    if (s && (!best || at > best.at)) best = { slot, at };
  }
  return best?.slot ?? null;
}

export function touchSlot(slot: number): void {
  try {
    localStorage.setItem(`${keyOf(slot)}.at`, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export interface Settings {
  assist: AssistMode;
  lang: 'ru' | 'en';
}

export function loadSettings(): Settings {
  const out: Settings = { assist: 'full', lang: navigator.language?.startsWith('ru') ? 'ru' : 'en' };
  try {
    Object.assign(out, JSON.parse(read(SETTINGS_KEY) ?? '{}'));
  } catch {
    /* defaults */
  }
  return out;
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
