import Phaser from 'phaser';
import { BUILDABLE, buildings as buildingDefs, config } from '../core/data';
import { cellKey } from '../core/grid';
import type { AssistMode, GameState, Unit } from '../core/state';
import { World, type GameEvent } from '../core/world';
import { t } from '../i18n';
import { markTutorialDone, TutorialGuide, tutorialDone } from './Tutorial';
import { BAR_HEIGHT, BUILDING_STYLE, CHANNEL_COLOR, COLORS, HUD_HEIGHT, SIDE_MARGIN, TECH_COLOR, VIEW } from './layout';

const SAVE_KEY = 'partshift.save.v1';
const BEST_KEY = 'partshift.best.v1';
const LONG_PRESS_MS = 450;
const ME = 0;
const CHANNELS = ['threat', 'demon', 'finds'] as const;

/** Events that become a line in the toast bar (writer's text keys). */
const TOASTS: Record<string, (e: GameEvent) => string> = {
  nest_open: () => t('event.nest_opened'),
  heavy_nest_open: () => t('event.heavy_nest_opened'),
  demon_awake: () => t('event.demon_awake'),
  demon_warning: () => t('event.demon_warning'),
  demon_windup: () => t('enemy.demon.windup'),
  demon_die: () => t('event.demon_dead'),
  threat_level_up: (e) => t('event.threat_rising', { level: e.amount ?? 0 }),
  cache_open: (e) => t('event.cache_reward', { energy: e.amount ?? 0 }),
  nest_destroyed: (e) => t('event.nest_destroyed', { energy: e.amount ?? 0 }),
  building_lost: (e) => t('event.building_lost', { building: t(`building.${e.text}.name`) }),
  part_attached: (e) => t('trophy.module_acquired', { part: t(`part.${e.text}.label`) }),
  part_recycled: (e) => t('part.recycled', { energy: e.amount ?? 0 }),
  defender_trained: () => t('unit.trained'),
  build_refused: (e) => t(e.text ?? 'build.invalid_cell'),
};

function loadState(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    if (s.version !== 1 || s.outcome !== 'playing') return null;
    // Saves from before the scanner existed.
    for (const p of s.players) p.assist ??= { mode: 'full', charges: config.assist.scanner.maxCharges, recharge: config.assist.scanner.rechargeSeconds, scanLeft: 0 };
    return s;
  } catch {
    return null;
  }
}

/**
 * Draws the match with placeholder shapes and turns touches into commands.
 * All rules live in core/World; this scene only reads its state.
 */
export class GameScene extends Phaser.Scene {
  private world!: World;
  private cs = 0;
  private ox = 0;
  private oy = 0;
  private gfx!: Phaser.GameObjects.Graphics;
  private top!: Phaser.GameObjects.Graphics;
  private clueTexts = new Map<number, Phaser.GameObjects.Text[]>();
  private labels = new Map<number, Phaser.GameObjects.Text>();
  private hud!: { energy: Phaser.GameObjects.Text; people: Phaser.GameObjects.Text; threat: Phaser.GameObjects.Text; arc: Phaser.GameObjects.Graphics };
  private toast!: Phaser.GameObjects.Text;
  private toastUntil = 0;
  private buttons: { id: string; bg: Phaser.GameObjects.Rectangle; cost: Phaser.GameObjects.Text }[] = [];
  private overlay: Phaser.GameObjects.Container | null = null;

  private paused = false;
  private selected: string | null = null;
  private dragMode: 'queue' | 'cancel' | null = null;
  private lastDragCell = -1;
  private pressTimer: Phaser.Time.TimerEvent | null = null;
  private saveTimer = 0;
  /** Cell the scanner flagged on the last tap; a second tap there confirms digging it. */
  private confirmCell: string | null = null;
  /** Neighborhood shown around a touched clue (design/ONBOARDING.md §1.2). */
  private spotlight: { x: number; y: number; until: number } | null = null;
  private scanButton: Phaser.GameObjects.Text | null = null;
  private guide: TutorialGuide | null = null;
  private guideText: Phaser.GameObjects.Text | null = null;
  private lastCenterHit = -99;

  constructor() {
    super('game');
  }

