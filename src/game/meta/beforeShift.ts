import Phaser from 'phaser';
import { loadMeta, rollDistrict } from './store';
import { shiftBrief } from './ShiftBrief';

/**
 * Every shift start opens «Сводка смены» first: the menu's «Новая смена» and
 * «Следующая смена» after a win both come through here, so the squad can be
 * changed before each shift (heroes returned or swapped in since the last one).
 * `onGo` gets the squad the player took in; `onBack` closes the screen.
 */
export function beforeShift(
  scene: Phaser.Scene,
  onGo: (squad: string[]) => void,
  onBack: () => void,
): Phaser.GameObjects.Container {
  const meta = loadMeta();
  return shiftBrief(scene, meta, rollDistrict(meta), onGo, onBack);
}
