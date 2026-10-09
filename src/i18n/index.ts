import ruWriter from '../data/text/ru.json';
import en from './en.json';
import ruExtra from './ru-extra.json';

export type Lang = 'ru' | 'en';

/** Russian comes from the writer (text/ru.json); ru-extra holds a few UI-only lines. */
const ru: Record<string, string> = { ...ruWriter, ...ruExtra };
const tables: Record<Lang, Record<string, string>> = { ru, en };

/** ?lang=en|ru wins, then the browser language; Russian speakers get ru, everyone else en. */
function detect(): Lang {
  const forced = new URLSearchParams(location.search).get('lang');
  if (forced === 'ru' || forced === 'en') return forced;
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export const lang: Lang = typeof location === 'undefined' ? 'ru' : detect();

/** Looks up a text key and fills {placeholders}; falls back to Russian, then to the key itself. */
export function t(key: string, params: Record<string, string | number> = {}): string {
  const raw = tables[lang][key] ?? ru[key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

export function hasText(key: string): boolean {
  return key in ru;
}
