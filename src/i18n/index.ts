import ruWriter from '../data/text/ru.json';
import enUi from './en.json';
import enVoice from '../data/text/en_voice.json';
import enMeta from '../data/text/en_meta.json';
import enObjects from '../learning/text/en-objects.json';
import ruExtra from './ru-extra.json';

export type Lang = 'ru' | 'en';

/** Russian comes from the writer (text/ru.json); ru-extra holds a few UI-only lines. */
const ru: Record<string, string> = { ...ruWriter, ...ruExtra };
/** English: game-object descriptions (en-objects.json), voice/meta writer lines, then UI strings (highest priority). */
const en: Record<string, string> = { ...enObjects, ...enVoice, ...enMeta, ...enUi };
const tables: Record<Lang, Record<string, string>> = { ru, en };

/** ?lang=en|ru wins, then the language picked in settings, then the browser language. */
function detect(): Lang {
  const forced = new URLSearchParams(location.search).get('lang');
  if (forced === 'ru' || forced === 'en') return forced;
  try {
    const picked = JSON.parse(localStorage.getItem('partshift.settings.v1') ?? '{}').lang;
    if (picked === 'ru' || picked === 'en') return picked;
  } catch {
    /* ignore */
  }
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export let lang: Lang = typeof location === 'undefined' ? 'ru' : detect();

/** Switches the language for texts created from now on (the menu redraws itself). */
export function setLang(l: Lang): void {
  lang = l;
}

/** Looks up a text key and fills {placeholders}; falls back to Russian, then to the key itself. */
export function t(key: string, params: Record<string, string | number> = {}): string {
  const raw = tables[lang][key] ?? ru[key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

export function hasText(key: string): boolean {
  return key in ru;
}

/** The line exists in this language (no fallback to Russian). */
export function hasLangText(l: Lang, key: string): boolean {
  return key in tables[l];
}
