import Phaser from 'phaser';
import { createArt } from '../assets';
import { C, VIEW } from '../layout';
import { demoMeta, resultsPreview } from './preview';

/**
 * ?meta=results opens the shift results with sample data in a scene of its own, so the
 * menu's lifecycle can't remove it. Art: the Art Director's screenshot of the results screen.
 * Buttons reload the scene.
 */
export class ResultsPreviewScene extends Phaser.Scene {
  constructor() {
    super('results-preview');
  }

  create(): void {
    if (!this.anims.exists('resident.idle')) createArt(this);
    const win = new URLSearchParams(location.search).get('meta') !== 'lose';
    this.add.rectangle(0, 0, VIEW.width, VIEW.height, C.paper2).setOrigin(0);
    resultsPreview(this, win, demoMeta(), () => this.scene.restart());
  }
}

/** True when the page was opened with ?meta=results (and the loading screen should hand over here). */
export function wantsResultsPreview(): boolean {
  return new URLSearchParams(location.search).get('meta') === 'results';
}
