import Phaser from 'phaser';
import { BOARD, LANDSCAPE, VIEW } from './layout';

/** Depth bands: below 0 the sky, 19 and up the HUD/dock, everything between is the board. */
export const UI_DEPTH = 19;
const MAX_ZOOM = 3;

/**
 * Three cameras: a fixed sky camera, a board camera that zooms and pans inside
 * the board area, and a fixed UI camera on top. Objects are routed by depth
 * every frame, so code that adds objects only has to pick a depth.
 */
export class Cameras {
  readonly sky: Phaser.Cameras.Scene2D.Camera;
  readonly board: Phaser.Cameras.Scene2D.Camera;
  readonly ui: Phaser.Cameras.Scene2D.Camera;
  private zoom = 1;
  private center: { x: number; y: number };
  private home: { x: number; y: number };
  /** Zoom that fits the whole board in view (below 1 when the board is taller than the view). */
  private fit = 1;
  private bounds = { x: 0, y: 0, w: VIEW.width, h: VIEW.height };
  private pinch: { dist: number; zoom: number; mid: { x: number; y: number } } | null = null;
  private pan: { x: number; y: number } | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.sky = scene.cameras.main;
    const top = BOARD.y - 16;
    const h = BOARD.h + 32;
    // Portrait: the board camera spans the screen width; landscape: only the board column.
    const left = LANDSCAPE ? BOARD.x - 16 : 0;
    const w = LANDSCAPE ? BOARD.w + 32 : VIEW.width;
    this.board = scene.cameras.add(left, top, w, h);
    this.ui = scene.cameras.add(0, 0, VIEW.width, VIEW.height);
    this.home = { x: left + w / 2, y: top + h / 2 };
    this.center = { ...this.home };
    this.apply();
    this.bindInput();
  }

  /** The board rectangle the view may not leave when zoomed in. `grow` lets a small board (the tutorial) fill the view. */
  setBounds(x: number, y: number, w: number, h: number, grow = false): void {
    this.bounds = { x: x - 20, y: y - 20, w: w + 40, h: h + 40 };
    const c = this.board;
    this.fit = Math.min(grow ? MAX_ZOOM : 1, c.width / this.bounds.w, c.height / this.bounds.h);
    if (this.fit < 1) this.home = { x: x + w / 2, y: y + h / 2 };
    this.zoom = this.fit;
    this.center = { ...this.home };
    this.apply();
  }

  get zoomed(): boolean {
    return this.zoom > this.fit + 0.001;
  }

  /** Board-world point under a screen point (the pointer's own worldX is the UI camera's). */
  worldAt(p: { x: number; y: number }): { x: number; y: number } {
    const v = this.board.getWorldPoint(p.x, p.y);
    return { x: v.x, y: v.y };
  }

  inBoardView(p: { x: number; y: number }): boolean {
    const c = this.board;
    return p.x >= c.x && p.x <= c.x + c.width && p.y >= c.y && p.y <= c.y + c.height;
  }

  /** Zoom keeping the world point under `at` (a screen point) in place. */
  zoomBy(factor: number, at?: { x: number; y: number }): void {
    const next = Phaser.Math.Clamp(this.zoom * factor, this.fit, MAX_ZOOM);
    if (next === this.zoom) return;
    const anchor = at && this.inBoardView(at) ? this.worldAt(at) : { ...this.center };
    const k = this.zoom / next;
    this.center = { x: anchor.x + (this.center.x - anchor.x) * k, y: anchor.y + (this.center.y - anchor.y) * k };
    this.zoom = next;
    this.apply();
  }

  /** Centers the view on a board-world point at a zoom (online: our own center on a big field). */
  focus(x: number, y: number, zoom: number): void {
    this.zoom = Phaser.Math.Clamp(zoom, this.fit, MAX_ZOOM);
    this.center = { x, y };
    this.apply();
  }

  reset(): void {
    this.zoom = this.fit;
    this.center = { ...this.home };
    this.apply();
  }

  panBy(dx: number, dy: number): void {
    this.center = { x: this.center.x - dx / this.zoom, y: this.center.y - dy / this.zoom };
    this.apply();
  }

  /** True while two fingers or a right/middle-button drag move the view: digging must not see it. */
  get busy(): boolean {
    return this.pinch !== null || this.pan !== null;
  }

  /** Sends each object to its camera by depth (containers carry their children). */
  route(): void {
    const sky = this.sky.id;
    const board = this.board.id;
    const ui = this.ui.id;
    for (const go of this.scene.children.list as (Phaser.GameObjects.GameObject & { depth: number; cameraFilter: number })[]) {
      const own = go.depth < 0 ? sky : go.depth >= UI_DEPTH ? ui : board;
      go.cameraFilter = (sky | board | ui) & ~own;
      if (go instanceof Phaser.GameObjects.Text && go.style.resolution < 2) go.setResolution(2);
      if (go instanceof Phaser.GameObjects.Container) {
        for (const child of go.list) if (child instanceof Phaser.GameObjects.Text && child.style.resolution < 2) child.setResolution(2);
      }
    }
  }

  private apply(): void {
    const c = this.board;
    const halfW = c.width / (2 * this.zoom);
    const halfH = c.height / (2 * this.zoom);
    const clamp = (v: number, min: number, max: number, home: number, half: number) => (max - min <= half * 2 ? home : Phaser.Math.Clamp(v, min + half, max - half));
    // At the fit zoom the view rests on its home spot (identity in portrait).
    const atHome = this.zoom <= this.fit + 0.001;
    this.center.x = atHome ? this.home.x : clamp(this.center.x, this.bounds.x, this.bounds.x + this.bounds.w, this.home.x, halfW);
    this.center.y = atHome ? this.home.y : clamp(this.center.y, this.bounds.y, this.bounds.y + this.bounds.h, this.home.y, halfH);
    c.setZoom(this.zoom);
    c.centerOn(this.center.x, this.center.y);
  }

  private bindInput(): void {
    const sc = this.scene;
    // Plain mouse wheel zooms the board (no Ctrl needed).
    sc.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (!this.inBoardView(p)) return;
      this.zoomBy(dy < 0 ? 1.07 : 1 / 1.07, p);
    });
    sc.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown() || p.middleButtonDown()) this.pan = { x: p.x, y: p.y };
    });
    sc.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const a = sc.input.pointer1;
      const b = sc.input.pointer2;
      if (a.isDown && b.isDown) {
        const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (!this.pinch) this.pinch = { dist, zoom: this.zoom, mid };
        else {
          this.zoomBy(this.pinch.zoom * Math.pow(dist / this.pinch.dist, 0.65) / this.zoom, mid);
          this.panBy(mid.x - this.pinch.mid.x, mid.y - this.pinch.mid.y);
          this.pinch.mid = mid;
        }
        return;
      }
      if (this.pan && p.isDown) {
        this.panBy(p.x - this.pan.x, p.y - this.pan.y);
        this.pan = { x: p.x, y: p.y };
      }
    });
    const end = () => {
      if (!sc.input.pointer2.isDown) this.pinch = null;
      if (!sc.input.activePointer.isDown) this.pan = null;
    };
    sc.input.on('pointerup', end);
    sc.input.on('pointerupoutside', end);
    const keys = sc.input.keyboard;
    const step = 60;
    keys?.on('keydown-PLUS', () => this.zoomBy(1.25));
    keys?.on('keydown-NUMPAD_ADD', () => this.zoomBy(1.25));
    keys?.on('keydown-MINUS', () => this.zoomBy(0.8));
    keys?.on('keydown-NUMPAD_SUBTRACT', () => this.zoomBy(0.8));
    keys?.on('keydown-ZERO', () => this.reset());
    keys?.on('keydown-LEFT', () => this.panBy(step, 0));
    keys?.on('keydown-RIGHT', () => this.panBy(-step, 0));
    keys?.on('keydown-UP', () => this.panBy(0, step));
    keys?.on('keydown-DOWN', () => this.panBy(0, -step));
  }
}
