import Phaser from 'phaser';
import { openAccountPanel } from '../account/panel';
import { BUILDABLE, buildings as buildingDefs, config } from '../core/data';
import { cellKey } from '../core/grid';
import type { AssistMode } from '../core/state';
import { World, type GameEvent } from '../core/world';
import { t } from '../i18n';
import { BUILDING_ANCHOR } from './assets';
import { sound } from './audio';
import { SoundDirector } from './soundDirector';
import { learning, setLearningHooks } from './learn';
import { volumeHeight, volumeSliders } from './volume';
import { BoardView } from './BoardView';
import { Cameras, UI_DEPTH } from './cameras';
import { clearSlot, loadSettings, loadSlot, saveSlot, touchSlot } from './saves';
import { BOARD, C, CELL, DOCK, GOAL, GUIDE, HUD, INK, LANDSCAPE, STEP, VIEW } from './layout';
import { markTutorialDone, TutorialGuide } from './Tutorial';
import { analytics } from '../analytics';
import { brackets, chip, glyph, plate, TXT } from './ui';
import { setBackHandler } from '../platform/native';
import { challengeUrl, closeSocial, displayName, openBoard, openDonate, profile, rankOf, recordRun, resultCard, share, shouldNudge, socialOpen, type RecordedRun } from '../social';

const BEST_KEY = 'partshift.best.v1';
const LONG_PRESS_MS = 480;
const ME = 0;

type Mode = 'dig' | 'build';

/** What the menu asks for: a slot to continue or start fresh, or the tutorial. */
export interface GameStart {
  slot?: number;
  fresh?: boolean;
  tutorial?: boolean;
  seed?: number;
  /** City of the day (UTC day id): the run also counts on today's board. */
  daily?: string;
  /** Opened from a friend's "beat my score" link. */
  challenge?: { score: number; name: string };
}
type Ev = Phaser.Types.Input.EventData;

/** Events that become a toast (writer's text keys); `bad` ones are coral. */
const TOASTS: Record<string, { text: (e: GameEvent) => string; bad?: boolean }> = {
  nest_open: { text: () => t('event.nest_opened'), bad: true },
  heavy_nest_open: { text: () => t('event.heavy_nest_opened'), bad: true },
  boss_awake: { text: (e) => heroLine('event.boss_awake', e.text), bad: true },
  boss_warning: { text: () => t('event.boss_warning'), bad: true },
  hero_warning: { text: () => t('event.hero_warning'), bad: true },
  hero_spawn: { text: (e) => (e.amount === 1 ? '' : heroLine('event.hero_appears', e.text)), bad: true },
  hero_defeated: { text: (e) => t('event.hero_defeated', { hero: heroName(e.text) }) },
  hero_part_taken: { text: (e) => t('trophy.module_acquired', { part: t(`part.${e.text}.label`) }) },
  demon_windup: { text: () => t('enemy.demon.windup'), bad: true },
  boss_dead: { text: () => t('event.boss_dead') },
  survivor_joined: { text: () => t('event.survivor_slot') },
  hint: { text: (e) => t(e.text ?? '') },
  threat_level_up: { text: (e) => t('event.threat_rising', { level: e.amount ?? 0 }), bad: true },
  cache_open: { text: (e) => t('event.cache_reward', { energy: e.amount ?? 0 }) },
  nest_destroyed: { text: (e) => t('event.nest_destroyed', { energy: e.amount ?? 0 }) },
  building_lost: { text: (e) => t('event.building_lost', { building: t(`building.${e.text}.name`) }), bad: true },
  part_attached: { text: (e) => t('trophy.module_acquired', { part: t(`part.${e.text}.label`) }) },
  part_recycled: { text: (e) => t('part.recycled', { energy: e.amount ?? 0 }) },
  build_refused: { text: (e) => t(e.text ?? 'build.invalid_cell'), bad: true },
};

/** Screen name of a hero (writer's text), e.g. «Килн». */
const FEMALE_HEROES = new Set(['seraph', 'frostline', 'canopy']);

function heroName(id: string | undefined): string {
  return id ? t(`enemy.${id}.name`) : '';
}

/** Writer's line with {hero}; heroines get the `_female` variant when the writer has one. */
function heroLine(key: string, id: string | undefined): string {
  const female = id && FEMALE_HEROES.has(id) && t(`${key}_female`, { hero: heroName(id) });
  return female && !female.startsWith(key) ? female : t(key, { hero: heroName(id) });
}

