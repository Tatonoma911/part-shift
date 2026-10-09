import ru from './text/ru.json';
import en from './text/en.json';
import ruGame from '../data/text/ru.json';
import enGame from '../i18n/en.json';
import ruExtra from '../i18n/ru-extra.json';
import enObjects from './text/en-objects.json';

export type Lang = 'ru' | 'en';

/**
 * Learning strings live in learning/text/*.json; names and descriptions of game
 * objects come from the writer's text/ru.json and the game's en.json, so the
 * guide always says what the game says.
 */
const tables: Record<Lang, Record<string, string>> = {
  ru: { ...(ruGame as Record<string, string>), ...(ruExtra as Record<string, string>), ...prefix(ru) },
  en: { ...(enObjects as Record<string, string>), ...(enGame as Record<string, string>), ...prefix(en) },
};

function prefix(t: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(t)) out[`learn.${k}`] = v;
  return out;
}

let current: Lang = 'ru';

export function setLang(l: Lang): void {
  current = l;
}

export function getLang(): Lang {
  return current;
}

/** Learning keys are written without the "learn." prefix; game keys as they are. Falls back to Russian. */
export function tr(key: string, params: Record<string, string | number> = {}): string {
  const k = key.includes('.') && tables.ru[`learn.${key}`] !== undefined ? `learn.${key}` : key;
  const raw = tables[current][k] ?? tables.ru[k] ?? key;
  return raw.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

export function has(key: string): boolean {
  return tables.ru[`learn.${key}`] !== undefined || tables.ru[key] !== undefined;
}
