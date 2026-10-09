import type { FirebaseOptions } from 'firebase/app';

/**
 * The web app config from Firebase console → Project settings → Your apps.
 * These values are public by design (Firebase protects data with firestore.rules, not with this key).
 * While it is null the game runs local-only: no account button actions, no network.
 */
export const FIREBASE_CONFIG: FirebaseOptions | null = null;
