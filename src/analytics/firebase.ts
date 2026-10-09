import type { Sink } from './analytics';
import { ANALYTICS_FIREBASE_CONFIG } from './config';

declare const __ANALYTICS__: boolean;

/**
 * Firebase Analytics (GA4), downloaded only after the player agreed.
 * No ad signals or ad personalization, no automatic page views, no user id: just the game's events.
 */
export async function loadFirebaseSink(): Promise<Sink | null> {
  // The one-file Artifact preview builds without it (__ANALYTICS__ is false there).
  if (!__ANALYTICS__) return null;
  if (!ANALYTICS_FIREBASE_CONFIG?.measurementId) return null;
  const { getApps, initializeApp } = await import('firebase/app');
  const { initializeAnalytics, isSupported, logEvent } = await import('firebase/analytics');
  if (!(await isSupported())) return null;
  const name = 'partshift-analytics';
  const app = getApps().find((a) => a.name === name) ?? initializeApp(ANALYTICS_FIREBASE_CONFIG, name);
  const ga = initializeAnalytics(app, {
    config: { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false },
  });
  return { send: (event, params) => logEvent(ga, event, params) };
}
