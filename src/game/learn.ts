import { lang } from '../i18n';
import { playIntro } from '../intro';
import { createLearning, type Learning } from '../learning';

/**
 * One learning layer (field guide, coach cards) for the whole game, from the
 * Learning thread's src/learning. The active scene sets what "pause" means.
 */
let inst: Learning | null = null;
let hooks: { pause: () => void; resume: () => void } = { pause: () => {}, resume: () => {} };

export function learning(): Learning {
  inst ??= createLearning({
    lang,
    onPause: () => hooks.pause(),
    onResume: () => hooks.resume(),
    onPlayIntro: () => void playIntro({ skipGate: true }),
    online: () => false,
  });
  return inst;
}

export function setLearningHooks(h: { pause: () => void; resume: () => void } | null): void {
  hooks = h ?? { pause: () => {}, resume: () => {} };
}

export function learningLang(l: 'ru' | 'en'): void {
  inst?.setLang(l);
}
