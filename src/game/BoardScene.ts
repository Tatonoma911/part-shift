import Phaser from 'phaser';
import rules from '../data/rules.json';
import { HINT_CHANNELS, type BoardConfig, type SimConfig } from '../core/types';
import { World } from '../core/world';
import { t } from '../i18n';
import { CHANNEL_STYLE, COLORS, FOOTER_HEIGHT, HUD_HEIGHT, SIDE_MARGIN, SITE_GLYPH, VIEW } from './layout';

const LONG_PRESS_MS = 450;

/** Corner of the cell where each clue channel is drawn. */
const CHANNEL_SLOT = { nest: [0, 0], demon: [1, 0], cache: [0, 1], depot: [1, 1] } as const;

interface CellLabels {
  hints: Record<(typeof HINT_CHANNELS)[number], Phaser.GameObjects.Text>;
  glyph: Phaser.GameObjects.Text;
}

type DragMode = 'queue' | 'cancel';

/**
 * Draws the board with placeholder shapes and turns touches into commands.
 * All rules live in core/World; this scene only reads its state.
 */
export class BoardScene extends Phaser.Scene {
  private world!: World;
  private cellSize = 0;
  private originX = 0;
  private originY = 0;
  private gfx!: Phaser.GameObjects.Graphics;
  /** Residents and dig bars, drawn above the clue numbers. */
  private unitGfx!: Phaser.GameObjects.Graphics;
  private labels = new Map<number, CellLabels>();
  private energyText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private helpText!: Phaser.GameObjects.Text;

