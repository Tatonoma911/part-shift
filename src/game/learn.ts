import { sound } from './audio';
import { lang } from '../i18n';
import { playIntro } from '../intro';
import { createLearning, type Learning } from '../learning';

/**
 * One learning layer (field guide, coach cards) for the whole game, from the
 * Learning thread's src/learning. The active scene sets what "pause" means.
 */
let inst: Learning | null = null;
type Hooks = { pause: () => void; resume: () => void; busy?: () => boolean };
let hooks: Hooks = { pause: () => {}, resume: () => {} };

export function learning(): Learning {
  inst ??= createLearning({
    lang,
    onPause: () => hooks.pause(),
    onResume: () => {
      sound.closeLore();
      hooks.resume();
    },
    onPlayIntro: () => void playIntro({ skipGate: true }),
    online: () => false,
    busy: () => hooks.busy?.() ?? false,
  });
  return inst;
}

/** Opens the field guide with its own calm theme (crossfades back on close). Coach cards keep the game music. */
export function openGuide(at?: string): void {
  const l = learning();
  if (l.isOpen) return;
  sound.openLore();
  l.openGuide(at);
}

export function setLearningHooks(h: Hooks | null): void {
  hooks = h ?? { pause: () => {}, resume: () => {} };
}

export function learningLang(l: 'ru' | 'en'): void {
  inst?.setLang(l);
}
