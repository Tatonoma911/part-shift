import Phaser from 'phaser';
import { GameScene } from './game/GameScene';
import { VIEW } from './game/layout';
import { fontsReady } from './game/ui';

fontsReady().then(() => {
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
});
