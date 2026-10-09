import { lang } from '../i18n';
import { sound } from '../game/audio';
import { introSeen, playIntroComic } from './intro-comic.js';

/**
 * The intro comic (comic/ in the project folder, synced by `npm run sync-data`).
 * Its panels and sprites are bundled like the game art, so the one-file
 * artifact build inlines them; its sounds reuse the game's mp3s.
 */
const files = import.meta.glob('../assets/comic/**/*.{jpg,png}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const audio = import.meta.glob(['../assets/audio/**/*.mp3', '!../assets/audio/music/theme_lumen.mp3'], { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

function assetMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [path, url] of Object.entries(files)) map[path.replace('../assets/comic/', '')] = url;
  for (const [path, url] of Object.entries(audio)) {
    const name = path.split('/').pop()!.replace('.mp3', '');
    // The comic asks for .ogg where the browser can play it; both names map to our mp3.
    map[`audio/${name}.mp3`] = url;
    map[`audio/${name}.ogg`] = url;
  }
  // The comic still asks for the old chiptune; the menu theme replaced it (audio/MUSIC.md).
  const menu = Object.entries(audio).find(([path]) => path.endsWith('/music/menu.mp3'))?.[1];
  if (menu) map['audio/theme_lumen.mp3'] = map['audio/theme_lumen.ogg'] = menu;
  return map;
}

export { introSeen };

/** Plays the comic over the game; game music pauses while it runs. */
export async function playIntro(opts: { skipGate?: boolean } = {}): Promise<{ skipped: boolean }> {
  sound.stopMusic(0.2);
  return playIntroComic({
    lang,
    assets: assetMap(),
    music: sound.musicOn,
    // Same levels as the game's sliders (squared like the game's buses).
    musicVolume: (sound.prefs.master * sound.prefs.music) ** 2,
    sfxVolume: (sound.prefs.master * sound.prefs.effects) ** 2,
    skipGate: opts.skipGate,
  });
}
