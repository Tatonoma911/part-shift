import Phaser from 'phaser';
import { account } from './account/cloud';
import { GameScene } from './game/GameScene';
import { LoadingScene } from './game/LoadingScene';
import { MenuScene } from './game/MenuScene';
import { ResultsPreviewScene } from './game/meta/ResultsPreviewScene';
import { UniverseScene } from './game/UniverseScene';
import { DossierScene } from './game/meta/DossierScene';
import { applyPalette } from './game/comfort';
import { chooseLayout, LANDSCAPE, VIEW } from './game/layout';
import { fontsReady } from './game/ui';
import './game/Hover'; // glow feedback on every clickable object (ui/code README §30)
import { initNative } from './platform/native';
import { bootAnalytics } from './analytics';
import { bootSocial } from './social';

initNative();
applyPalette();

// Cloud saves land in localStorage before the menu reads them (account.boot waits only briefly).
Promise.all([fontsReady(), account.boot()]).then(() => {
  // Wide screens get the landscape canvas; the site's /play page reads this flag to size #app 16:9.
  if (window.innerWidth > 860 && window.innerWidth > window.innerHeight * 1.15) document.body.dataset.layout = 'landscape';
  // Pick the layout from the game's own box, so an embedding page (site /play) decides.
  // Prevent the browser from intercepting pinch-to-zoom and scroll-to-zoom gestures.
  const appEl = document.getElementById('app');
  if (appEl) appEl.style.touchAction = 'none';
  const box = appEl?.getBoundingClientRect();
  chooseLayout(box?.width || window.innerWidth, box?.height || window.innerHeight);
  bootAnalytics(LANDSCAPE ? 'landscape' : 'portrait');
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    backgroundColor: '#dfeef3',
    width: VIEW.width,
    height: VIEW.height,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 2 },
    // The loading screen goes first: it loads the art and hands over to the menu.
    scene: [LoadingScene, MenuScene, GameScene, DossierScene, UniverseScene, ResultsPreviewScene],
  });
  // A finger on the board is a tap or a drag, never a page scroll: phones otherwise take the drag, cancel the tap and scroll.
  // Only the game lives in #app (DOM panels sit beside it on body), so the page's own scrolling is untouched.
  game.canvas.style.touchAction = 'none';
  document.getElementById('app')?.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  account.markLive();
  bootSocial();
});
