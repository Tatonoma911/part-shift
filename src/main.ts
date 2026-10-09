import Phaser from 'phaser';
import { account } from './account/cloud';
import { watchAccountConflicts } from './account/panel';
import { GameScene } from './game/GameScene';
import { VIEW } from './game/layout';
import { fontsReady } from './game/ui';

// Cloud saves land in localStorage before the scene reads them (account.boot waits only briefly).
Promise.all([fontsReady(), account.boot()]).then(() => {
  watchAccountConflicts();
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    backgroundColor: '#dfeef3',
    width: VIEW.width,
    height: VIEW.height,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 2 },
    scene: [GameScene],
  });
  account.markLive();
});
