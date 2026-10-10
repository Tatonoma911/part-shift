import { playIntroComic } from '../src/intro/intro-comic.js';
import type { Lang } from './content';

/**
 * «Как всё началось»: the game's intro comic (src/intro, 12 animated pages, RU + EN, music), played over the site.
 * Loaded on demand, so the site only fetches its panels when someone presses play.
 */
const files = import.meta.glob('../src/assets/comic/**/*.{jpg,png}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
// Only the sounds the comic asks for (its music and the sfx named in its script).
const audio = import.meta.glob(['../src/assets/audio/music/menu.mp3', '../src/assets/audio/sfx/{ui_tap,demon_awake,nest_open,threat_level_up}.mp3'], { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export function playStory(lang: Lang): Promise<{ skipped: boolean }> {
  const assets: Record<string, string> = {};
  for (const [path, url] of Object.entries(files)) assets[path.replace('../src/assets/comic/', '')] = url;
  for (const [path, url] of Object.entries(audio)) {
    const name = path.split('/').pop()!.replace('.mp3', '');
    assets[`audio/${name}.mp3`] = assets[`audio/${name}.ogg`] = url;
  }
  // Same swap as the game: the old chiptune is replaced by the menu theme (audio/MUSIC.md).
  const menu = Object.entries(audio).find(([path]) => path.endsWith('/music/menu.mp3'))?.[1];
  if (menu) assets['audio/theme_lumen.mp3'] = assets['audio/theme_lumen.ogg'] = menu;
  return playIntroComic({ lang, assets, skipGate: true });
}
