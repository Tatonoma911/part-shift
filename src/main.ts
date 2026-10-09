import Phaser from 'phaser';
import { GameScene } from './game/GameScene';
import { VIEW } from './game/layout';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#0f1420',
  width: VIEW.width,
  height: VIEW.height,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 2 },
  scene: [GameScene],
});
