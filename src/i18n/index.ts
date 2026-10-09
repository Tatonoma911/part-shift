import en from './en.json';
import ru from './ru.json';

export type Lang = 'ru' | 'en';
export type StringKey = keyof typeof ru;

const tables: Record<Lang, Record<StringKey, string>> = { ru, en };

/** ?lang=en|ru wins, then the browser language; Russian speakers get ru, everyone else en. */
function detect(): Lang {
  const forced = new URLSearchParams(location.search).get('lang');
  if (forced === 'ru' || forced === 'en') return forced;
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export const lang: Lang = typeof location === 'undefined' ? 'ru' : detect();

export function t(key: StringKey): string {
  return tables[lang][key] ?? tables.ru[key];
}