  private dragMode: DragMode | null = null;
  private lastDragCell = -1;
  private pressCell = -1;
  private pressTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super('board');
  }

  create(): void {
    const seed = Number(new URLSearchParams(location.search).get('seed')) || Date.now() % 1_000_000;
    this.world = new World(rules.board as BoardConfig, rules.sim as SimConfig, seed);
    (window as unknown as { partShift: unknown }).partShift = { world: this.world, seed };

    const { width, height } = this.world.board;
    const availW = VIEW.width - SIDE_MARGIN * 2;
    const availH = VIEW.height - HUD_HEIGHT - FOOTER_HEIGHT;
    this.cellSize = Math.floor(Math.min(availW / width, availH / height));
    this.originX = Math.round((VIEW.width - this.cellSize * width) / 2);
    this.originY = HUD_HEIGHT + Math.round((availH - this.cellSize * height) / 2);

    this.gfx = this.add.graphics();
    this.unitGfx = this.add.graphics().setDepth(5);
    this.createHud();
    this.createFooter();

    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);
  }

  update(_time: number, deltaMs: number): void {
    this.world.tick(Math.min(deltaMs, 100) / 1000);
    for (const e of this.world.drainEvents()) {
      if (e.type === 'revealed') this.refreshLabels();
      else if (e.type === 'cacheFound') this.refreshLabels();
      else if (e.type === 'energy') this.floatText(e.x, e.y, `+${e.amount}`, '#ffd54f');
      else if (e.type === 'threatAwakened') this.floatText(e.x, e.y, t('float.threat'), '#ff6b6b');
    }
    this.drawBoard();
    this.updateHud();
  }

  // ---- drawing ----------------------------------------------------------

  private createHud(): void {
    this.add.text(SIDE_MARGIN, 24, 'PART SHIFT', { fontFamily: 'monospace', fontSize: '22px', color: COLORS.textDim });
    this.energyText = this.add.text(SIDE_MARGIN, 58, '', { fontFamily: 'monospace', fontSize: '40px', color: '#ffd54f', fontStyle: 'bold' });
    this.infoText = this.add
      .text(VIEW.width - SIDE_MARGIN, 66, '', { fontFamily: 'monospace', fontSize: '26px', color: COLORS.text })
      .setOrigin(1, 0);
  }

  private createFooter(): void {
    const top = VIEW.height - FOOTER_HEIGHT + 16;
    this.helpText = this.add
      .text(VIEW.width / 2, top, '', { fontFamily: 'sans-serif', fontSize: '24px', color: COLORS.text, align: 'center', wordWrap: { width: VIEW.width - 40 } })
      .setOrigin(0.5, 0);
    const keys = HINT_CHANNELS;
    const slot = (VIEW.width - SIDE_MARGIN * 2) / keys.length;
    keys.forEach((k, i) => {
      const s = CHANNEL_STYLE[k];
      this.add
        .text(SIDE_MARGIN + slot * i + slot / 2, top + 84, `■ ${t(s.label)}`, { fontFamily: 'sans-serif', fontSize: '21px', color: s.color })
        .setOrigin(0.5, 0);
    });
  }

  private updateHud(): void {
    const w = this.world;
    this.energyText.setText(`⚡ ${w.energy}`);
    const secs = Math.floor(w.time);
    const busy = w.workers.filter((x) => x.state !== 'idle').length;
    this.infoText.setText(`${t('hud.residents')} ${busy}/${w.workers.length}   ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`);
    this.helpText.setText(w.started ? t('help.dig') : t('help.placeCore'));
  }

  private cellRect(x: number, y: number) {
    return { px: this.originX + x * this.cellSize, py: this.originY + y * this.cellSize, s: this.cellSize };
  }

  private drawBoard(): void {
    let g = this.gfx;
    const b = this.world.board;
    g.clear();
    for (const c of b.cells) {
      const { px, py, s } = this.cellRect(c.x, c.y);
      const inset = 2;
      if (!c.revealed) {
        const frontier = this.world.started && b.isFrontier(c.x, c.y);
        g.fillStyle(frontier ? COLORS.frontier : COLORS.covered, 1);
        g.fillRoundedRect(px + inset, py + inset, s - inset * 2, s - inset * 2, 8);
        g.lineStyle(2, COLORS.coveredEdge, 1);
        g.strokeRoundedRect(px + inset, py + inset, s - inset * 2, s - inset * 2, 8);
        if (c.marked) {
          g.fillStyle(COLORS.marked, 1);
          g.fillTriangle(px + s * 0.35, py + s * 0.25, px + s * 0.35, py + s * 0.6, px + s * 0.7, py + s * 0.42);
          g.fillRect(px + s * 0.33, py + s * 0.25, 4, s * 0.5);
        }
        if (this.world.isQueued(c.x, c.y)) {
          g.lineStyle(4, COLORS.queued, 1);
          g.strokeRoundedRect(px + 5, py + 5, s - 10, s - 10, 6);
        }
      } else {
        const threat = c.site !== 'none' && c.site !== 'cache' && !c.resolved;
        g.fillStyle(c.core ? COLORS.core : threat ? COLORS.threat : COLORS.opened, 1);
        g.fillRect(px + 1, py + 1, s - 2, s - 2);
        g.lineStyle(1, COLORS.openedEdge, 1);
        g.strokeRect(px + 1, py + 1, s - 2, s - 2);
      }
    }
    // Dig progress bars and residents.
    g = this.unitGfx;
    g.clear();
    for (const w of this.world.workers) {
      if (w.state === 'digging' && w.target) {
        const { px, py, s } = this.cellRect(w.target.x, w.target.y);
        const p = Math.min(1, w.progress / this.world.sim.digSeconds);
        g.fillStyle(0x000000, 0.5);
        g.fillRect(px + 8, py + s - 14, s - 16, 6);
        g.fillStyle(COLORS.queued, 1);
        g.fillRect(px + 8, py + s - 14, (s - 16) * p, 6);
      }
      const cx = this.originX + (w.x + 0.5) * this.cellSize;
      const cy = this.originY + (w.y + 0.5) * this.cellSize;
      const bob = w.state === 'digging' ? Math.sin(this.time.now / 80) * 3 : 0;
      g.fillStyle(0x000000, 0.35);
      g.fillEllipse(cx, cy + this.cellSize * 0.22, this.cellSize * 0.34, this.cellSize * 0.12);
      g.fillStyle(COLORS.worker, 1);
      g.fillCircle(cx, cy - this.cellSize * 0.05 + bob, this.cellSize * 0.16);
    }
  }

  /** Re-reads glyphs and clue numbers; clue counts change whenever a site is resolved. */
  private refreshLabels(): void {
    const b = this.world.board;
    for (const c of b.cells) {
      if (!c.revealed) continue;
      const idx = c.y * b.width + c.x;
      let l = this.labels.get(idx);
      if (!l) {
        l = this.createLabels(c.x, c.y);
        this.labels.set(idx, l);
      }
      if (c.core) {
        l.glyph.setText(t('core.short')).setColor('#ffffff').setFontSize(Math.round(this.cellSize * 0.4));
        continue;
      }
      if (c.site !== 'none') {
        const color = CHANNEL_STYLE[c.site].color;
        l.glyph.setText(SITE_GLYPH[c.site]).setColor(color).setAlpha(c.resolved ? 0.35 : 1);
        continue;
      }
      const h = b.hints(c.x, c.y);
      const active = HINT_CHANNELS.filter((k) => h[k] > 0);
      const { px, py, s } = this.cellRect(c.x, c.y);
      for (const k of HINT_CHANNELS) {
        const t = l.hints[k].setText(h[k] > 0 ? String(h[k]) : '');
        // A lone clue sits big in the middle; several share the four corners.
        const [cx, cy] = CHANNEL_SLOT[k];
        if (active.length === 1) t.setPosition(px + s / 2, py + s / 2).setFontSize(Math.round(s * 0.5));
        else t.setPosition(px + s * (0.28 + cx * 0.44), py + s * (0.28 + cy * 0.44)).setFontSize(Math.round(s * 0.36));
      }
    }
  }

  private createLabels(x: number, y: number): CellLabels {
    const { px, py, s } = this.cellRect(x, y);
    const style = (color: string, size: number): Phaser.Types.GameObjects.Text.TextStyle => ({
      fontFamily: 'monospace',
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color,
    });
    const hintSize = Math.round(s * 0.36);
    const hints = {} as CellLabels['hints'];
    for (const k of HINT_CHANNELS) {
      const [cx, cy] = CHANNEL_SLOT[k];
      hints[k] = this.add
        .text(px + s * (0.28 + cx * 0.44), py + s * (0.28 + cy * 0.44), '', style(CHANNEL_STYLE[k].color, hintSize))
        .setOrigin(0.5);
    }
    const glyph = this.add.text(px + s / 2, py + s / 2, '', style('#ffffff', Math.round(s * 0.55))).setOrigin(0.5);
    return { hints, glyph };
  }

  private floatText(x: number, y: number, text: string, color: string): void {
    const { px, py, s } = this.cellRect(x, y);
    const t = this.add
      .text(px + s / 2, py + s / 2, text, { fontFamily: 'monospace', fontSize: '22px', fontStyle: 'bold', color })
      .setOrigin(0.5)
      .setDepth(10);
    this.tweens.add({ targets: t, y: t.y - 40, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  // ---- input ------------------------------------------------------------

  private cellAt(p: Phaser.Input.Pointer): number {
    const x = Math.floor((p.worldX - this.originX) / this.cellSize);
    const y = Math.floor((p.worldY - this.originY) / this.cellSize);
    const b = this.world.board;
    return b.inBounds(x, y) ? y * b.width + x : -1;
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    const idx = this.cellAt(p);
    if (idx < 0) return;
    const b = this.world.board;
    const x = idx % b.width;
    const y = Math.floor(idx / b.width);
    if (!this.world.started) {
      this.world.apply({ type: 'placeCore', x, y });
      return;
    }
    if (p.rightButtonDown()) {
      this.world.apply({ type: 'toggleMark', x, y });
      return;
    }
    this.dragMode = this.world.isQueued(x, y) ? 'cancel' : 'queue';
    this.lastDragCell = -1;
    this.pressCell = idx;
    this.applyDrag(idx);
    this.pressTimer = this.time.delayedCall(LONG_PRESS_MS, () => {
      // Long press on the same cell: undo the drag action and toggle the mark instead.
      if (this.pressCell !== idx || this.lastDragCell !== idx) return;
      if (this.dragMode === 'queue') this.world.apply({ type: 'cancelDig', x, y });
      this.world.apply({ type: 'toggleMark', x, y });
      this.dragMode = null;
    });
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    if (!this.dragMode || !p.isDown) return;
    const idx = this.cellAt(p);
    if (idx < 0 || idx === this.lastDragCell) return;
    this.pressCell = -1;
    this.applyDrag(idx);
  }

  private onPointerUp(): void {
    this.dragMode = null;
    this.pressTimer?.remove();
    this.pressTimer = null;
  }

  private applyDrag(idx: number): void {
    const w = this.world.board.width;
    const x = idx % w;
    const y = Math.floor(idx / w);
    this.lastDragCell = idx;
    if (this.dragMode === 'queue') this.world.apply({ type: 'queueDig', x, y });
    else if (this.dragMode === 'cancel') this.world.apply({ type: 'cancelDig', x, y });
  }
}
