import { lang } from '../i18n';
import { isNative } from '../platform/native';
import { Analytics, type Storage } from './analytics';
import { askConsent, closeConsent } from './consent';
import { loadFirebaseSink } from './firebase';

export type { Params } from './analytics';

const store: Storage = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode: ask again next time */
    }
  },
};

const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
const optedOut = nav.doNotTrack === '1' || nav.globalPrivacyControl === true;
const debug = new URLSearchParams(location.search).get('analytics') === 'debug';

/** The game's one analytics object; see docs/ANALYTICS.md for every event. */
export const analytics = new Analytics(store, loadFirebaseSink, optedOut, debug ? (n, p) => console.info('[analytics]', n, p) : null);

let booted = false;

/** Once at startup: the launch event and "where did they leave" on every trip to the background. */
export function bootAnalytics(layout: string): void {
  if (booted) return;
  booted = true;
  analytics.track('game_boot', { ...analytics.launch(), platform: isNative ? 'android' : 'web', layout, lang });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) analytics.left();
  });
}

/** Shows the consent card if this device was never asked. */
export function askAnalyticsConsent(): void {
  askConsent(analytics);
}

export { closeConsent };
