// Android shell glue (Capacitor). Everything here is a no-op in the browser.
// Fullscreen, portrait lock and keep-screen-on live in android/ (MainActivity, AndroidManifest).
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

export const isNative = Capacitor.isNativePlatform();

/** Returns true when it handled the back press; false sends the app to the background. */
type BackHandler = () => boolean;
let backHandler: BackHandler | null = null;

/** The game says what the Android back button does on the current screen. */
export function setBackHandler(fn: BackHandler | null): void {
  backHandler = fn;
}

export function initNative(): void {
  if (!isNative) return;
  App.addListener('backButton', () => {
    if (backHandler?.()) return;
    // Like the home button: the run is already saved and paused, the app stays in memory.
    App.minimizeApp().catch(() => undefined);
  });
}