function stop(fn: () => void) {
  return (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => {
    ev.stopPropagation();
    sound.play('ui_tap');
    fn();
  };
}

/**
 * One shift: board from BoardView, HUD and dock in the PARTSHIFT brand style
 * (ui/BRAND_UI.md, ui/UI_SPEC.md). Rules live in core/World; this scene only
 * reads its state and turns touches into commands.
 */
export class GameScene extends Phaser.Scene {
  private world!: World;
  private board!: BoardView;
  private cams!: Cameras;
  private start: GameStart = {};
  private slot = 1;
  private guide: TutorialGuide | null = null;

  private mode: Mode = 'dig';
  private buildType: string = BUILDABLE[0];
  private ghost: { x: number; y: number } | null = null;
  private ghostButtons: Phaser.GameObjects.Container | null = null;
  private spotlight: { x: number; y: number; until: number } | null = null;
  /** Cell the scanner flagged on the last tap; a second tap there confirms digging it. */
  private confirmCell: string | null = null;

  private hud!: {
    energy: Phaser.GameObjects.Text;
    residents: Phaser.GameObjects.Text;
    squad: Phaser.GameObjects.Text;
    threat: Phaser.GameObjects.Text;
    ring: Phaser.GameObjects.Graphics;
    ringBox: Phaser.GameObjects.Container;
    goal: Phaser.GameObjects.Text;
    goalBg: Phaser.GameObjects.Graphics;
  };
  private shownEnergy = 0;
  private dock!: {
    tabs: { mode: Mode; g: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text; icon: Phaser.GameObjects.Image; x: number; w: number }[];
    panes: Record<Mode, Phaser.GameObjects.Container>;
    queue: Phaser.GameObjects.Text;
    scan: Phaser.GameObjects.Text | null;
    cards: { id: string; g: Phaser.GameObjects.Graphics; cost: Phaser.GameObjects.Text; x: number; y: number; w: number; h: number }[];
  };
  private toasts: Phaser.GameObjects.Container[] = [];
  private overlay: Phaser.GameObjects.Container | null = null;
  private guideBox: { text: Phaser.GameObjects.Text; dots: Phaser.GameObjects.Graphics; g: Phaser.GameObjects.Graphics; y: number; h: number } | null = null;

  private paused = false;
  private lastOrderSaid = -1e9;
  private music!: SoundDirector;
  /** The field guide or a coach card is open: the world waits, no pause sheet. */
  private overlayPaused = false;
  private coachedBuild = false;
  private rightClick: { x: number; y: number; px: number; py: number } | null = null;
  private dragMode: 'queue' | 'cancel' | null = null;
  private lastDragCell = -1;
  private pressTimer: Phaser.Time.TimerEvent | null = null;
  private saveTimer = 0;
  private lastCenterHit = -99;
  private lastThreat = 0;
  /** Last tutorial step reported to analytics. */
  private trackedStep = -1;
  /** Score of the run that just ended (for the share card). */
  private lastRun: RecordedRun | null = null;

  constructor() {
    super('game');
  }

  init(data: GameStart): void {
    this.start = data ?? {};
    this.slot = this.start.slot ?? 1;
    // Fresh state for scene restarts.
    this.guide = null;
    this.mode = 'dig';
    this.ghost = null;
    this.ghostButtons = null;
    this.spotlight = null;
    this.confirmCell = null;
    this.toasts = [];
    this.overlay = null;
    this.guideBox = null;
    this.paused = false;
    this.overlayPaused = false;
    this.coachedBuild = false;
    this.dragMode = null;
    this.saveTimer = 0;
    this.trackedStep = -1;
    this.lastRun = null;
  }

  create(): void {
    const st = this.start;
    const params = new URLSearchParams(location.search);
    const assistParam = params.get('assist');
    const assist = ((['full', 'scanner', 'off'] as const).find((m) => m === assistParam) as AssistMode | undefined) ?? loadSettings().assist;
    const saved = st.tutorial || st.fresh ? null : loadSlot(this.slot);
    if (st.tutorial) this.guide = new TutorialGuide();
    // Free play: residents dig only where the player sends them, nothing is queued for them at the start.
    const rules = { config: { 'dig.autoQueueZeroNeighbors': false } };
    this.world = this.guide
      ? this.guide.world
      : saved
        ? new World({ state: saved })
        : new World({ seed: st.seed || Math.floor(Math.random() * 1e9), assist, rules });
    if (!this.guide) {
      if (!saved) clearSlot(this.slot);
      touchSlot(this.slot);
    }
    (window as unknown as { partShift: unknown }).partShift = { world: this.world, scene: this, sound };
    this.shownEnergy = this.world.player(ME).energy;
    this.lastThreat = this.world.threatLevel;

    this.cams = new Cameras(this);
    this.drawBackground();
    // Smaller boards (the tutorial) sit at the bottom of the board area; the guide card takes the top.
    const bw = this.world.s.width * STEP - (STEP - CELL);
    const bh = this.world.s.height * STEP - (STEP - CELL);
    const bx = Math.round(BOARD.x + (BOARD.w - bw) / 2);
    const by = this.guide && !LANDSCAPE ? BOARD.y + BOARD.h - bh - 8 : Math.round(BOARD.y + (BOARD.h - bh) / 2);
    const frame = this.add.graphics().setDepth(0.5);
    brackets(frame, bx - 10, by - 10, bw + 20, bh + 20);
    this.board = new BoardView(this, this.world, bx, by);
    this.cams.setBounds(bx, by, bw, bh);
    this.createZoomButtons();

    this.createHud();
    this.createDock();
    this.trackStart(!!saved);
    if (this.guide) this.createGuide(by - 24);
    else if (st.challenge && !saved) this.say(`${t('challenge.banner', { name: st.challenge.name, score: st.challenge.score })}\n${t('place.command')}`, 7000);
    else if (!this.world.started) this.say(t('place.command'), 6000);

    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);
    this.input.keyboard?.on('keydown-SPACE', () => this.setPaused(!this.paused));
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.ghost) this.setGhost(null);
      else this.world.apply({ type: 'cancelOrder' }, ME);
    });
    this.input.keyboard?.on('keydown-ONE', () => this.setMode('dig'));
    this.input.keyboard?.on('keydown-TWO', () => this.setMode('build'));
    const onHide = () => {
      if (!document.hidden) return;
      // Leaving the tab or the app (home button, a call) pauses the run, which also saves it.
      if (!this.paused) this.setPaused(true);
      this.save();
    };
    document.addEventListener('visibilitychange', onHide);
    this.events.once('shutdown', () => document.removeEventListener('visibilitychange', onHide));
    setBackHandler(() => this.onBack());
    this.music = new SoundDirector(this.world, ME);
    this.music.start();
    this.setMode('dig');
    // The tutorial teaches by itself; coach cards and the guide come with free play.
    setLearningHooks({ pause: () => (this.overlayPaused = true), resume: () => (this.overlayPaused = false) });
    this.events.once('shutdown', () => setLearningHooks(null));
  }

  update(time: number, deltaMs: number): void {
    const w = this.world;
    if (!this.paused && !this.overlayPaused && w.s.outcome === 'playing') {
      if (!this.coachedBuild && !this.guide && w.player(ME).energy >= 100) this.coachedBuild = learning().coach('build') || this.coachedBuild;
      w.tick(Math.min(deltaMs, 250) / 1000);
      this.saveTimer += deltaMs / 1000;
      if (this.saveTimer >= config.save.autosaveSeconds) {
        this.saveTimer = 0;
        this.save();
      }
    }
    for (const e of w.drainEvents()) {
      this.guide?.onEvent(e);
      this.board.onEvent(e);
      this.onEvent(e);
    }
    this.music.tick();
    if (this.guide?.update()) this.showGuideStep();
    if (this.spotlight && time > this.spotlight.until) this.spotlight = null;
    this.board.update(time, {
      buildType: this.mode === 'build' && w.started ? this.buildType : null,
      ghost: this.mode === 'build' ? this.ghost : null,
      spotlight: this.spotlight,
      focus: this.guide?.focusCells() ?? [],
      showRisk: w.player(ME).assist.mode === 'full',
    });
    this.updateHud(deltaMs);
    this.updateDock();
    this.cams.route();
  }

  // ------------------------------------------------------------- persistence

  private save(): void {
    if (!this.guide && this.world.started && this.world.s.outcome === 'playing') {
      saveSlot(this.slot, this.world.s);
      touchSlot(this.slot);
    }
  }

  private restart(): void {
    if (this.world.s.outcome === 'playing') this.trackEnd('restart');
    if (!this.guide) clearSlot(this.slot);
    sound.stopMusic(0.2);
    // The city of the day and a friend's challenge replay the same map; free play gets a new one.
    const st = this.start;
    this.scene.restart({ slot: this.slot, fresh: true, tutorial: st.tutorial, seed: st.daily || st.challenge ? this.world.s.seed : undefined, daily: st.daily, challenge: st.challenge });
  }

  private toMenu(): void {
    if (this.world.s.outcome === 'playing') analytics.track(this.guide ? 'tutorial_leave' : 'match_leave', this.matchParams());
    this.save();
    sound.stopMusic(0.3);
    this.scene.start('menu');
  }

  /** + / − / reset over the board corner; the wheel, pinch and right-drag do the same. */
  private createZoomButtons(): void {
    const items: [string, () => void][] = [
      ['+', () => this.cams.zoomBy(1.3)],
      ['−', () => this.cams.zoomBy(1 / 1.3)],
      ['⟲', () => this.cams.reset()],
      // Field guide (Learning thread).
      ['?', () => learning().openGuide()],
    ];
    items.forEach(([label, act], k) => {
      const x = (LANDSCAPE ? BOARD.x + BOARD.w : VIEW.width) - 24 - 56;
      const y = BOARD.y + 8 + k * 64;
      const g = this.add.graphics().setDepth(UI_DEPTH + 1).setAlpha(0.92);
      chip(g, x, y, 56, 56, C.graphite, 0.85, 10);
      const tx = this.add.text(x + 28, y + 28, label, TXT.num(28, INK.white)).setOrigin(0.5).setDepth(UI_DEPTH + 1);
      const hit = this.add.zone(x, y, 56, 56).setOrigin(0).setDepth(UI_DEPTH + 1).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', stop(act));
      if (this.guide) [g, tx, hit].forEach((o) => o.setVisible(false));
    });
  }

  // ------------------------------------------------------------------ events

  /** First-time coach cards (Learning thread): world events plus clue moments the world doesn't name. */
  private coachOn(e: GameEvent): void {
    const l = learning();
    if (l.onGameEvent(e.type)) return;
    if (e.type === 'scan') l.coach('deduce');
    if (e.type === 'dig_done' && e.x !== undefined && e.y !== undefined) {
      const c = this.world.clues(e.x, e.y);
      if (c.threat > 0) l.coach('clue');
      else if (c.finds > 0) l.coach('finds');
    }
  }

  /** Confirms an attack order, at most every 2 s so repeated taps don't spam. */
  private orderSaid(): void {
    sound.play('ui_tap');
    if (this.time.now - this.lastOrderSaid < 2000) return;
    this.lastOrderSaid = this.time.now;
    this.say(t('order.attack'), 1800);
  }

  private onEvent(e: GameEvent): void {
    if (e.owner !== undefined && e.owner !== ME && e.owner >= 0) return;
    this.music.onEvent(e);
    if (!this.guide) this.coachOn(e);
    if (e.type === 'center_hit') {
      if (this.time.now - this.lastCenterHit > 6000) this.say(t('event.command_under_attack'), 3000, true);
      this.lastCenterHit = this.time.now;
    } else if (e.type === 'build_done' && e.x !== undefined) {
      const b = this.world.s.buildings.find((x) => x.x === e.x && x.y === e.y);
      if (b) this.say(t('build.done', { building: t(`building.${b.type}.name`) }));
    } else if (TOASTS[e.type]) {
      this.say(TOASTS[e.type].text(e), 2800, TOASTS[e.type].bad);
    }
    if (e.type === 'build_place') this.nextTutorialBuilding();
    if (e.type === 'cache_open' && e.x !== undefined) this.float(e.x, e.y!, `+${e.amount}`);
    if ((e.type === 'nest_open' || e.type === 'heavy_nest_open') && e.x !== undefined) this.explainNest(e.x, e.y!);
    if (e.type === 'victory' || e.type === 'defeat') this.showEnd(e.type === 'victory');
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
            this.time.delayedCall(3200, () => this.say(t('cell.accidental_nest'), 4000));
            return;
          }
        }
      }
    }
  }

  /** Toast plate in the strip between the board and the dock; a new one replaces the old (UI_SPEC §2). */
  private say(text: string, ms = 2800, bad = false): void {
    const width = DOCK.w - 16;
    const tx = this.add.text(0, 0, text, { ...TXT.body(22, bad ? INK.white : INK.graphite, '600'), align: 'center', lineSpacing: 2, wordWrap: { width: width - 36 } }).setOrigin(0.5);
    const h = Math.max(58, tx.height + 20);
    const g = this.add.graphics();
    chip(g, -width / 2, -h / 2, width, h, bad ? C.coralInk : C.paper, 0.97, 14, bad ? undefined : { color: C.seam, width: 2 });
    const y = DOCK.y - 8 - h / 2;
    const box = this.add.container(DOCK.x + DOCK.w / 2, y + 16, [g, tx]).setDepth(21).setAlpha(0);
    for (const old of this.toasts) this.tweens.add({ targets: old, alpha: 0, duration: 120, onComplete: () => old.destroy() });
    this.toasts = [box];
    this.tweens.add({ targets: box, y, alpha: 1, duration: 180 });
    this.time.delayedCall(ms, () => {
      if (!box.active) return;
      this.tweens.add({ targets: box, alpha: 0, duration: 200, onComplete: () => box.destroy() });
      this.toasts = this.toasts.filter((b) => b !== box);
    });
  }

  private float(x: number, y: number, text: string): void {
    const p = this.board.center(x, y);
    const tx = this.add.text(p.x, p.y, text, { ...TXT.num(28, INK.cobalt), stroke: '#ffffff', strokeThickness: 6 }).setOrigin(0.5).setDepth(15);
    this.tweens.add({ targets: tx, y: p.y - 70, alpha: 0, duration: 1200, onComplete: () => tx.destroy() });
  }

  // --------------------------------------------------------------- tutorial

  /** Tutorial card on the live board, above the (smaller) tutorial map. */
  private createGuide(bottom: number): void {
    // Portrait: above the tutorial map; landscape: in the right column under the HUD.
    const y = LANDSCAPE ? GUIDE.y : BOARD.y - 4;
    const h = LANDSCAPE ? GUIDE.h : Math.max(150, bottom - y);
    const g = this.add.graphics().setDepth(22);
    const text = this.add.text(GUIDE.x + GUIDE.w / 2, y + 60, '', { ...TXT.body(27, INK.graphite, '600'), align: 'center', lineSpacing: 6, wordWrap: { width: GUIDE.w - 80 } }).setOrigin(0.5, 0).setDepth(22);
    const dots = this.add.graphics().setDepth(22);
    const skip = this.add.text(GUIDE.x + GUIDE.w - 34, y + 30, t('tutorial.skip'), TXT.caps(INK.dim)).setOrigin(1, 0.5).setDepth(23).setInteractive({ useHandCursor: true });
    skip.on(
      'pointerdown',
      stop(() => {
        analytics.track('tutorial_skip', this.matchParams());
        markTutorialDone();
        this.toMenu();
      }),
    );
    this.guideBox = { text, dots, g, y, h };
    this.hud.ringBox.setVisible(this.world.threatLevel > 0 || this.world.s.rules?.threatEnabled !== false);
    this.showGuideStep();
  }

  private showGuideStep(): void {
    const g = this.guide!;
    const box = this.guideBox!;
    // stepIndex reaches stepCount when the tutorial is finished.
    if (g.stepIndex !== this.trackedStep) {
      this.trackedStep = g.stepIndex;
      if (g.finished) analytics.track('tutorial_complete', { seconds: this.world.s.time });
      else analytics.track('tutorial_step', { step: g.stepIndex, step_id: g.step!.id, seconds: this.world.s.time });
    }
    if (g.finished) {
      box.text.setVisible(false);
      box.g.clear();
      box.dots.clear();
      this.overlay?.destroy();
      this.overlay = this.sheet({
        badge: t('tutorial.progress', { n: g.stepCount, total: g.stepCount }),
        title: t('tutorial.final.title'),
        lines: [t('tutorial.final.line1'), t('tutorial.final.line2'), t('tutorial.final.line3')],
        actions: [
          { label: t('tutorial.final.go'), act: () => this.scene.start('game', { slot: 1, fresh: !loadSlot(1) }), primary: true },
          { label: t('menu.quit_to_menu'), act: () => this.toMenu() },
        ],
      });
      return;
    }
    box.text.setText(t(g.step!.text));
    const h = Math.min(box.h, box.text.height + 96);
    box.g.clear();
    plate(box.g, GUIDE.x, box.y, GUIDE.w, h, 22);
    box.g.fillStyle(C.amber, 1);
    box.g.fillRect(GUIDE.x + 22, box.y + 18, 6, h - 36);
    const d = box.dots;
    d.clear();
    const n = g.stepCount;
    for (let k = 0; k < n; k++) {
      d.fillStyle(k <= g.stepIndex ? C.teal : 0xc6d4d9, 1);
      d.fillCircle(GUIDE.x + 50 + k * 22, box.y + 30, k === g.stepIndex ? 7 : 5);
    }
    if ((g.step!.highlightBuild ?? []).length) {
      this.nextTutorialBuilding();
      this.setMode('build');
    }
  }

  /** In a tutorial step that asks for buildings, preselect the first one not built yet. */
  private nextTutorialBuilding(): void {
    const want = this.guide?.step?.highlightBuild ?? [];
    const next = want.find((id) => !this.world.s.buildings.some((b) => b.owner === ME && b.type === id));
    if (next) this.buildType = next;
  }

  // --------------------------------------------------------------------- HUD

  private drawBackground(): void {
    const g = this.add.graphics().setDepth(-1);
    g.fillGradientStyle(0xeaf5f8, 0xeaf5f8, C.sky2, C.sky2, 1);
    g.fillRect(0, 0, VIEW.width, VIEW.height);
    // Faint skyline of Lumen City behind the panels.
    g.fillStyle(0xbfd9e2, 0.55);
    let x = 0;
    let k = 0;
    while (x < VIEW.width) {
      const w = 40 + ((k * 37) % 50);
      const h = 120 + ((k * 71) % 160);
      g.fillRect(x, BOARD.y + BOARD.h - h + 60, w, h);
      x += w + 6;
      k++;
    }
  }

  private createHud(): void {
    const g = this.add.graphics().setDepth(20);
    plate(g, HUD.x, HUD.y, HUD.w, HUD.h, 24);
    const midY = HUD.y + HUD.h / 2;
    // Pause: dark square.
    const px = HUD.x + 18;
    chip(g, px, midY - 42, 84, 84, C.graphite, 1, 14);
    this.add.image(px + 42, midY, 'icon.pause').setScale(1.5).setDepth(20).setTintFill(0xffffff);
    const pauseHit = this.add.zone(px, midY - 42, 84, 84).setOrigin(0).setDepth(20).setInteractive({ useHandCursor: true });
    pauseHit.on('pointerdown', stop(() => this.setPaused(!this.paused)));

    const stat = (x: number, label: string, icon: string, color: string) => {
      this.add.text(x, midY - 26, label.toUpperCase(), { ...TXT.caps(), ...(LANDSCAPE ? { fontSize: '14px', letterSpacing: 1.2 } : {}) }).setOrigin(0, 0.5).setDepth(20);
      this.add.image(x + 14, midY + 18, icon).setScale(1.25).setDepth(20);
      return this.add.text(x + 34, midY + 18, '', TXT.num(36, color)).setOrigin(0, 0.5).setDepth(20);
    };
    const energy = stat(px + 112, t('hud.label.energy'), 'icon.energy', INK.cobalt);
    // The landscape HUD is narrower: tighten the columns so the threat ring stays clear.
    const residents = stat(px + (LANDSCAPE ? 244 : 300), t('hud.label.residents'), 'icon.resident', INK.graphite);
    const squad = stat(px + (LANDSCAPE ? 390 : 456), t('hud.label.squad'), 'icon.shield', INK.graphite);

    // Threat ring: empties over secondsPerLevel, then the level goes up (UI_SPEC §2.1).
    const rx = HUD.x + HUD.w - 66;
    const ring = this.add.graphics();
    const threat = this.add.text(0, 2, '', TXT.num(34, INK.white)).setOrigin(0.5);
    const ringBox = this.add.container(rx, midY, [ring, threat]).setDepth(20);

    // Goal line under the HUD.
    this.add.text(HUD.x + 8, GOAL.y + 22, t('hud.shift_label').toUpperCase(), TXT.caps()).setOrigin(0, 0.5).setDepth(20);
    const goalBg = this.add.graphics().setDepth(20);
    const goal = this.add.text(HUD.x + HUD.w - 24, GOAL.y + 22, '', TXT.body(23, INK.white, '700')).setOrigin(1, 0.5).setDepth(20);
    this.hud = { energy, residents, squad, threat, ring, ringBox, goal, goalBg };
  }

  private updateHud(deltaMs: number): void {
    const w = this.world;
    const mine = w.s.units.filter((u) => u.owner === ME);
    const residents = mine.filter((u) => u.kind === 'resident').length;
    // The counter rolls toward the real value so energy visibly "arrives".
    const real = Math.floor(w.player(ME).energy);
    const diff = real - this.shownEnergy;
    this.shownEnergy = Math.abs(diff) < 1 ? real : this.shownEnergy + diff * Math.min(1, deltaMs / 120);
    this.hud.energy.setText(String(Math.round(this.shownEnergy)));
    this.hud.residents.setText(`${residents}/${w.residentCap(ME)}`);
    // Shield = school training level of every resident (config.school).
    this.hud.squad.setText(`${w.trainingLevel(ME)}/${w.cfg.school.trainingLevelsMax}`);

    const level = w.threatLevel;
    if (level > this.lastThreat) this.tweens.add({ targets: this.hud.ringBox, scale: 1.25, duration: 300, yoyo: true });
    this.lastThreat = level;
    const g = this.hud.ring;
    g.clear();
    const col = w.s.boss.awake ? C.violet : C.coral;
    g.fillStyle(col, 1);
    g.fillCircle(0, 0, 30);
    g.lineStyle(9, 0xdbe6ea, 1);
    g.strokeCircle(0, 0, 42);
    g.lineStyle(9, w.s.boss.awake ? C.violet : C.amber, 1);
    g.beginPath();
    g.arc(0, 0, 42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.001, 1 - w.threatProgress), false);
    g.strokePath();
    this.hud.threat.setText(String(level));

    let goal = t('mode.call.goal', { hero: heroName(w.s.boss.hero) });
    let bg = C.graphite;
    if (this.paused) {
      goal = t('pause.plan_banner');
      bg = C.amber;
    } else if (w.s.boss.warned && !w.s.boss.awake && !w.s.boss.dead) {
      goal = t('event.boss_warning');
      bg = C.violet;
    }
    if (this.hud.goal.text !== goal) this.hud.goal.setText(goal);
    const gb = this.hud.goalBg;
    gb.clear();
    const gw = this.hud.goal.width + 36;
    chip(gb, HUD.x + HUD.w - 6 - gw, GOAL.y, gw, 44, bg, 1, 12);
  }

  // -------------------------------------------------------------------- dock

  private createDock(): void {
    const g = this.add.graphics().setDepth(20);
    plate(g, DOCK.x, DOCK.y, DOCK.w, DOCK.h, 28);
    // No attack mode: residents fight on their own, a tap on a foe directs them (MVP_RULES §6).
    const modes: Mode[] = ['dig', 'build'];
    const icons = { dig: 'icon.dig', build: 'icon.build' };
    const pad = 22;
    const gap = 10;
    const tw = (DOCK.w - pad * 2 - gap * (modes.length - 1)) / modes.length;
    const ty = DOCK.y + 22;
    const tabs = modes.map((mode, k) => {
      const x = DOCK.x + pad + k * (tw + gap);
      const tg = this.add.graphics().setDepth(20);
      const icon = this.add.image(x + 46, ty + 40, icons[mode]).setScale(1.25).setDepth(20);
      const label = this.add.text(x + 70, ty + 40, t(`hud.mode_${mode}`), TXT.body(26, INK.graphite, '700')).setOrigin(0, 0.5).setDepth(20);
      const hit = this.add.zone(x, ty, tw, 80).setOrigin(0).setDepth(20).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', stop(() => this.setMode(mode)));
      return { mode, g: tg, label, icon, x, w: tw };
    });

    const top = DOCK.y + 124;
    const inner = DOCK.w - pad * 2;
    // Dig: legend of the clue glyphs + queue chip (+ scan button).
    const dig = this.add.container(0, 0).setDepth(20);
    const lg = this.add.graphics();
    dig.add(lg);
    const legend: [string, 'threat' | 'finds' | 'demon' | 'safe', number][] = [
      ['legend.threat', 'threat', C.coralInk],
      ['legend.finds', 'finds', C.teal],
      ['legend.demon', 'demon', C.violet],
      ['legend.safe', 'safe', C.green],
    ];
    legend.forEach(([key, kind, color], k) => {
      const lx = DOCK.x + pad + 14 + (k % 2) * 200;
      const ly = top + 32 + Math.floor(k / 2) * 52;
      if (kind === 'safe') {
        lg.lineStyle(5, color, 1);
        lg.beginPath();
        lg.moveTo(lx - 9, ly);
        lg.lineTo(lx - 2, ly + 7);
        lg.lineTo(lx + 10, ly - 7);
        lg.strokePath();
      } else glyph(lg, kind, lx, ly, 9, color);
      dig.add(this.add.text(lx + 22, ly, t(key), TXT.body(23, INK.graphite, '500')).setOrigin(0, 0.5));
    });
    const qx = DOCK.x + DOCK.w - pad - 250;
    const qg = this.add.graphics();
    chip(qg, qx, top + 4, 250, 60, 0xd9f3f8, 1, 12);
    const queue = this.add.text(qx + 22, top + 34, '', TXT.body(23, INK.deep, '700')).setOrigin(0, 0.5);
    const qx2 = this.add.text(qx + 226, top + 34, '✕', TXT.body(26, INK.deep, '700')).setOrigin(1, 0.5);
    const qhit = this.add.zone(qx, top + 4, 250, 60).setOrigin(0).setInteractive({ useHandCursor: true });
    qhit.on(
      'pointerdown',
      stop(() => {
        const p = this.world.player(ME);
        for (const k of [...p.queue]) {
          const [x, y] = k.split(',').map(Number);
          this.world.apply({ type: 'cancelDig', x, y }, ME);
        }
      }),
    );
    dig.add([qg, queue, qx2, qhit]);
    let scan: Phaser.GameObjects.Text | null = null;
    if (this.world.player(ME).assist.mode === 'scanner') {
      const sg = this.add.graphics();
      chip(sg, qx, top + 78, 250, 66, C.teal, 1, 12);
      scan = this.add.text(qx + 125, top + 111, '', TXT.body(24, INK.white, '700')).setOrigin(0.5);
      const shit = this.add.zone(qx, top + 78, 250, 66).setOrigin(0).setInteractive({ useHandCursor: true });
      shit.on(
        'pointerdown',
        stop(() => {
          if (!this.world.apply({ type: 'scan' }, ME).ok) this.say(t('assist.scan.empty'));
        }),
      );
      dig.add([sg, scan, shit]);
    }

    // Build: five cards with the building sprites.
    const build = this.add.container(0, 0).setDepth(20);
    const cgap = 10;
    const cw = (inner - cgap * (BUILDABLE.length - 1)) / BUILDABLE.length;
    const ch = 150;
    const cards = BUILDABLE.map((id, k) => {
      const x = DOCK.x + pad + k * (cw + cgap);
      const cg = this.add.graphics();
      const a = BUILDING_ANCHOR[id] ?? [36, 78, 72, 96];
      const img = this.add.image(x + cw / 2, top + 66, `building.${id}`).setOrigin(0.5, a[1] / a[3]);
      img.setScale(Math.min(1, 74 / a[3]));
      const name = this.add.text(x + cw / 2, top + 98, t(`building.${id}.name`), { ...TXT.body(16, INK.graphite, '600'), align: 'center', wordWrap: { width: cw - 10 } }).setOrigin(0.5, 0.5);
      const cost = this.add.text(x + cw / 2 + 10, top + 132, `${buildingDefs[id].cost}`, TXT.num(19, INK.cobalt)).setOrigin(0.5);
      const eicon = this.add.image(x + cw / 2 - cost.width / 2 - 4, top + 132, 'icon.energy');
      const hit = this.add.zone(x, top, cw, ch).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on(
        'pointerdown',
        stop(() => {
          this.buildType = id;
          this.setGhost(null);
          this.say(t(`building.${id}.desc`), 3500);
        }),
      );
      build.add([cg, img, name, cost, eicon, hit]);
      return { id, g: cg, cost, x, y: top, w: cw, h: ch };
    });

    this.dock = { tabs, panes: { dig, build }, queue, scan, cards };
  }

  private setMode(mode: Mode): void {
    this.mode = mode;
    if (mode === 'build' && !this.guide && !this.coachedBuild) this.coachedBuild = learning().coach('build');
    if (mode !== 'build') this.setGhost(null);
    for (const tab of this.dock.tabs) {
      const on = tab.mode === mode;
      tab.g.clear();
      if (on) chip(tab.g, tab.x, DOCK.y + 22, tab.w, 80, C.graphite, 1, 14);
      else chip(tab.g, tab.x, DOCK.y + 22, tab.w, 80, C.graphite, 0.06, 14);
      tab.label.setColor(on ? INK.white : INK.graphite);
      if (on) tab.icon.setTintFill(0xffffff);
      else tab.icon.clearTint();
    }
    for (const [m, pane] of Object.entries(this.dock.panes)) pane.setVisible(m === mode);
  }

  private updateDock(): void {
    const w = this.world;
    const p = w.player(ME);
    if (this.mode === 'dig') {
      this.dock.queue.setText(t('hud.queue', { count: p.queue.length + p.autoQueue.length }));
      if (this.dock.scan) {
        const a = p.assist;
        this.dock.scan.setText(t('assist.scan.charges', { count: a.charges })).setAlpha(a.charges > 0 || a.scanLeft > 0 ? 1 : 0.5);
      }
    } else {
      const hl = this.guide?.step?.highlightBuild ?? [];
      const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 180);
      for (const c of this.dock.cards) {
        const sel = c.id === this.buildType;
        const afford = p.energy >= buildingDefs[c.id].cost;
        c.g.clear();
        chip(c.g, c.x, c.y, c.w, c.h, sel ? 0xd9f3f8 : C.white, afford ? 1 : 0.5, 12, {
          color: hl.includes(c.id) ? C.amber : sel ? C.seam : 0xc6d4d9,
          width: hl.includes(c.id) ? 4 + 2 * pulse : sel ? 4 : 2,
        });
        c.cost.setColor(afford ? INK.cobalt : INK.coral);
      }
    }
    // Tutorial: the Build tab blinks when the step asks for a building.
    const hl = (this.guide?.step?.highlightBuild ?? []).length > 0;
    const tab = this.dock.tabs[1];
    if (hl && this.mode !== 'build') {
      tab.g.clear();
      chip(tab.g, tab.x, DOCK.y + 22, tab.w, 80, C.amber, 0.4 + 0.4 * Math.sin(this.time.now / 180), 14);
    }
  }

  // ------------------------------------------------------------ build ghost

  private setGhost(at: { x: number; y: number } | null): void {
    this.ghost = at;
    this.ghostButtons?.destroy();
    this.ghostButtons = null;
    if (!at) return;
    const p = this.board.center(at.x, at.y);
    const y = Math.max(BOARD.y + 30, p.y - 110);
    const mk = (dx: number, dark: boolean, label: string, act: () => void) => {
      const g = this.add.graphics();
      chip(g, dx - 40, -40, 80, 80, dark ? C.graphite : C.white, 1, 12, dark ? undefined : { color: C.seam, width: 3 });
      const tx = this.add.text(dx, 0, label, TXT.num(34, dark ? INK.white : INK.graphite)).setOrigin(0.5);
      const hit = this.add.zone(dx - 40, -40, 80, 80).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', stop(act));
      return [g, tx, hit];
    };
    const x = Phaser.Math.Clamp(p.x, 110, VIEW.width - 110);
    this.ghostButtons = this.add
      .container(x, y, [
        ...mk(-48, true, '✓', () => {
          const r = this.world.apply({ type: 'build', building: this.buildType, x: at.x, y: at.y }, ME);
          if (!r.ok) this.say(t(r.reason === 'invalid' ? 'build.invalid_cell' : r.reason), 2800, true);
          this.setGhost(null);
        }),
        ...mk(48, false, '✕', () => this.setGhost(null)),
      ])
      .setDepth(13.5);
  }

  // ---------------------------------------------------------------- overlays

  /** Android back: drop the building ghost, else pause; on the pause menu or an end screen, back to the main menu. */
  private onBack(): boolean {
    // The field guide and coach cards are DOM overlays without a close hook yet: back waits for their own button.
    if (learning().isOpen) return true;
    if (socialOpen()) {
      closeSocial();
      return true;
    }
    if (this.ghost) {
      this.setGhost(null);
    } else if (this.overlay || this.paused || this.world.s.outcome !== 'playing') {
      this.toMenu();
    } else {
      this.setPaused(true);
    }
    return true;
  }

  private setPaused(on: boolean): void {
    if (this.world.s.outcome !== 'playing') return;
    if (on !== this.paused) sound.play(on ? 'pause' : 'resume');
    this.paused = on;
    sound.duck(on);
    this.overlay?.destroy();
    this.overlay = null;
    if (!on) return;
    this.save();
    this.overlay = this.sheet({
      title: t('pause.title'),
      lines: [t('pause.hint')],
      actions: [
        { label: t('pause.resume'), act: () => this.setPaused(false), primary: true },
        { label: t('pause.screenshot'), act: () => void this.shareShot(), half: true },
        { label: t('pause.coffee'), act: () => openDonate('pause'), half: true, gold: true },
        { label: t('settings.volume'), act: () => this.showVolume(), half: true },
        {
          half: true,
          label: t('menu.guide'),
          act: () => {
            this.setPaused(false);
            learning().openGuide();
          },
        },
        { label: t('pause.account'), act: () => openAccountPanel() },
        { label: t('pause.restart'), act: () => this.restart() },
        { label: t('menu.quit_to_menu'), act: () => this.toMenu() },
      ],
      animate: false,
    });
  }

  /** Volume sliders over the paused game; "Back" returns to the pause sheet. */
  private showVolume(): void {
    this.overlay?.destroy();
    this.overlay = this.sheet({
      title: t('settings.volume'),
      lines: [],
      extra: { h: volumeHeight() + 24, make: (x, y, w) => volumeSliders(this, x, y, w) },
      actions: [{ label: t('menu.back'), act: () => this.setPaused(true), primary: true }],
      animate: false,
    });
  }

  private showEnd(victory: boolean): void {
    this.trackEnd(victory ? 'victory' : 'defeat');
    if (!this.guide) clearSlot(this.slot);
    const w = this.world;
    const me = w.player(ME);
    const lines = [victory ? t('win.text') : t('lose.text'), t('win.time', { time: this.fmt(w.s.time) }), t('win.threat', { level: w.threatLevel }), t('win.nests', { count: me.stats.nests }), t('win.caches', { count: me.stats.caches })];
    let badge: string | undefined;
    if (victory) {
      let best = Infinity;
      try {
        best = Number(localStorage.getItem(BEST_KEY)) || Infinity;
        if (w.s.time < best) localStorage.setItem(BEST_KEY, String(w.s.time));
      } catch {
        /* ignore */
      }
      badge = w.s.time < best ? t('win.new_record') : t('win.best_time', { time: this.fmt(best) });
    }
    // Free play scores points for the world ranking; the tutorial doesn't.
    const rec = this.guide ? null : recordRun({ victory, seconds: w.s.time, nests: me.stats.nests, energy: me.stats.energy, heroes: me.stats.heroes.length, callTarget: w.s.boss.dead, difficulty: w.s.difficulty, threat: w.threatLevel, daily: this.start.daily });
    this.lastRun = rec;
    if (rec) {
      lines.splice(1, 0, t('end.score', { score: rec.score.toLocaleString('ru-RU') }));
      if (rec.rankAfter > rec.rankBefore) badge = t('social.rank.up', { rank: t(`social.rank.${rec.rankAfter}`) });
      const ch = this.start.challenge;
      if (ch) lines.splice(2, 0, t(rec.score > ch.score ? 'end.challenge_won' : 'end.challenge_lost', { name: ch.name, mine: rec.score, theirs: ch.score }));
      if (shouldNudge()) lines.push(t('donate.nudge'));
    }
    const boardBtn: { label: string; act: () => void; half: boolean; ref?: (tx: Phaser.GameObjects.Text) => void } = {
      label: t('end.board'),
      act: () => openBoard({ tab: this.start.daily ? 'day' : 'week' }),
      half: true,
      ref: (tx) =>
        void rec?.place.then((place) => {
          if (place && tx.active) tx.setText(t('end.board_place', { place }));
        }),
    };
    this.overlay?.destroy();
    this.overlay = this.sheet({
      portrait: victory && this.textures.exists(`portrait.${w.s.boss.hero}`) ? `portrait.${w.s.boss.hero}` : victory ? 'portrait.demon' : 'portrait.bld_command',
      grey: !victory,
      badge,
      title: victory ? t('win.title') : t('lose.title'),
      lines,
      actions: [
        { label: victory ? t('win.again') : t('lose.again'), act: () => this.restart(), primary: true },
        ...(rec ? [{ label: t('end.share'), act: () => void this.shareShot(), half: true }, boardBtn] : []),
        { label: t('end.coffee'), act: () => openDonate(victory ? 'win' : 'lose'), half: true, gold: true },
        { label: t('menu.quit_to_menu'), act: () => this.toMenu(), half: true },
      ],
    });
  }

  /**
   * Screenshot of the board as a vertical card (stories, Shorts) and the share sheet.
   * After a run the link challenges friends to beat the score on the same map.
   */
  private async shareShot(): Promise<void> {
    const w = this.world;
    const me = w.player(ME);
    // Hide the sheet for one frame so the card shows the city, not the menu.
    const ov = this.overlay;
    ov?.setVisible(false);
    const shot = await new Promise<HTMLImageElement | null>((res) => {
      this.game.renderer.snapshot((img) => res(img instanceof HTMLImageElement ? img : null));
    }).catch(() => null);
    ov?.setVisible(true);
    const rec = w.s.outcome === 'playing' ? null : this.lastRun;
    const name = displayName(t('social.default_name'));
    const card = await resultCard(shot, {
      kind: w.s.outcome === 'victory' ? 'win' : w.s.outcome === 'defeat' ? 'lose' : 'live',
      score: rec?.score,
      time: this.fmt(w.s.time),
      threat: w.threatLevel,
      nests: me.stats.nests,
      name,
      rank: t(`social.rank.${rankOf(profile().total)}`),
      tag: this.start.daily ? t('end.daily', { day: this.start.daily }) : undefined,
    }).catch(() => undefined);
    const url = rec && !this.guide ? challengeUrl(w.s.seed, rec.score, name) : undefined;
    void share({ from: rec ? 'result' : 'pause', text: rec ? t('share.result_text', { score: rec.score }) : t('share.invite_text'), url, image: card });
  }

  // -------------------------------------------------------------- analytics

  /** What every match event carries; also read when the player leaves the app mid-match. */
  private matchParams(): Record<string, string | number> {
    const w = this.world;
    const p = w.player(ME);
    return {
      mode: this.guide ? 'tutorial' : 'free',
      seconds: w.s.time,
      started: w.started ? 1 : 0,
      threat: w.threatLevel,
      nests: p.stats.nests,
      caches: p.stats.caches,
      buildings: w.s.buildings.filter((b) => b.owner === ME).length,
      residents: w.s.units.filter((u) => u.owner === ME && u.kind === 'resident').length,
      heroes: p.stats.heroes.length,
      boss: w.s.boss.hero,
      ...(this.guide ? { step: this.guide.stepIndex } : {}),
    };
  }

  private trackStart(continued: boolean): void {
    analytics.where(this.guide ? 'tutorial' : 'match', () => this.matchParams());
    if (this.guide) analytics.track('tutorial_begin');
    else analytics.track('match_start', { slot: this.slot, continued, assist: this.world.player(ME).assist.mode, seconds: this.world.s.time });
  }

  /** result: victory, defeat or restart (the player gave up and started over). */
  private trackEnd(result: string): void {
    analytics.track(this.guide ? 'tutorial_end' : 'match_end', { result, ...this.matchParams() });
  }

  private fmt(seconds: number): string {
    const s = Math.floor(seconds);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  /** Bottom sheet over the dimmed board (UI_SPEC §5). */
  private sheet(o: { title: string; lines: string[]; actions: { label: string; act: () => void; primary?: boolean; gold?: boolean; half?: boolean; ref?: (tx: Phaser.GameObjects.Text) => void }[]; badge?: string; portrait?: string; grey?: boolean; animate?: boolean; extra?: { h: number; make: (x: number, y: number, w: number) => Phaser.GameObjects.GameObject[] } }): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0).setDepth(30);
    const shade = this.add.rectangle(0, 0, VIEW.width, VIEW.height, 0x0a1218, 0.55).setOrigin(0).setInteractive();
    shade.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => ev.stopPropagation());
    c.add(shade);
    const w = Math.min(VIEW.width - 56, 724);
    const x = (VIEW.width - w) / 2;
    const content: Phaser.GameObjects.GameObject[] = [];
    let y = 56;
    if (o.badge) {
      const b = this.add.text(w / 2, y, o.badge.toUpperCase(), TXT.caps(INK.amber)).setOrigin(0.5, 0);
      content.push(b);
      y += 40;
    }
    const title = this.add.text(w / 2, y, o.title, { ...TXT.num(40, INK.graphite), align: 'center', wordWrap: { width: w - 80 } }).setOrigin(0.5, 0);
    content.push(title);
    y += title.height + 24;
    for (const line of o.lines) {
      const tx = this.add.text(w / 2, y, line, { ...TXT.body(25, INK.dim, '500'), align: 'center', wordWrap: { width: w - 90 } }).setOrigin(0.5, 0);
      content.push(tx);
      y += tx.height + 12;
    }
    y += 20;
    if (o.extra) {
      content.push(...o.extra.make(64, y, w - 128));
      y += o.extra.h;
    }
    // Half-width actions pair up side by side to keep the sheet short.
    let col = 0;
    for (const a of o.actions) {
      const half = !!a.half;
      if (!half && col) {
        col = 0;
        y += 112;
      }
      const bw = half ? (w - 96) / 2 : w - 80;
      const bx = half && col ? 56 + bw : 40;
      const bg = this.add.graphics();
      chip(bg, bx, y, bw, 96, a.gold ? C.amber : a.primary ? C.teal : C.graphite, a.primary || a.gold ? 1 : 0.1, 18);
      if (a.primary) {
        bg.fillStyle(C.graphite, 0.35);
        bg.fillRect(bx + 18, y + 90, bw - 36, 6);
      }
      const tx = this.add.text(bx + bw / 2, y + 48, a.label, TXT.body(half ? 25 : 29, a.primary ? INK.white : INK.graphite, '700')).setOrigin(0.5);
      if (tx.width > bw - 24) tx.setScale((bw - 24) / tx.width);
      a.ref?.(tx);
      const hit = this.add.zone(bx, y, bw, 96).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', stop(a.act));
      content.push(bg, tx, hit);
      if (half && !col) col = 1;
      else {
        col = 0;
        y += 112;
      }
    }
    if (col) y += 112;
    const h = y + 28;
    const top = VIEW.height - h - 40;
    const bg = this.add.graphics();
    plate(bg, 0, 0, w, h, 30);
    const body = this.add.container(x, top, [bg, ...content]);
    if (o.portrait && this.textures.exists(o.portrait)) {
      const img = this.add.image(VIEW.width / 2, top + 30, o.portrait).setOrigin(0.5, 1);
      img.setScale(Math.min(3, 300 / img.height));
      img.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      if (o.grey) img.setTint(0x9aa4aa).setAngle(-8);
      c.add(img);
    }
    c.add(body);
    if (o.animate !== false) {
      body.y += 60;
      body.alpha = 0;
      this.tweens.add({ targets: body, y: top, alpha: 1, duration: 260, ease: 'Cubic.out' });
    }
    return c;
  }

  // ------------------------------------------------------------------- input

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
    if (cl.demon) lines.push(t('cell.near.boss.one', { count: cl.demon }));
    if (cl.finds) lines.push(t(`cell.near.finds.${plural(cl.finds)}`, { count: cl.finds }));
    return lines.length ? lines.join('\n') : t('cell.near.clear');
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.overlay || this.overlayPaused || !this.cams.inBoardView(p) || this.cams.busy) return;
    const wp = this.cams.worldAt(p);
    const at = this.board.cellAt(wp.x, wp.y);
    if (!at) return;
    const w = this.world;
    const { x, y } = at;
    if (!w.started) {
      if (w.apply({ type: 'placeCommand', x, y }, ME).ok && !this.guide) this.say(t('tutorial.dig'), 5000);
      return;
    }
    if (this.mode === 'build') {
      const why = w.canBuild(ME, this.buildType, x, y);
      if (why === null) this.setGhost({ x, y });
      else {
        this.setGhost(null);
        this.say(t(why === 'invalid' ? 'build.invalid_cell' : why), 2800, true);
      }
      return;
    }
    const c = w.cell(x, y);
    if (p.rightButtonDown()) {
      // Right click cancels or marks; a right drag pans the view instead (see onUp).
      this.rightClick = { x, y, px: p.x, py: p.y };
      return;
    }
    if (p.middleButtonDown()) return;
    // Tap an enemy or an opened nest: all residents attack it (any mode).
    const foe = this.board.enemyAt(wp.x, wp.y);
    if (foe) {
      if (w.apply({ type: 'attack', target: `u:${foe.id}` }, ME).ok) this.orderSaid();
      return;
    }
    const site = c.revealed ? w.site(x, y) : undefined;
    if (site && !site.destroyed) {
      if (w.apply({ type: 'attack', target: `s:${x},${y}` }, ME).ok) this.orderSaid();
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
      this.say(t(w.visibleKnowledge(ME).get(k) === 'demon' ? 'cell.confirm_demon.hint' : 'cell.confirm_nest.hint'), 4000, true);
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
    if (this.cams.busy) {
      // A second finger turns the gesture into pinch/pan: stop queueing cells.
      this.dragMode = null;
      this.pressTimer?.remove();
      return;
    }
    if (!this.dragMode || !p.isDown) return;
    const wp = this.cams.worldAt(p);
    const at = this.board.cellAt(wp.x, wp.y);
    if (!at) return;
    this.applyDrag(at.x, at.y);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const rc = this.rightClick;
    this.rightClick = null;
    if (rc && Math.hypot(p.x - rc.px, p.y - rc.py) < 10) {
      const w = this.world;
      if (w.isQueued(ME, rc.x, rc.y)) w.apply({ type: 'cancelDig', x: rc.x, y: rc.y }, ME);
      else w.apply({ type: 'toggleMark', x: rc.x, y: rc.y }, ME);
    }
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
