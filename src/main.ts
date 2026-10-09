import Phaser from 'phaser';
import { GameScene } from './game/GameScene';
import { MenuScene } from './game/MenuScene';
import { chooseLayout, VIEW } from './game/layout';
import { fontsReady } from './game/ui';

fontsReady().then(() => {
  // Wide screens get the landscape canvas; the site's /play page reads this flag to size #app 16:9.
  if (window.innerWidth > 860 && window.innerWidth > window.innerHeight * 1.15) document.body.dataset.layout = 'landscape';
  // Pick the layout from the game's own box, so an embedding page (site /play) decides.
  const box = document.getElementById('app')?.getBoundingClientRect();
  chooseLayout(box?.width || window.innerWidth, box?.height || window.innerHeight);
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
});
