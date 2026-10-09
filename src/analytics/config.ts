import type { FirebaseOptions } from 'firebase/app';

/**
 * The Firebase web app config with Google Analytics turned on (it carries a `measurementId`, G-…).
 * Same object as the accounts' FIREBASE_CONFIG; values are public by design.
 * While it is null nothing is sent anywhere: events stay on the device (and in the console with ?analytics=debug).
 */
export const ANALYTICS_FIREBASE_CONFIG: FirebaseOptions | null = null;
