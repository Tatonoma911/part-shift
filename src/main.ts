import Phaser from 'phaser';
import { account } from './account/cloud';
import { watchAccountConflicts } from './account/panel';
import { GameScene } from './game/GameScene';
import { MenuScene } from './game/MenuScene';
import { chooseLayout, VIEW } from './game/layout';
import { fontsReady } from './game/ui';

// Cloud saves land in localStorage before the menu reads them (account.boot waits only briefly).
Promise.all([fontsReady(), account.boot()]).then(() => {
  watchAccountConflicts();
  chooseLayout(window.innerWidth, window.innerHeight);
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
});