  create(): void {
    const params = new URLSearchParams(location.search);
    const seedParam = Number(params.get('seed'));
    const saved = params.has('seed') || params.get('tutorial') === '1' ? null : loadState();
    const wantTutorial = params.get('tutorial') === '1' || (!saved && !params.has('seed') && params.get('tutorial') !== '0' && !tutorialDone());
    const assistParam = params.get('assist');
    const assist = (['full', 'scanner', 'off'] as const).find((m) => m === assistParam) as AssistMode | undefined;
    if (wantTutorial) this.guide = new TutorialGuide();
    this.world = this.guide
      ? this.guide.world
      : saved
        ? new World({ state: saved })
        : new World({ seed: seedParam || Math.floor(Math.random() * 1e9), assist });
    (window as unknown as { partShift: unknown }).partShift = { world: this.world, scene: this };

    const { width, height } = this.world.s;
    // The tutorial keeps a text box between the HUD and the board.
    const top = HUD_HEIGHT + (this.guide ? 130 : 0);
    const availW = VIEW.width - SIDE_MARGIN * 2;
    const availH = VIEW.height - top - BAR_HEIGHT;
    this.cs = Math.floor(Math.min(availW / width, availH / height));
    this.ox = Math.round((VIEW.width - this.cs * width) / 2);
    this.oy = top + Math.round((availH - this.cs * height) / 2);

    this.gfx = this.add.graphics();
    this.top = this.add.graphics().setDepth(5);
    this.createHud();
    this.createBuildBar();
    this.toast = this.add
      .text(VIEW.width / 2, VIEW.height - BAR_HEIGHT + 6, '', { fontFamily: 'sans-serif', fontSize: '22px', color: COLORS.text, align: 'center', wordWrap: { width: VIEW.width - 24 } })
      .setOrigin(0.5, 0)
      .setDepth(6);
    if (this.guide) this.createGuide();
    else this.say(this.world.started ? t('tutorial.dig') : t('place.command'), 6000);

    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);
    this.input.keyboard?.on('keydown-SPACE', () => this.setPaused(!this.paused));
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.selected) this.select(null);
      else this.world.apply({ type: 'cancelOrder' }, ME);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.save();
    });
  }

  update(_time: number, deltaMs: number): void {
    const w = this.world;
    if (!this.paused && w.s.outcome === 'playing') {
      w.tick(Math.min(deltaMs, 250) / 1000);
      this.saveTimer += deltaMs / 1000;
      if (this.saveTimer >= config.save.autosaveSeconds) {
        this.saveTimer = 0;
        this.save();
      }
    }
    for (const e of w.drainEvents()) {
      this.guide?.onEvent(e);
      this.onEvent(e);
    }
    if (this.guide?.update()) this.showGuideStep();
    if (this.time.now > this.toastUntil) this.toast.setText('');
    this.draw();
    this.updateHud();
  }

  // ------------------------------------------------------------- persistence

  private save(): void {
    try {
      if (!this.guide && this.world.started && this.world.s.outcome === 'playing') localStorage.setItem(SAVE_KEY, JSON.stringify(this.world.s));
    } catch {
      /* storage full or blocked: the run just isn't saved */
    }
  }

  private restart(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
    const url = new URL(location.href);
    url.searchParams.delete('seed');
    url.searchParams.delete('tutorial');
    location.href = url.toString();
  }

  // ------------------------------------------------------------------ events

  private onEvent(e: GameEvent): void {
    if (e.owner !== undefined && e.owner !== ME && e.owner >= 0) return;
    if (e.type === 'center_hit') {
      if (this.time.now - this.lastCenterHit > 6000) this.say(t('event.command_under_attack'));
      this.lastCenterHit = this.time.now;
    } else if (e.type === 'build_done' && e.x !== undefined) {
      const b = this.world.s.buildings.find((x) => x.x === e.x && x.y === e.y);
      if (b) this.say(t('build.done', { building: t(`building.${b.type}.name`) }));
    } else if (TOASTS[e.type]) {
      this.say(TOASTS[e.type](e));
    }
    if (e.type === 'cache_open' && e.x !== undefined) this.float(e.x, e.y!, `+${e.amount}`, COLORS.energy);
    if ((e.type === 'nest_open' || e.type === 'heavy_nest_open') && e.x !== undefined) this.explainNest(e.x, e.y!);
    if (e.type === 'victory' || e.type === 'defeat') this.showEnd(e.type === 'victory');
  }

  private createGuide(): void {
    this.guideText = this.add
      .text(VIEW.width / 2, HUD_HEIGHT - 4, '', {
        fontFamily: 'sans-serif',
        fontSize: '24px',
        color: '#0f1420',
        backgroundColor: '#ffd54f',
        align: 'center',
        padding: { x: 14, y: 10 },
        wordWrap: { width: VIEW.width - 40 },
      })
      .setOrigin(0.5, 0)
      .setDepth(8);
    const skip = this.add
      .text(SIDE_MARGIN + 4, 72, t('tutorial.skip'), { fontFamily: 'sans-serif', fontSize: '22px', color: COLORS.textDim, backgroundColor: '#1d263b', padding: { x: 10, y: 4 } })
      .setDepth(8)
      .setInteractive({ useHandCursor: true });
    skip.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      markTutorialDone();
      this.restart();
    });
    this.hud.people.setVisible(false);
    this.hud.threat.setVisible(false);
    this.hud.arc.setVisible(false);
    this.showGuideStep();
  }

  private showGuideStep(): void {
    const g = this.guide!;
    if (g.finished) {
      this.guideText?.setVisible(false);
      this.overlay?.destroy();
      this.overlay = this.panel(t('tutorial.final.title'), [t('tutorial.final.line1'), t('tutorial.final.line2'), t('tutorial.final.line3')], [
        { label: t('tutorial.final.go'), act: () => this.restart() },
      ]);
      return;
    }
    this.guideText?.setText(t(g.step!.text));
    const build = g.step!.highlightBuild ?? [];
    for (const b of this.buttons) b.bg.setStrokeStyle(build.includes(b.id) ? 4 : 2, build.includes(b.id) ? 0xffd54f : 0x3b4a6e);
  }

  /** Points at an opened clue that warned about the nest (design/ONBOARDING.md §1.4). */
  private explainNest(x: number, y: number): void {
    const w = this.world;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if ((dx || dy) && nx >= 0 && ny >= 0 && nx < w.s.width && ny < w.s.height) {
          const c = w.cell(nx, ny);
          if (c.revealed && c.content === 'ground' && c.building === undefined && w.clues(nx, ny).threat > 0) {
            this.spotlight = { x: nx, y: ny, until: this.time.now + 4000 };
            this.time.delayedCall(3600, () => this.say(t('cell.accidental_nest'), 4000));
            return;
          }
        }
      }
    }
  }

  private say(text: string, ms = 3500): void {
    this.toast.setText(text);
    this.toastUntil = this.time.now + ms;
  }

  private float(x: number, y: number, text: string, color: string): void {
    const p = this.toPx(x, y);
    const tx = this.add.text(p.x, p.y, text, { fontFamily: 'monospace', fontSize: '24px', fontStyle: 'bold', color }).setOrigin(0.5).setDepth(10);
    this.tweens.add({ targets: tx, y: p.y - 44, alpha: 0, duration: 1000, onComplete: () => tx.destroy() });
  }

  // --------------------------------------------------------------------- HUD

  private createHud(): void {
    const energy = this.add.text(SIDE_MARGIN + 4, 22, '', { fontFamily: 'monospace', fontSize: '40px', fontStyle: 'bold', color: COLORS.energy });
    const people = this.add.text(SIDE_MARGIN + 4, 72, '', { fontFamily: 'monospace', fontSize: '22px', color: COLORS.text });
    const threat = this.add.text(VIEW.width - 150, 72, '', { fontFamily: 'sans-serif', fontSize: '20px', color: COLORS.textDim }).setOrigin(0.5, 0);
    const arc = this.add.graphics();
    this.hud = { energy, people, threat, arc };
    const pause = this.add
      .text(VIEW.width - SIDE_MARGIN - 4, 22, 'II', { fontFamily: 'monospace', fontSize: '40px', fontStyle: 'bold', color: COLORS.text, backgroundColor: '#1d263b', padding: { x: 16, y: 4 } })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    pause.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      this.setPaused(!this.paused);
    });
    if (this.world.player(ME).assist.mode === 'scanner') {
      this.scanButton = this.add
        .text(VIEW.width - 250, 30, '', { fontFamily: 'sans-serif', fontSize: '24px', color: '#0f1420', backgroundColor: '#7ee0a1', padding: { x: 12, y: 8 } })
        .setOrigin(1, 0)
        .setInteractive({ useHandCursor: true });
      this.scanButton.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        if (!this.world.apply({ type: 'scan' }, ME).ok) this.say(t('assist.scan.empty'));
      });
    }
  }

  private updateHud(): void {
    const w = this.world;
    const mine = w.s.units.filter((u) => u.owner === ME);
    const slots = w.s.buildings.filter((b) => b.owner === ME && b.complete).reduce((n, b) => n + b.slots.length, 0);
    const residents = mine.filter((u) => u.kind === 'resident').length;
    const defenders = mine.filter((u) => u.kind === 'defender').length;
    this.hud.energy.setText(`⚡ ${Math.floor(w.player(ME).energy)}`);
    const secs = Math.floor(w.s.time);
    this.hud.people.setText(
      `👷 ${residents}/${slots}   🛡 ${defenders}/${w.defenderCapacity(ME)}   ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`,
    );
    this.hud.threat.setText(t('hud.threat.level', { level: w.threatLevel }));
    if (this.scanButton) {
      const a = w.player(ME).assist;
      this.scanButton.setText(t('assist.scan.charges', { count: a.charges })).setAlpha(a.charges > 0 || a.scanLeft > 0 ? 1 : 0.5);
    }
    // Big arc without digits: time until the next threat level.
    const g = this.hud.arc;
    const cx = VIEW.width - 150;
    const cy = 44;
    g.clear();
    g.lineStyle(8, 0x2a3550, 1);
    g.strokeCircle(cx, cy, 24);
    g.lineStyle(8, w.s.demon.awake ? 0xc77dff : 0xff7a3d, 1);
    g.beginPath();
    g.arc(cx, cy, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * w.threatProgress, false);
    g.strokePath();
  }

  private createBuildBar(): void {
    const top = VIEW.height - BAR_HEIGHT + 70;
    const n = BUILDABLE.length;
    const gap = 8;
    const bw = (VIEW.width - SIDE_MARGIN * 2 - gap * (n - 1)) / n;
    BUILDABLE.forEach((id, i) => {
      const x = SIDE_MARGIN + i * (bw + gap);
      const bg = this.add.rectangle(x, top, bw, 100, 0x1d263b).setOrigin(0, 0).setStrokeStyle(2, 0x3b4a6e).setInteractive({ useHandCursor: true });
      const style = BUILDING_STYLE[id];
      this.add.rectangle(x + bw / 2, top + 26, 34, 34, style.color).setOrigin(0.5);
      this.add.text(x + bw / 2, top + 26, style.label, { fontFamily: 'sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
      this.add
        .text(x + bw / 2, top + 54, t(`building.${id}.name`), { fontFamily: 'sans-serif', fontSize: '15px', color: COLORS.text, align: 'center', wordWrap: { width: bw - 6 } })
        .setOrigin(0.5, 0);
      const cost = this.add.text(x + bw - 6, top + 4, `${buildingDefs[id].cost}`, { fontFamily: 'monospace', fontSize: '16px', color: COLORS.energy }).setOrigin(1, 0);
      bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        this.select(this.selected === id ? null : id);
      });
      this.buttons.push({ id, bg, cost });
    });
  }

  private select(id: string | null): void {
    this.selected = id;
    for (const b of this.buttons) b.bg.setStrokeStyle(id === b.id ? 4 : 2, id === b.id ? 0x7ee0a1 : 0x3b4a6e);
    if (id) this.say(t(`building.${id}.desc`), 5000);
  }

  // ---------------------------------------------------------------- overlays

  private setPaused(on: boolean): void {
    if (this.world.s.outcome !== 'playing') return;
    this.paused = on;
    this.overlay?.destroy();
    this.overlay = null;
    if (!on) return;
    this.save();
    this.overlay = this.panel(t('pause.title'), [t('pause.hint')], [
      { label: t('pause.resume'), act: () => this.setPaused(false) },
      { label: t('pause.restart'), act: () => this.restart() },
    ]);
  }

  private showEnd(victory: boolean): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
    const w = this.world;
    const time = this.fmt(w.s.time);
    const lines = victory
      ? [t('win.text'), t('win.time', { time }), t('win.threat', { level: w.threatLevel }), t('win.nests', { count: w.player(ME).stats.nests }), t('win.caches', { count: w.player(ME).stats.caches })]
      : [t('lose.text')];
    if (victory) {
      let best = Infinity;
      try {
        best = Number(localStorage.getItem(BEST_KEY)) || Infinity;
        if (w.s.time < best) localStorage.setItem(BEST_KEY, String(w.s.time));
      } catch {
        /* ignore */
      }
      lines.push(w.s.time < best ? t('win.new_record') : t('win.best_time', { time: this.fmt(best) }));
    }
    this.overlay?.destroy();
    this.overlay = this.panel(victory ? t('win.title') : t('lose.title'), lines, [
      { label: victory ? t('win.again') : t('lose.again'), act: () => this.restart() },
    ]);
  }

  private fmt(seconds: number): string {
    const s = Math.floor(seconds);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  private panel(title: string, lines: string[], actions: { label: string; act: () => void }[]): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0).setDepth(20);
    const shade = this.add.rectangle(0, 0, VIEW.width, VIEW.height, 0x000000, 0.72).setOrigin(0).setInteractive();
    shade.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => ev.stopPropagation());
    c.add(shade);
    let y = 360;
    c.add(this.add.text(VIEW.width / 2, y, title, { fontFamily: 'sans-serif', fontSize: '44px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5, 0));
    y += 80;
    for (const line of lines) {
      const tx = this.add.text(VIEW.width / 2, y, line, { fontFamily: 'sans-serif', fontSize: '24px', color: COLORS.text, align: 'center', wordWrap: { width: VIEW.width - 80 } }).setOrigin(0.5, 0);
      c.add(tx);
      y += tx.height + 14;
    }
    y += 30;
    for (const a of actions) {
      const btn = this.add
        .text(VIEW.width / 2, y, a.label, { fontFamily: 'sans-serif', fontSize: '28px', color: '#0f1420', backgroundColor: '#7ee0a1', padding: { x: 28, y: 14 } })
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true });
      btn.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        a.act();
      });
      c.add(btn);
      y += 90;
    }
    return c;
  }

  // ----------------------------------------------------------------- drawing

  private toPx(x: number, y: number) {
    return { x: this.ox + (x + 0.5) * this.cs, y: this.oy + (y + 0.5) * this.cs };
  }

  private draw(): void {
    const w = this.world;
    const s = w.s;
    const g = this.gfx;
    const cs = this.cs;
    g.clear();
    const digging = new Map<string, number>();
    for (const u of s.units) if (u.task.type === 'dig' && u.path.length === 0) digging.set(cellKey(u.task.x, u.task.y), u.task.progress / config.dig.digSeconds);
    const showBuild = this.selected !== null;
    const known = w.started ? w.visibleKnowledge(ME) : new Map();

    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        const c = w.cell(x, y);
        const px = this.ox + x * cs;
        const py = this.oy + y * cs;
        const idx = y * s.width + x;
        if (!c.revealed) {
          this.setClues(idx, x, y, null);
          g.fillStyle(w.started && w.isFrontier(x, y) ? COLORS.frontier : COLORS.covered, 1);
          g.fillRoundedRect(px + 2, py + 2, cs - 4, cs - 4, 6);
          g.lineStyle(2, COLORS.coveredEdge, 1);
          g.strokeRoundedRect(px + 2, py + 2, cs - 4, cs - 4, 6);
          if (c.marked) {
            g.fillStyle(COLORS.marked, 1);
            g.fillTriangle(px + cs * 0.36, py + cs * 0.22, px + cs * 0.36, py + cs * 0.58, px + cs * 0.72, py + cs * 0.4);
            g.fillRect(px + cs * 0.33, py + cs * 0.22, 3, cs * 0.56);
          }
          const k = cellKey(x, y);
          const p = w.player(ME);
          if (p.queue.includes(k) || p.autoQueue.includes(k)) {
            g.lineStyle(3, p.queue.includes(k) ? COLORS.queued : COLORS.autoQueued, 1);
            g.strokeRoundedRect(px + 5, py + 5, cs - 10, cs - 10, 5);
          }
          const kn = known.get(k);
          if (kn) this.drawKnowledge(g, kn, px, py);
          const prog = digging.get(k);
          if (prog !== undefined) this.bar(g, px + 6, py + cs - 10, cs - 12, prog, COLORS.queued);
          continue;
        }
        const own = w.started && w.inTerritory(ME, x, y);
        g.fillStyle(own ? COLORS.territory : COLORS.opened, 1);
        g.fillRect(px + 1, py + 1, cs - 2, cs - 2);
        if (showBuild && w.canBuild(ME, this.selected!, x, y) === null) {
          g.lineStyle(3, COLORS.queued, 0.9);
          g.strokeRect(px + 3, py + 3, cs - 6, cs - 6);
        }
        this.drawContent(g, x, y, px, py);
        if (c.hot) {
          g.fillStyle(COLORS.hot, 0.25 + 0.35 * Math.min(1, c.hot));
          g.fillRect(px + 1, py + 1, cs - 2, cs - 2);
        }
        const clueCell = c.content === 'ground' || c.content === 'rubble' || c.content === 'energy_vein' || c.resolved;
        this.setClues(idx, x, y, clueCell && c.building === undefined ? w.clues(x, y) : null);
      }
    }
    this.drawBuildings(g);
    this.drawSpotlight(g);
    this.drawUnits();
  }

  private drawKnowledge(g: Phaser.GameObjects.Graphics, kn: string, px: number, py: number): void {
    const cs = this.cs;
    if (kn === 'safe') {
      g.lineStyle(4, COLORS.queued, 0.9);
      g.beginPath();
      g.moveTo(px + cs * 0.3, py + cs * 0.52);
      g.lineTo(px + cs * 0.45, py + cs * 0.66);
      g.lineTo(px + cs * 0.72, py + cs * 0.36);
      g.strokePath();
      return;
    }
    const color = kn === 'demon' ? 0xc77dff : 0xff5a5a;
    g.fillStyle(color, 0.85);
    g.fillCircle(px + cs / 2, py + cs / 2, cs * 0.2);
    g.lineStyle(3, color, 1);
    g.strokeCircle(px + cs / 2, py + cs / 2, cs * 0.32);
  }

  private drawSpotlight(g: Phaser.GameObjects.Graphics): void {
    if (this.guide) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 180);
      g.lineStyle(5, 0xffd54f, 0.4 + 0.6 * pulse);
      for (const f of this.guide.focusCells()) g.strokeRoundedRect(this.ox + f.x * this.cs + 2, this.oy + f.y * this.cs + 2, this.cs - 4, this.cs - 4, 8);
    }
    const sp = this.spotlight;
    if (!sp || this.time.now > sp.until) return;
    const cs = this.cs;
    g.lineStyle(4, 0xffffff, 0.9);
    g.strokeRect(this.ox + (sp.x - 1) * cs, this.oy + (sp.y - 1) * cs, cs * 3, cs * 3);
    g.fillStyle(0xffffff, 0.08);
    g.fillRect(this.ox + (sp.x - 1) * cs, this.oy + (sp.y - 1) * cs, cs * 3, cs * 3);
  }

  /** "Next to this block: 2 nests" with Russian plural forms. */
  private nearText(x: number, y: number): string {
    const cl = this.world.clues(x, y);
    const plural = (n: number) => {
      const m10 = n % 10;
      const m100 = n % 100;
      if (m10 === 1 && m100 !== 11) return 'one';
      if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'few';
      return 'many';
    };
    const lines: string[] = [];
    if (cl.threat) lines.push(t(`cell.near.threat.${plural(cl.threat)}`, { count: cl.threat }));
    if (cl.demon) lines.push(t('cell.near.demon.one', { count: cl.demon }));
    if (cl.finds) lines.push(t(`cell.near.finds.${plural(cl.finds)}`, { count: cl.finds }));
    return lines.length ? lines.join('\n') : t('cell.near.clear');
  }

  private bar(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, frac: number, color: number): void {
    g.fillStyle(COLORS.hpBack, 0.6);
    g.fillRect(x, y, width, 5);
    g.fillStyle(color, 1);
    g.fillRect(x, y, width * Math.max(0, Math.min(1, frac)), 5);
  }

  private drawContent(g: Phaser.GameObjects.Graphics, x: number, y: number, px: number, py: number): void {
    const c = this.world.cell(x, y);
    const cs = this.cs;
    const cx = px + cs / 2;
    const cy = py + cs / 2;
    switch (c.content) {
      case 'water':
        g.fillStyle(COLORS.water, 1);
        g.fillRect(px + 1, py + 1, cs - 2, cs - 2);
        break;
      case 'rubble':
        g.fillStyle(COLORS.rubble, 1);
        g.fillRect(px + cs * 0.2, py + cs * 0.45, cs * 0.25, cs * 0.3);
        g.fillRect(px + cs * 0.5, py + cs * 0.3, cs * 0.3, cs * 0.45);
        break;
      case 'energy_vein':
        g.fillStyle(COLORS.vein, 0.5 + 0.5 * ((c.stock ?? 0) / 120));
        for (const [dx, dy] of [[0.3, 0.3], [0.65, 0.4], [0.4, 0.7]]) g.fillCircle(px + cs * dx, py + cs * dy, cs * 0.09);
        break;
      case 'cache':
      case 'survivor':
        g.lineStyle(2, 0x5fd3ff, 0.4);
        g.strokeCircle(cx, cy, cs * 0.25);
        break;
      case 'nest':
      case 'heavy_nest':
      case 'demon_hatch': {
        const site = this.world.site(x, y);
        const dead = c.resolved || site?.destroyed;
        const color = c.content === 'demon_hatch' ? COLORS.demon : TECH_COLOR[c.tech ?? 'thermo'];
        g.fillStyle(color, dead ? 0.2 : 0.85);
        if (c.content === 'heavy_nest') g.fillRect(px + cs * 0.15, py + cs * 0.15, cs * 0.7, cs * 0.7);
        else g.fillCircle(cx, cy, cs * 0.36);
        g.lineStyle(3, 0x000000, 0.6);
        g.strokeCircle(cx, cy, cs * 0.18);
        if (site && !dead) this.bar(g, px + 4, py + 3, cs - 8, site.hp / site.maxHp, COLORS.hpBad);
        if (this.world.player(ME).order === `s:${x},${y}`) {
          g.lineStyle(3, 0xffffff, 0.9);
          g.strokeCircle(cx, cy, cs * 0.46);
        }
        break;
      }
    }
  }

  /** Up to three colored clue digits; a lone clue sits big in the middle. */
  private setClues(idx: number, x: number, y: number, clues: Record<(typeof CHANNELS)[number], number> | null): void {
    let texts = this.clueTexts.get(idx);
    if (!clues) {
      texts?.forEach((tx) => tx.setText(''));
      return;
    }
    if (!texts) {
      texts = CHANNELS.map((ch) =>
        this.add.text(0, 0, '', { fontFamily: 'monospace', fontStyle: 'bold', fontSize: '20px', color: CHANNEL_COLOR[ch] }).setOrigin(0.5).setDepth(2),
      );
      this.clueTexts.set(idx, texts);
    }
    const active = CHANNELS.filter((ch) => clues[ch] > 0);
    const p = this.toPx(x, y);
    CHANNELS.forEach((ch, i) => {
      const tx = texts![i];
      const n = clues[ch];
      const slot = active.indexOf(ch);
      if (n === 0) return void tx.setText('');
      tx.setText(String(n));
      if (active.length === 1) tx.setPosition(p.x, p.y).setFontSize(Math.round(this.cs * 0.55));
      else {
        const offs = active.length === 2 ? [-0.2, 0.2] : [-0.27, 0, 0.27];
        tx.setPosition(p.x + offs[slot] * this.cs, p.y).setFontSize(Math.round(this.cs * 0.4));
      }
    });
  }

  private drawBuildings(g: Phaser.GameObjects.Graphics): void {
    const s = this.world.s;
    const cs = this.cs;
    const alive = new Set<number>();
    for (const b of s.buildings) {
      alive.add(b.id);
      const def = buildingDefs[b.type];
      const style = BUILDING_STYLE[b.type];
      const px = this.ox + b.x * cs;
      const py = this.oy + b.y * cs;
      const mine = b.owner === ME;
      g.fillStyle(style.color, b.complete ? 1 : 0.35);
      g.fillRoundedRect(px + 4, py + 4, cs - 8, cs - 8, 6);
      if (!mine) {
        g.lineStyle(3, 0xff5a5a, 1);
        g.strokeRoundedRect(px + 4, py + 4, cs - 8, cs - 8, 6);
      }
      if (!b.complete) this.bar(g, px + 6, py + cs - 11, cs - 12, b.built / def.buildSeconds, COLORS.queued);
      else if (b.hp < def.hp) this.bar(g, px + 6, py + 2, cs - 12, b.hp / def.hp, b.hp / def.hp > 0.4 ? COLORS.hpGood : COLORS.hpBad);
      if (b.type === 'school' && !b.recruit) {
        g.fillStyle(0x888888, 1);
        g.fillCircle(px + cs - 10, py + 10, 5);
      }
      let label = this.labels.get(b.id);
      if (!label) {
        label = this.add
          .text(px + cs / 2, py + cs / 2, style.label, { fontFamily: 'sans-serif', fontSize: `${Math.round(cs * 0.36)}px`, fontStyle: 'bold', color: '#ffffff' })
          .setOrigin(0.5)
          .setDepth(3);
        this.labels.set(b.id, label);
      }
      label.setAlpha(b.complete ? 1 : 0.6);
    }
    for (const [id, label] of this.labels) {
      if (!alive.has(id)) {
        label.destroy();
        this.labels.delete(id);
      }
    }
  }

  private drawUnits(): void {
    const g = this.top;
    const s = this.world.s;
    const cs = this.cs;
    g.clear();
    for (const o of s.orbs) {
      const p = this.toPx(o.x, o.y);
      g.fillStyle(COLORS.orb, 1);
      g.fillCircle(p.x, p.y, 4 + Math.min(6, o.amount / 10));
    }
    const order = this.world.player(ME).order;
    for (const u of s.units) {
      const p = this.toPx(u.x, u.y);
      const st = this.world.stats(u);
      let r = cs * 0.17;
      let color = COLORS.resident;
      if (u.kind === 'defender') {
        r = cs * 0.22;
        color = COLORS.defender;
      } else if (u.kind === 'adaptant') {
        r = cs * 0.2;
        color = COLORS.enemy;
      } else if (u.kind === 'heavy_adaptant') {
        r = cs * 0.3;
        color = COLORS.enemy;
      } else if (u.kind === 'demon') {
        r = cs * 0.42;
        color = COLORS.demon;
      }
      if (u.owner >= 0 && u.owner !== ME) color = 0xff9f43;
      const bob = u.task.type === 'dig' || u.task.type === 'build' || u.task.type === 'harvest' ? Math.sin(this.time.now / 80 + u.id) * 2 : 0;
      g.fillStyle(0x000000, 0.35);
      g.fillEllipse(p.x, p.y + r * 0.9, r * 1.8, r * 0.6);
      g.fillStyle(color, 1);
      g.fillCircle(p.x, p.y + bob, r);
      // Trophy parts: one colored dot per slot.
      Object.values(u.parts).forEach((part, i) => {
        if (!part) return;
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        g.fillStyle(TECH_COLOR[part.id.split('_')[0]] ?? 0xffffff, 1);
        g.fillCircle(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, Math.max(3, r * 0.32));
      });
      if (u.hp < st.hp) this.bar(g, p.x - cs * 0.3, p.y - r - 9, cs * 0.6, u.hp / st.hp, u.owner < 0 ? COLORS.hpBad : COLORS.hpGood);
      if (order === `u:${u.id}`) {
        g.lineStyle(3, 0xffffff, 0.9);
        g.strokeCircle(p.x, p.y, r + 5);
      }
      if (u.blast?.phase === 'windup') this.drawWindup(g, u);
    }
  }

  private drawWindup(g: Phaser.GameObjects.Graphics, u: Unit): void {
    const b = u.blast!;
    const from = this.toPx(u.x, u.y);
    const to = this.toPx(u.x + b.dx * 3.25, u.y + b.dy * 3.25);
    g.lineStyle(this.cs * 0.5, COLORS.hot, 0.25 + 0.2 * Math.sin(this.time.now / 60));
    g.lineBetween(from.x, from.y, to.x, to.y);
  }

  // ------------------------------------------------------------------- input

  private cellOf(p: Phaser.Input.Pointer): { x: number; y: number } | null {
    const x = Math.floor((p.worldX - this.ox) / this.cs);
    const y = Math.floor((p.worldY - this.oy) / this.cs);
    return x >= 0 && y >= 0 && x < this.world.s.width && y < this.world.s.height ? { x, y } : null;
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.overlay && !this.paused) return;
    const at = this.cellOf(p);
    if (!at) return;
    const w = this.world;
    const { x, y } = at;
    if (!w.started) {
      if (w.apply({ type: 'placeCommand', x, y }, ME).ok && !this.guide) this.say(t('tutorial.dig'), 6000);
      return;
    }
    if (this.selected) {
      const r = w.apply({ type: 'build', building: this.selected, x, y }, ME);
      if (!r.ok) this.say(t(r.reason === 'invalid' ? 'build.invalid_cell' : r.reason));
      return;
    }
    const c = w.cell(x, y);
    if (p.rightButtonDown()) {
      if (w.isQueued(ME, x, y)) w.apply({ type: 'cancelDig', x, y }, ME);
      else w.apply({ type: 'toggleMark', x, y }, ME);
      return;
    }
    // Tap an enemy or an opened nest: all defenders attack it.
    const fx = (p.worldX - this.ox) / this.cs - 0.5;
    const fy = (p.worldY - this.oy) / this.cs - 0.5;
    const foe = w.s.units.find((u) => u.owner < 0 && Math.hypot(u.x - fx, u.y - fy) < 0.7);
    if (foe) {
      w.apply({ type: 'attack', target: `u:${foe.id}` }, ME);
      return;
    }
    const site = c.revealed ? w.site(x, y) : undefined;
    if (site && !site.destroyed) {
      if (w.apply({ type: 'attack', target: `s:${x},${y}` }, ME).ok) this.say(t('tutorial.attack'));
      return;
    }
    const b = w.building(c.building);
    if (b && b.owner === ME && b.type === 'school') {
      w.apply({ type: 'setRecruit', building: b.id, on: !b.recruit }, ME);
      this.say(t(b.recruit ? 'building.school.train_on' : 'building.school.train_off'));
      return;
    }
    if (c.revealed && w.player(ME).order && c.content === 'ground') w.apply({ type: 'cancelOrder' }, ME);
    // Touching an opened clue shows the eight cells it counts.
    if (c.revealed && c.building === undefined && (c.content === 'ground' || c.resolved)) {
      this.spotlight = { x, y, until: this.time.now + 2500 };
      this.say(this.nearText(x, y));
      if (w.clues(x, y).threat > 0) this.guide?.notify('clue_touched');
    }
    // Second tap on a cell the scanner knows is dangerous: dig it anyway.
    const k = cellKey(x, y);
    if (this.confirmCell === k) {
      this.confirmCell = null;
      if (w.apply({ type: 'queueDig', x, y, force: true }, ME).ok) this.guide?.notify('queued');
      return;
    }
    this.confirmCell = null;
    // Swiping over auto-queued cells promotes them to the player's own queue; only own orders get cancelled.
    const own = w.player(ME).queue.includes(k);
    const r = !c.revealed && !own ? w.apply({ type: 'queueDig', x, y }, ME) : null;
    if (r?.ok) this.guide?.notify('queued');
    if (r && !r.ok && r.reason === 'assist.known_danger') {
      this.confirmCell = k;
      this.say(t(w.visibleKnowledge(ME).get(k) === 'demon' ? 'cell.confirm_demon.hint' : 'cell.confirm_nest.hint'), 5000);
      return;
    }
    this.dragMode = r?.ok ? 'queue' : own ? 'cancel' : 'queue';
    this.lastDragCell = -1;
    this.applyDrag(x, y);
    const idx = y * w.s.width + x;
    this.pressTimer = this.time.delayedCall(LONG_PRESS_MS, () => {
      if (this.lastDragCell !== idx || !this.dragMode) return;
      if (this.dragMode === 'queue') w.apply({ type: 'cancelDig', x, y }, ME);
      w.apply({ type: 'toggleMark', x, y }, ME);
      this.dragMode = null;
    });
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!this.dragMode || !p.isDown) return;
    const at = this.cellOf(p);
    if (!at) return;
    this.applyDrag(at.x, at.y);
  }

  private onUp(): void {
    this.dragMode = null;
    this.pressTimer?.remove();
    this.pressTimer = null;
  }

  private applyDrag(x: number, y: number): void {
    const idx = y * this.world.s.width + x;
    if (idx === this.lastDragCell) return;
    if (this.lastDragCell !== -1) this.pressTimer?.remove();
    this.lastDragCell = idx;
    if (this.dragMode === 'queue' && this.world.apply({ type: 'queueDig', x, y }, ME).ok) this.guide?.notify('queued');
    else if (this.dragMode === 'cancel') this.world.apply({ type: 'cancelDig', x, y }, ME);
  }
}
