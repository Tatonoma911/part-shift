import Phaser from 'phaser';
import { account } from './account/cloud';
import { watchAccountConflicts } from './account/panel';
import { GameScene } from './game/GameScene';
import { MenuScene } from './game/MenuScene';
import { chooseLayout, LANDSCAPE, VIEW } from './game/layout';
import { fontsReady } from './game/ui';
import { initNative } from './platform/native';
import { bootAnalytics } from './analytics';
import { bootSocial } from './social';

initNative();

// Cloud saves land in localStorage before the menu reads them (account.boot waits only briefly).
Promise.all([fontsReady(), account.boot()]).then(() => {
  watchAccountConflicts();
  // Wide screens get the landscape canvas; the site's /play page reads this flag to size #app 16:9.
  if (window.innerWidth > 860 && window.innerWidth > window.innerHeight * 1.15) document.body.dataset.layout = 'landscape';
  // Pick the layout from the game's own box, so an embedding page (site /play) decides.
  const box = document.getElementById('app')?.getBoundingClientRect();
  chooseLayout(box?.width || window.innerWidth, box?.height || window.innerHeight);
  bootAnalytics(LANDSCAPE ? 'landscape' : 'portrait');
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    backgroundColor: '#dfeef3',
    width: VIEW.width,
    height: VIEW.height,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 2 },
    scene: [MenuScene, GameScene],
  });
  account.markLive();
  bootSocial();
});
