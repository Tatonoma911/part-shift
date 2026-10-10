import Phaser from 'phaser';
import { openAccountPanel } from '../account/panel';
import { BUILDABLE, boons, buildings as buildingDefs, config } from '../core/data';
import { cellKey } from '../core/grid';
import { World, type GameEvent } from '../core/world';
import { t } from '../i18n';
import { BUILDING_ANCHOR } from './assets';
import { sound } from './audio';
import { SoundDirector } from './soundDirector';
import { Voice } from './voice';
import { RunTally } from './meta/record';
import { showResults } from './meta/ResultsScreen';
import { boonPoolFor, loadMeta, pickAllies, roster } from './meta/store';
import { pickBoon } from './meta/BoonPick';
import { learning, openGuide, setLearningHooks } from './learn';
import { volumeHeight, volumeSliders } from './volume';
import { BoardView } from './BoardView';
import { Comm } from './Comm';
import { Cameras, UI_DEPTH } from './cameras';
import { EdgePointer } from './EdgePointer';
import { SidePanel } from './SidePanel';
import { clearSlot, loadSlot, saveSlot, touchSlot } from './saves';
import { BOARD, C, CELL, DOCK, GOAL, GUIDE, HUD, INK, LANDSCAPE, STEP, VIEW } from './layout';
import { markTutorialDone, TutorialGuide } from './Tutorial';
import { analytics } from '../analytics';
import { brackets, chip, plate, TXT } from './ui';
import { BuildDrawer, buildOptions, type BuildOption } from './BuildMenu';
import { buzz } from './comfort';
import { drawLamp, drawMark, type Channel } from './Sensor';
import { controlCall, RaidTimer, TempoMeter, type CallCard } from './Pulse';
import { techOf } from './Vitals';
import { armTechs } from './BoardView';
import eventsJson from '../data/design/events.json';
import { setBackHandler } from '../platform/native';
import type { PeerSession as OnlineSession } from '../net/peer';
import { challengeUrl, closeSocial, displayName, openBoard, openDonate, profile, rankOf, recordRun, resultCard, share, shouldNudge, socialOpen, type RecordedRun } from '../social';

const BEST_KEY = 'partshift.best.v1';
const LONG_PRESS_MS = 480;

type Mode = 'dig' | 'build';

/** What the menu asks for: a slot to continue or start fresh, or the tutorial. */
export interface GameStart {
  slot?: number;
  fresh?: boolean;
  tutorial?: boolean;
  seed?: number;
  /** Online match (src/net): the state comes from the server, no pause, no save slot. */
  online?: OnlineSession;
  /** City of the day (UTC day id): the run also counts on today's board. */
  daily?: string;
  /** Opened from a friend's "beat my score" link. */
  challenge?: { score: number; name: string };
  /** Heroes taken on this shift as allies; defaults to the last choice (meta allyChoice). */
  allies?: string[];
}
type Ev = Phaser.Types.Input.EventData;

/** «Строить» in the HUD, left of the threat ring: width, height, left edge from the HUD's right side. */
const BUILD_BTN = { w: 72, h: 84, right: 176 };

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
  // The card's own joke line under its name: the pick reads as a story beat, not a stat change.
  boon_taken: { text: (e) => `${t(`boon.${e.text}.name`)}. ${t(`boon.${e.text}.line`)}` },
  site_marked: { text: () => t('boon.nest_tracker.desc') },
  raid_incoming: { text: (e) => t(`event.raid_incoming.${plural(e.amount ?? 0)}`, { count: e.amount ?? 0 }), bad: true },
  survivor_joined: { text: () => t('event.survivor_slot') },
  hint: { text: (e) => t(e.text ?? '') },
  threat_level_up: { text: (e) => t('event.threat_rising', { level: e.amount ?? 0 }), bad: true },
  cache_open: { text: (e) => t('event.cache_reward', { energy: e.amount ?? 0 }) },
  nest_destroyed: { text: (e) => t('event.nest_destroyed', { energy: e.amount ?? 0 }) },
  building_lost: {
    // Hero stations come as `station.<hero>` (world.ts building_lost).
    text: (e) => {
      const [type, hero] = (e.text ?? '').split('.');
      return t('event.building_lost', { building: hero ? t('building.station.name', { hero: heroName(hero) }) : t(`building.${type}.name`) });
    },
    bad: true,
  },
  part_attached: { text: (e) => t('trophy.module_acquired', { part: t(`part.${e.text}.label`) }) },
  blueprint_found: { text: () => t('event.find.blueprint') },
  lore_found: { text: () => t('event.find.lore') },
  armor_crate_open: { text: (e) => (e.amount ? t('event.find.armor', { count: e.amount }) : t('event.find.armor_none')) },
  ally_limb_lost: { text: (e) => limbLine(e.text), bad: true },
  mine_armed: { text: () => t('event.mine.armed'), bad: true },
  mine_defused: { text: (e) => t('event.mine.defused', { energy: e.amount ?? 0 }) },
  mine_blast: { text: (e) => t('event.mine.blast', { element: t(`tech.${e.text}`) }), bad: true },
  bonus_opened: { text: (e) => (e.text === 'armor' && !e.amount ? t('event.bonus.armor_none') : t(`event.bonus.${e.text}`, { amount: e.amount ?? 0 })) },
  medkit_open: { text: () => t('event.medkit.open') },
  part_recycled: { text: (e) => t('part.recycled', { energy: e.amount ?? 0 }) },
  build_refused: { text: (e) => t(e.text ?? 'build.invalid_cell'), bad: true },
};

/** Knockout tore off a trophy or a limb (MVP_RULES §4.1а); event text is `hero:slot`. */
function limbLine(text = ''): string {
  const [hero, slot] = text.split(':');
  const kind = slot === 'arm' || slot === 'leg' ? slot : 'trophy';
  return t(`event.limb_lost.${kind}`, { hero: heroName(hero) });
}

/** Screen name of a hero (writer's text), e.g. «Килн». */
const FEMALE_HEROES = new Set(['seraph', 'frostline', 'canopy', 'beacon']);
/** «Течение» is grammatically neuter in Russian: «Течение вышло» (QA-034). */
const NEUTER_HEROES = new Set(['current']);

/** Russian plural form key: 1 → one, 2–4 → few, else many (English keys use the same names). */
function plural(n: number): 'one' | 'few' | 'many' {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'one';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'few';
  return 'many';
}

function heroName(id: string | undefined): string {
  return id ? t(`enemy.${id}.name`) : '';
}

/** Writer's line with {hero} in the hero's grammatical gender (`_female` / `_neuter` variants when they exist). */
function heroLine(key: string, id: string | undefined): string {
  const form = id && FEMALE_HEROES.has(id) ? '_female' : id && NEUTER_HEROES.has(id) ? '_neuter' : '';
  const line = form && t(`${key}${form}`, { hero: heroName(id) });
  return line && !line.startsWith(key) ? line : t(key, { hero: heroName(id) });
}

/** Контроль's calls (design/data/events.json, MVP_RULES §17.7). */
const EVENTS = eventsJson as unknown as { timeoutSeconds: number; timeoutChoice?: string; soloPause?: boolean; events: { id: string; a?: Record<string, unknown>; b?: Record<string, unknown> }[] };

/**
 * Pace fields the core may add (MVP_RULES §17): all optional, read defensively. Today the core has only
 * `raidAt` (game time of the next raid, §9.7); the raid timer counts down to it until `raid` arrives.
 */
type PaceState = {
  tempo?: { points: number; level: number; stagnant?: boolean };
  raid?: { nextIn: number; active?: boolean; techs?: string[]; callEarlyEnergy?: number; canCallEarly?: boolean };
  controlCall?: { id: string } | null;
  raidAt?: number;
  time: number;
};

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
  private edge!: EdgePointer;
  /** Wide screens only: shift summary in the right column (AR-06). */
  private side?: SidePanel;
  private cams!: Cameras;
  private start: GameStart = {};
  private slot = 1;
  private guide: TutorialGuide | null = null;
  /** Our player id: 0 offline, the server's seat online. */
  private me = 0;
  private online: OnlineSession | null = null;
  /** Online: our center fell, we watch the rest of the match. */
  private watching = false;
  /** Hero pop-up in the board's top-left corner (free play only). */
  private comm: Comm | null = null;
  private voice: Voice | null = null;
  /** This run's counters for the meta progress (Досье); not in the tutorial. */
  private tally: RunTally | null = null;
  /** The cache's pick-1-of-3 sheet while it is open (the run waits). */
  private boonUi: Phaser.GameObjects.Container | null = null;
  /** The end screen is up: a second victory/defeat call must not stack another one. */
  private ended = false;

  private mode: Mode = 'dig';
  private buildType: string = BUILDABLE[0];
  private ghost: { x: number; y: number } | null = null;
  private ghostButtons: Phaser.GameObjects.Container | null = null;
  private drawer!: BuildDrawer;
  private spotlight: { x: number; y: number; until: number } | null = null;
  /** Pace of the shift (Pulse.ts): «Темп», the raid timer, Контроль's call. */
  private tempo!: TempoMeter;
  private raidTimer!: RaidTimer;
  private call: { card: CallCard; id: string; at: number } | null = null;
  /** The core's call object we already answered: never reopened, even if the core keeps it for a frame. */
  private answeredCall: unknown = null;
  /** Building long-pressed: its zone is drawn bright while its name is up (BuildingFeel.ts). */
  private selected: { id: number; until: number } | null = null;
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
    buildBtn: Phaser.GameObjects.Container;
    buildBtnBg: Phaser.GameObjects.Graphics;
  };
  private shownEnergy = 0;
  /** Townsfolk who reached the command centre this shift (event `civilian_rescued`). */
  private rescued = 0;
  private dock!: {
    /** Context line instead of mode tabs: what a tap does now, and a cancel chip while placing. */
    head: { text: Phaser.GameObjects.Text; cancel: Phaser.GameObjects.Container };
    panes: Record<Mode, Phaser.GameObjects.Container>;
    queue: Phaser.GameObjects.Text;
    cards: { id: string; g: Phaser.GameObjects.Graphics; cost: Phaser.GameObjects.Text; x: number; y: number; w: number; h: number }[];
  };
  private toasts: Phaser.GameObjects.Container[] = [];
  private overlay: Phaser.GameObjects.Container | null = null;
  private guideBox: { text: Phaser.GameObjects.Text; dots: Phaser.GameObjects.Graphics; g: Phaser.GameObjects.Graphics; y: number; h: number } | null = null;

  private paused = false;
  private lastOrderSaid = -1e9;
  private lastSaid = { text: '', bad: false, at: -1e9, until: -1e9 };
  private music!: SoundDirector;
  /** The field guide or a coach card is open: the world waits, no pause sheet. */
  private overlayPaused = false;
  private coachedBuild = false;
  /** Until when the liberated land is lit after a tap outside it (Антон: say why you can't build there). */
  private territoryFlash = 0;
  /** Arrow to the nearest free liberated cell after a tap outside the territory (MVP_RULES §7.1). */
  private pointTo: { x: number; y: number; until: number } | null = null;
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
    this.online = this.start.online ?? null;
    this.me = this.online?.me ?? 0;
    this.watching = false;
    // Fresh state for scene restarts.
    this.guide = null;
    this.mode = 'dig';
    this.ghost = null;
    this.ghostButtons = null;
    this.spotlight = null;
    this.confirmCell = null;
    this.call = null;
    this.answeredCall = null;
    this.selected = null;
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
    const assist = ((['full', 'scanner', 'off'] as const).find((m) => m === assistParam) as ('full' | 'scanner' | 'off') | undefined) ?? 'off'; // v0.7 (MVP_RULES §3.1а): no auto checks, no scanner
    const saved = st.tutorial || st.fresh ? null : loadSlot(this.slot);
    if (st.tutorial) this.guide = new TutorialGuide();
    // Free play: residents dig only where the player sends them, nothing is queued for them at the start.
    // Caches offer 1 of 3 bonuses from the pool the player's HeroOut rank has opened (META.md §3, §8).
    const meta = loadMeta();
    const allies = (st.allies ?? meta.allyChoice).filter((id) => roster(meta).includes(id));
    const rules = { config: { 'dig.autoQueueZeroNeighbors': false }, boonPool: boonPoolFor(meta), allies };
    this.world = this.online?.world
      ? this.online.world
      : this.guide
        ? this.guide.world
        : saved
          ? new World({ state: saved })
          : new World({ seed: st.seed || Math.floor(Math.random() * 1e9), assist, rules });
    if (this.online) this.watchOnline(this.online);
    else if (!this.guide) {
      if (!saved) clearSlot(this.slot);
      touchSlot(this.slot);
    }
    (window as unknown as { partShift: unknown }).partShift = { world: this.world, scene: this, sound };
    this.shownEnergy = this.world.player(this.me).energy;
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
    this.board = new BoardView(this, this.world, bx, by, this.me);
    this.cams.setBounds(bx, by, bw, bh);
    // Online fields are bigger than the screen: start at the normal cell size over our own center.
    const home = this.online ? this.world.building(this.world.player(this.me).command) : undefined;
    if (home) this.cams.focus(bx + home.x * STEP + CELL / 2, by + home.y * STEP + CELL / 2, 1);
    this.edge = new EdgePointer(this, this.world, this.cams.board, (x, y) => this.board.center(x, y));
    this.side = LANDSCAPE && !this.guide ? new SidePanel(this, this.world, GUIDE.y, GUIDE.h + 20) : undefined;
    this.createZoomButtons();

    this.createHud();
    this.createDock();
    this.comm = this.guide ? null : new Comm(this);
    this.events.once('shutdown', () => this.comm?.destroy());
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
      else this.world.apply({ type: 'cancelOrder' }, this.me);
    });
    const onHide = () => {
      if (!document.hidden) return;
      // Leaving the tab or the app (home button, a call) pauses the run, which also saves it. Online time runs on.
      if (!this.paused && !this.online) this.setPaused(true);
      this.save();
    };
    document.addEventListener('visibilitychange', onHide);
    this.events.once('shutdown', () => document.removeEventListener('visibilitychange', onHide));
    setBackHandler(() => this.onBack());
    this.music = new SoundDirector(this.world, this.me);
    // The city's voice: Контроль, ads, hero bubbles (not in the tutorial, it has its own coach).
    this.voice = this.guide ? null : new Voice(this, this.world, this.me, (at) => this.board.speakerAt(at), () => this.toasts.some((b) => b.active));
    this.voice?.start(!saved);
    this.tally = this.guide ? null : new RunTally(this.me);
    this.ended = false;
    this.boonUi = null;
    this.music.start();
    this.setMode('dig');
    // The tutorial teaches by itself; coach cards and the guide come with free play.
    setLearningHooks({ pause: () => (this.overlayPaused = true), resume: () => (this.overlayPaused = false), busy: () => this.inFight() });
    this.events.once('shutdown', () => setLearningHooks(null));
  }

  update(time: number, deltaMs: number): void {
    const w = this.world;
    this.boonCheck();
    // Online there is no pause (MVP_RULES §14.2): menus and hints never stop the server's clock.
    if (this.online || (!this.paused && !this.overlayPaused && !this.callPauses() && w.s.outcome === 'playing')) {
      if (!this.coachedBuild && !this.guide && w.player(this.me).energy >= 100) this.coachedBuild = learning().coach('build') || this.coachedBuild;
      if (!this.guide) learning().tick();
      // Real elapsed time: Phaser smooths delta while the window is unfocused, which slowed the game (QA-015).
      w.tick(Math.min(this.game.loop.rawDelta || deltaMs, 250) / 1000);
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
    this.voice?.update();
    if (this.guide?.update()) this.showGuideStep();
    if (this.spotlight && time > this.spotlight.until) this.spotlight = null;
    if (this.pointTo && time > this.pointTo.until) this.pointTo = null;
    if (this.selected && time > this.selected.until) this.selected = null;
    // Elements our heroes hit with: their own element and the arms they wear (closed blocks of those elements glow).
    this.board.squadTechs = new Set(
      w.s.units
        .filter((u) => u.owner === this.me && u.hp > 0)
        .flatMap((u) => [...armTechs(u), ...(u.hero ? [techOf(u.hero)] : [])])
        .filter((x) => x !== 'kinetic'),
    );
    this.board.update(time, {
      selectedBuilding: this.selected?.id ?? null,
      // Liberated free land pulses while placing and when the tutorial asks for a building.
      buildType: (this.mode === 'build' || this.tutorialWantsBuild()) && w.started ? this.buildType : null,
      ghost: this.mode === 'build' ? this.ghost : null,
      showTerritory: time < this.territoryFlash,
      pointTo: this.pointTo,
      spotlight: this.spotlight,
      focus: this.guide?.focusCells() ?? [],
      showRisk: w.player(this.me).assist.mode === 'full',
    });
    this.edge.update(time);
    this.side?.update();
    this.updateHud(deltaMs);
    this.updateDock();
    this.cams.route();
  }

  // ------------------------------------------------------------- persistence

  private save(): void {
    if (!this.guide && !this.online && this.world.started && this.world.s.outcome === 'playing') {
      saveSlot(this.slot, this.world.s);
      touchSlot(this.slot);
    }
  }

  private restart(): void {
    if (this.world.s.outcome === 'playing') this.trackEnd('restart');
    if (!this.guide) clearSlot(this.slot);
    // No stop: the next run's music crossfades from this one.
    // The city of the day and a friend's challenge replay the same map; free play gets a new one.
    const st = this.start;
    this.scene.restart({ slot: this.slot, fresh: true, tutorial: st.tutorial, seed: st.daily || st.challenge ? this.world.s.seed : undefined, daily: st.daily, challenge: st.challenge });
  }

  private toMenu(): void {
    if (this.world.s.outcome === 'playing') analytics.track(this.guide ? 'tutorial_leave' : 'match_leave', this.matchParams());
    this.save();
    this.online?.leave();
    // The menu theme crossfades in over the run music.
    this.scene.start('menu');
  }

  /** + / − / reset over the board corner; the wheel, pinch and right-drag do the same. */
  private createZoomButtons(): void {
    const items: [string, () => void][] = [
      ['+', () => this.cams.zoomBy(1.3)],
      ['−', () => this.cams.zoomBy(1 / 1.3)],
      ['⟲', () => this.cams.reset()],
      // Field guide (Learning thread).
      ['?', () => openGuide()],
    ];
    // QA-019: in portrait the board fills the full width, so vertical buttons on the
    // right would cover board cells. Instead place them horizontally in the gap between
    // the board bottom and the dock.
    const btnW = LANDSCAPE ? 56 : 52;
    const btnH = LANDSCAPE ? 56 : 48;
    const totalW = items.length * (btnW + 4) - 4;
    items.forEach(([label, act], k) => {
      const x = LANDSCAPE
        ? BOARD.x + BOARD.w - 24 - btnW
        : Math.round(VIEW.width / 2 - totalW / 2) + k * (btnW + 4);
      const y = LANDSCAPE
        ? BOARD.y + 8 + k * 64
        : BOARD.y + BOARD.h + Math.round((DOCK.y - BOARD.y - BOARD.h - btnH) / 2);
      const g = this.add.graphics().setDepth(UI_DEPTH + 1).setAlpha(0.92);
      chip(g, x, y, btnW, btnH, C.graphite, 0.85, 10);
      const tx = this.add.text(x + btnW / 2, y + btnH / 2, label, TXT.num(26, INK.white)).setOrigin(0.5).setDepth(UI_DEPTH + 1);
      const hit = this.add.zone(x, y, btnW, btnH).setOrigin(0).setDepth(UI_DEPTH + 1).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', stop(act));
      if (this.guide) [g, tx, hit].forEach((o) => o.setVisible(false));
    });
  }

  // ------------------------------------------------------------------ events

  /** First-time coach cards (Learning thread): world events plus clue moments the world doesn't name. */
  /** A raid or an enemy on the attack: coach cards wait (FEEL_AUDIT F-08). */
  private inFight(): boolean {
    const s = this.world.s as typeof this.world.s & PaceState;
    return !!s.raid?.active || s.units.some((u) => u.owner === -1 && u.hp > 0 && u.target !== undefined);
  }

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
    if (this.online && (e.type === 'victory' || e.type === 'defeat')) return this.endOnline();
    if (this.online && e.type === 'building_lost' && e.owner === this.me && e.text === 'command') this.centerLost();
    if (e.owner !== undefined && e.owner !== this.me && e.owner >= 0) return;
    this.music.onEvent(e);
    this.voice?.onEvent(e);
    this.tally?.onEvent(e);
    if (!this.guide) this.coachOn(e);
    this.comm?.onEvent(e);
    if (e.type === 'center_hit') {
      if (this.time.now - this.lastCenterHit > 6000) this.say(t('event.command_under_attack'), 3000, true);
      this.lastCenterHit = this.time.now;
    } else if (e.type === 'build_done' && e.x !== undefined) {
      const b = this.world.s.buildings.find((x) => x.x === e.x && x.y === e.y);
      if (b) this.say(t('build.done', { building: b.hero ? t('building.station.name', { hero: heroName(b.hero) }) : t(`building.${b.type}.name`) }));
    } else if (TOASTS[e.type]) {
      this.say(TOASTS[e.type].text(e), 2800, TOASTS[e.type].bad);
    }
    if (e.type === 'build_place') this.nextTutorialBuilding();
    // However the center went down (tap, restore), the "place the Command Center" line gives way (AR-06).
    if (e.type === 'command_placed' && e.owner === this.me && !this.guide) this.say(t('tutorial.dig'), 5000);
    if (e.type === 'cache_open' && e.x !== undefined) this.float(e.x, e.y!, `+${e.amount}`);
    if (e.type === 'civilian_rescued' && e.owner === this.me) this.civilianRescued(e);
    if ((e.type === 'nest_open' || e.type === 'heavy_nest_open') && e.x !== undefined) this.explainNest(e.x, e.y!);
    if (e.type === 'victory' || e.type === 'defeat') this.showEnd(e.type === 'victory');
    // Наводка: point at the cell it marked.
    if (e.type === 'site_marked' && e.owner === this.me && e.x !== undefined) this.pointTo = { x: e.x, y: e.y!, until: this.time.now + 5000 };
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

  /** An opened cache waits for the pick: solo runs pause under the cards (boons.json rules.solo). */
  private boonCheck(): void {
    const offer = this.world.player(this.me).boonOffer;
    if (!offer || this.boonUi || this.world.s.outcome !== 'playing') return;
    const p = this.world.player(this.me);
    this.overlayPaused = true;
    this.boonUi = pickBoon(
      this,
      offer.ids.map((id) => ({ id, rare: boons[id]?.rarity === 'rare', stacks: p.boons?.[id] ?? 0 })),
      (id) => {
        this.world.apply({ type: 'pickBoon', id }, this.me);
        this.boonUi = null;
        this.overlayPaused = false;
      },
    );
  }

  /** Toast plate in the strip between the board and the dock; a new one replaces the old (UI_SPEC §2). */
  private say(text: string, ms = 2800, bad = false): void {
    // The same line again while it is up, or routine news over a fresh alarm, waits its turn (QA-035).
    const now = this.time.now;
    if (text === this.lastSaid.text && now < this.lastSaid.until) return;
    if (!bad && this.lastSaid.bad && now < this.lastSaid.at + 1500) return;
    this.lastSaid = { text, bad, at: now, until: now + ms };
    this.side?.note(text);
    const width = DOCK.w - 16;
    const tx = this.add.text(0, 0, text, { ...TXT.body(22, bad ? INK.white : INK.graphite, '600'), align: 'center', lineSpacing: 2, wordWrap: { width: width - 36 } }).setOrigin(0.5);
    const h = Math.max(58, tx.height + 20);
    const g = this.add.graphics();
    chip(g, -width / 2, -h / 2, width, h, bad ? C.coralInk : C.paper, 0.97, 14, bad ? undefined : { color: C.seam, width: 2 });
    // Toasts and Контроль share the strip above the dock, never the board (QA-038): the toast wins it.
    // In portrait the gap between board and dock is 100 px; clamp so a tall toast never overlaps the board.
    this.voice?.yieldToToast();
    const yIdeal = DOCK.y - 8 - h / 2;
    const y = LANDSCAPE ? yIdeal : Math.max(yIdeal, BOARD.y + BOARD.h + 4 + h / 2);
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

  /** A townsperson reached the centre: «+25» rises from it and the HUD counter bumps (§4.4). */
  private civilianRescued(e: GameEvent): void {
    this.rescued += 1;
    const cmd = this.world.s.buildings.find((b) => b.owner === this.me && b.type === 'command');
    const at = e.x !== undefined ? { x: e.x, y: e.y! } : cmd ? { x: cmd.x, y: cmd.y } : null;
    if (at) {
      const p = this.board.center(at.x, at.y);
      const pts = e.amount ?? 25;
      const tx = this.add.text(p.x, p.y - 20, `+${pts}`, { ...TXT.num(34, INK.teal), stroke: '#ffffff', strokeThickness: 7 }).setOrigin(0.5).setDepth(15).setScale(0.6);
      const sub = this.add.text(p.x, p.y + 12, t(`event.civilians_rescued.one`, { count: 1 }), { ...TXT.body(18, INK.graphite, '700'), stroke: '#ffffff', strokeThickness: 5 }).setOrigin(0.5).setDepth(15);
      this.tweens.add({ targets: tx, scale: 1, duration: 200, ease: 'Back.easeOut' });
      this.tweens.add({ targets: [tx, sub], y: '-=80', alpha: 0, delay: 500, duration: 1300, onComplete: () => (tx.destroy(), sub.destroy()) });
    }
    this.tweens.add({ targets: this.hud.squad, scale: 1.3, duration: 160, yoyo: true });
    sound.play('ui_tap');
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
    if ((g.step!.highlightBuild ?? []).length) this.nextTutorialBuilding();
    this.setMode(this.ghost ? 'build' : 'dig');
  }

  /** In a tutorial step that asks for buildings, preselect the first one not built yet. */
  private nextTutorialBuilding(): void {
    const want = this.guide?.step?.highlightBuild ?? [];
    const next = want.find((id) => !this.world.s.buildings.some((b) => b.owner === this.me && b.type === id));
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
    chip(g, px, midY - 42, 72, 84, C.graphite, 1, 14);
    this.add.image(px + 36, midY, 'icon.pause').setScale(1.5).setDepth(20).setTintFill(0xffffff);
    const pauseHit = this.add.zone(px, midY - 42, 72, 84).setOrigin(0).setDepth(20).setInteractive({ useHandCursor: true });
    pauseHit.on('pointerdown', stop(() => this.setPaused(!this.paused)));

    const stat = (x: number, label: string, icon: string, color: string) => {
      this.add.text(x, midY - 26, label.toUpperCase(), { ...TXT.caps(), ...(LANDSCAPE ? { fontSize: '14px', letterSpacing: 1.2 } : {}) }).setOrigin(0, 0.5).setDepth(20);
      this.add.image(x + 14, midY + 18, icon).setScale(1.25).setDepth(20);
      return this.add.text(x + 34, midY + 18, '', TXT.num(32, color)).setOrigin(0, 0.5).setDepth(20);
    };
    const energy = stat(px + 100, t('hud.label.energy'), 'icon.energy', INK.cobalt);
    // The landscape HUD is narrower: tighten the columns so the «Строить» button and the threat ring stay clear.
    // v0.7: no residents. Our heroes with their limit, and townsfolk brought to the centre (§4.4).
    const residents = stat(px + (LANDSCAPE ? 214 : 262), t('hud.label.heroes'), 'icon.shield', INK.graphite);
    const squad = stat(px + (LANDSCAPE ? 362 : 418), t('hud.label.rescued'), 'icon.resident', INK.teal);

    // «Строить» button: opens the building catalog (MVP_RULES, memory BUILD BUTTON).
    const bx = HUD.x + HUD.w - BUILD_BTN.right;
    const bw = BUILD_BTN.w;
    const bh = BUILD_BTN.h;
    const buildBtnBg = this.add.graphics().setDepth(20);
    chip(buildBtnBg, bx, midY - bh / 2, bw, bh, C.graphite, 1, 12);
    const buildIcon = this.add.image(bx + bw / 2, midY - 14, 'icon.build').setScale(1.4).setDepth(20).setTintFill(0xffffff);
    const buildBtnTx = this.add.text(bx + bw / 2, midY + 22, t('hud.mode_build'), TXT.body(15, INK.white, '700')).setOrigin(0.5).setDepth(20);
    const buildBtnHit = this.add.zone(bx, midY - bh / 2, bw, bh).setOrigin(0).setDepth(20).setInteractive({ useHandCursor: true });
    buildBtnHit.on('pointerdown', stop(() => {
      if (this.drawer.isOpen) this.closeCatalog();
      else this.openCatalog();
    }));
    const buildBtn = this.add.container(0, 0, [buildBtnBg, buildIcon, buildBtnTx, buildBtnHit]).setDepth(20);

    // Threat ring: empties over secondsPerLevel, then the level goes up (UI_SPEC §2.1).
    const rx = HUD.x + HUD.w - 54;
    const ring = this.add.graphics();
    const threat = this.add.text(0, 2, '', TXT.num(30, INK.white)).setOrigin(0.5);
    const ringBox = this.add.container(rx, midY, [ring, threat]).setDepth(20);

    // Goal row: «Темп» under Energy (MVP_RULES §17.1), the raid timer next to it (§17.4), the goal on the right.
    // Portrait: a little higher, so the label stays clear of the board camera (it starts at BOARD.y - 16) when zoomed in.
    this.tempo = new TempoMeter(this, HUD.x + 8, GOAL.y + (LANDSCAPE ? 4 : -4), LANDSCAPE ? 236 : 222, 20);
    this.raidTimer = new RaidTimer(this, HUD.x + (LANDSCAPE ? 256 : 240), GOAL.y, LANDSCAPE ? 236 : 226, 44, 21, () => this.callRaidEarly(), HUD.w - (LANDSCAPE ? 256 : 240));
    const goalBg = this.add.graphics().setDepth(20);
    const goal = this.add.text(HUD.x + HUD.w - 24, GOAL.y + 22, '', TXT.body(23, INK.white, '700')).setOrigin(1, 0.5).setDepth(20);
    this.hud = { energy, residents, squad, threat, ring, ringBox, goal, goalBg, buildBtn, buildBtnBg };
  }

  private updateHud(deltaMs: number): void {
    const w = this.world;
    const mine = w.s.units.filter((u) => u.owner === this.me);
    const allies = mine.filter((u) => u.kind === 'ally' || u.kind === 'hero').length;
    const slots = w.residentCap(this.me);
    // The counter rolls toward the real value so energy visibly "arrives".
    const real = Math.floor(w.player(this.me).energy);
    const diff = real - this.shownEnergy;
    this.shownEnergy = Math.abs(diff) < 1 ? real : this.shownEnergy + diff * Math.min(1, deltaMs / 120);
    this.hud.energy.setText(String(Math.round(this.shownEnergy)));
    this.hud.residents.setText(`${allies}/${slots}`);
    this.hud.squad.setText(String(this.rescued));

    const level = w.threatLevel;
    if (level > this.lastThreat) this.tweens.add({ targets: this.hud.ringBox, scale: 1.25, duration: 300, yoyo: true });
    this.lastThreat = level;
    const g = this.hud.ring;
    g.clear();
    const col = w.s.boss.awake ? C.violet : C.coral;
    g.fillStyle(col, 1);
    g.fillCircle(0, 0, 28);
    g.lineStyle(8, 0xdbe6ea, 1);
    g.strokeCircle(0, 0, 38);
    g.lineStyle(8, w.s.boss.awake ? C.violet : C.amber, 1);
    g.beginPath();
    g.arc(0, 0, 38, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.001, 1 - w.threatProgress), false);
    g.strokePath();
    this.hud.threat.setText(String(level));
    this.updatePace();

    let goal = t('mode.call.goal', { hero: heroName(w.s.boss.hero) });
    let bg = C.graphite;
    if (this.paused && !this.online) {
      goal = t('pause.plan_banner');
      bg = C.amber;
    } else if (w.s.boss.warned && !w.s.boss.awake && !w.s.boss.dead) {
      goal = t('event.boss_warning');
      bg = C.violet;
    }
    if (this.hud.goal.text !== goal) this.hud.goal.setText(goal);
    const gb = this.hud.goalBg;
    gb.clear();
    // «Первая смена» has no call target (boss off in tutorial_map): the chip only carries the pause banner.
    const showGoal = !this.guide || bg === C.amber;
    this.hud.goal.setVisible(showGoal);
    if (!showGoal) return;
    // The goal chip shares its row with «Темп» and the raid timer: long goals shrink.
    const room = HUD.w - (LANDSCAPE ? 504 : 478);
    this.hud.goal.setScale(this.hud.goal.width + 36 > room ? (room - 36) / this.hud.goal.width : 1);
    const gw = this.hud.goal.displayWidth + 36;
    chip(gb, HUD.x + HUD.w - 6 - gw, GOAL.y, gw, 44, bg, 1, 12);
  }

  /**
   * «Темп», raid timer and Контроль's call from the core (MVP_RULES §17). The core fields are optional
   * (see PaceState); without them the widgets show a calm default.
   */
  private updatePace(): void {
    const w = this.world;
    const s = w.s as typeof w.s & PaceState;
    const now = this.time.now;
    const steps = (config as unknown as { tempo?: { levels?: number[] } }).tempo?.levels ?? [0, 4, 9, 15];
    const tp = s.tempo ?? { points: 0, level: 0, stagnant: false };
    const lo = steps[tp.level] ?? 0;
    const hi = steps[tp.level + 1] ?? lo + 6;
    this.tempo.update(tp.level, tp.level >= 3 ? 1 : (tp.points - lo) / Math.max(1, hi - lo), !!tp.stagnant && !this.guide, now);
    // The raid: the core's `raid` when it has one, otherwise the countdown to `raidAt`. No raids on this map: no timer.
    const r = s.raid;
    const raw = r ? r.nextIn : s.raidAt !== undefined ? s.raidAt - s.time : null;
    const nextIn = raw !== null && Number.isFinite(raw) ? raw : null;
    this.raidTimer.setVisible(nextIn !== null && w.started);
    if (nextIn !== null) {
      const left = Math.max(0, nextIn);
      // Calling early needs the core's `callRaidEarly` command, announced by `raid.canCallEarly`.
      this.raidTimer.update(left, r?.callEarlyEnergy ?? Math.round(left * (1 + 0.1 * w.threatLevel)), r?.techs ?? [], !!r?.active, !!r && (r.canCallEarly ?? left > 0), now);
    }
    // Контроль calls: open the card when the core starts a call; solo waits for the answer, online keeps running.
    const pending = s.controlCall ?? null;
    if (pending && !this.call && pending !== this.answeredCall) this.openCall(pending.id, pending);
    if (this.call?.card.container.active) {
      this.call.card.update(now);
      const left = EVENTS.timeoutSeconds - (performance.now() - this.call.at) / 1000;
      if (left <= 0 && this.call.id) this.answerCall((EVENTS.timeoutChoice ?? 'b') as 'a' | 'b', true);
    }
  }

  private callPauses(): boolean {
    return !!this.call && !!this.call.id && !this.online && EVENTS.soloPause !== false;
  }

  /** Shows Контроль's call (texts call.<id>.*, effects events.json). */
  private openCall(id: string, from: unknown): void {
    this.answeredCall = from;
    const ev = EVENTS.events.find((e) => e.id === id);
    if (!ev) return;
    sound.play('event_call');
    const card = controlCall(
      this,
      { id, title: t(`call.${id}.title`), line: t(`call.${id}.line`), a: { label: t(`call.${id}.a`), effect: ev.a ?? {} }, b: { label: t(`call.${id}.b`), effect: ev.b ?? {} }, seconds: EVENTS.timeoutSeconds, coop: !!this.online },
      60,
      (c) => this.answerCall(c, false),
    );
    this.call = { card, id, at: performance.now() };
  }

  private answerCall(choice: 'a' | 'b', timeout: boolean): void {
    const call = this.call;
    if (!call || !call.id) return;
    const id = call.id;
    call.id = '';
    this.world.apply({ type: 'answerCall', id, choice } as never, this.me);
    call.card.result(timeout ? t('call.timeout') : t(`call.${id}.${choice}_result`));
    // The card fades out and destroys itself after the result line; stop updating it from that moment.
    call.card.container.once('destroy', () => {
      if (this.call === call) this.call = null;
    });
  }

  /** Second tap on the raid timer: the core starts the raid now and pays for the seconds saved. */
  private callRaidEarly(): void {
    const r = this.world.apply({ type: 'callRaidEarly' } as never, this.me);
    if (r.ok) this.say(t('raid.call_early_done'), 3200);
  }

  // -------------------------------------------------------------------- dock

  private createDock(): void {
    const g = this.add.graphics().setDepth(20);
    plate(g, DOCK.x, DOCK.y, DOCK.w, DOCK.h, 28);
    // No attack mode: residents fight on their own, a tap on a foe directs them (MVP_RULES §6).
    // No mode tabs (Антон 2026-10-09): a tap on a closed block digs, a tap on liberated land builds.
    // The top row of the dock says what a tap does right now.
    const pad = 22;
    const ty = DOCK.y + 22;
    const headText = this.add
      .text(DOCK.x + pad + 8, ty + 40, '', { ...TXT.body(23, INK.graphite, '600'), wordWrap: { width: DOCK.w - pad * 2 - 190 }, lineSpacing: 2 })
      .setOrigin(0, 0.5)
      .setDepth(20);
    const cg0 = this.add.graphics();
    chip(cg0, 0, 0, 170, 70, C.graphite, 1, 14);
    const ctx = this.add.text(85, 35, `✕ ${t('dock.cancel')}`, TXT.body(23, INK.white, '700')).setOrigin(0.5);
    const chit = this.add.zone(0, 0, 170, 70).setOrigin(0).setInteractive({ useHandCursor: true });
    chit.on('pointerdown', stop(() => this.setGhost(null)));
    const cancel = this.add.container(DOCK.x + DOCK.w - pad - 170, ty + 5, [cg0, ctx, chit]).setDepth(20);
    const divider = this.add.graphics().setDepth(20);
    divider.fillStyle(C.graphite, 0.08);
    divider.fillRect(DOCK.x + pad, ty + 88, DOCK.w - pad * 2, 2);

    const top = DOCK.y + 124;
    const inner = DOCK.w - pad * 2;
    // Dig: legend of the clue glyphs + queue chip (+ scan button).
    const dig = this.add.container(0, 0).setDepth(20);
    const lg = this.add.graphics();
    dig.add(lg);
    // Legend: the three sensor lamps and the player's own mark (MVP_RULES §3.1а).
    const legend: [string, Channel | 'mark'][] = [
      ['legend.threat', 'threat'],
      ['legend.finds', 'finds'],
      ['squad.target', 'demon'],
      ['cell.mark.danger', 'mark'],
    ];
    // «Первая смена» has no call target: no violet lamp in its legend.
    if (this.guide) legend.splice(2, 1);
    legend.forEach(([key, kind], k) => {
      const lx = DOCK.x + pad + 14 + (k % 2) * 200;
      const ly = top + 32 + Math.floor(k / 2) * 52;
      const ig = this.add.graphics().setPosition(lx, ly);
      if (kind === 'mark') drawMark(ig.setScale(0.6), 0, 0, 'danger');
      else drawLamp(ig.setScale(2), kind, -7, -5, 14, 10);
      dig.add(ig);
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
        const p = this.world.player(this.me);
        for (const k of [...p.queue]) {
          const [x, y] = k.split(',').map(Number);
          this.world.apply({ type: 'cancelDig', x, y }, this.me);
        }
      }),
    );
    dig.add([qg, queue, qx2, qhit]);

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
      const name = this.add.text(x + cw / 2, top + 98, id === 'station' ? t('building.station.label') : t(`building.${id}.name`), { ...TXT.body(16, INK.graphite, '600'), align: 'center', wordWrap: { width: cw - 10 } }).setOrigin(0.5, 0.5);
      const cost = this.add.text(x + cw / 2 + 10, top + 132, `${buildingDefs[id].cost}`, TXT.num(19, INK.cobalt)).setOrigin(0.5);
      const eicon = this.add.image(x + cw / 2 - cost.width / 2 - 4, top + 132, 'icon.energy');
      const hit = this.add.zone(x, top, cw, ch).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on(
        'pointerdown',
        stop(() => {
          this.buildType = id;
          // Switch the ghost on the chosen block to this building.
          if (this.ghost) this.setGhost(this.ghost);
          this.say(t(`building.${id}.desc`), 3500);
        }),
      );
      // How far this building frees land around it (buildings.json territoryRadius).
      const r = buildingDefs[id].territoryRadius ?? 0;
      build.add([cg, img, name, cost, eicon]);
      if (r > 0) build.add(this.add.text(x + cw - 8, top + 10, `⬚${r}`, { ...TXT.num(15, INK.teal) }).setOrigin(1, 0));
      build.add(hit);
      return { id, g: cg, cost, x, y: top, w: cw, h: ch };
    });

    this.dock = { head: { text: headText, cancel }, panes: { dig, build }, queue, cards };

    this.drawer = new BuildDrawer(this, DOCK, UI_DEPTH + 10, {
      pick: (o: BuildOption) => this.pickBuilding(o),
      close: () => this.closeCatalog(),
    });
  }

  /** 'build' switches the dock to the build catalog; 'dig' restores normal digging view. */
  private setMode(mode: Mode): void {
    if (mode === 'dig' && this.ghost) {
      this.ghost = null;
      this.ghostButtons?.destroy();
      this.ghostButtons = null;
    }
    this.mode = mode;
    if (mode === 'build' && !this.guide && !this.coachedBuild) this.coachedBuild = learning().coach('build');
    this.dock.head.cancel.setVisible(mode === 'build');
    this.dock.head.text.setText(t(mode === 'build' ? 'dock.build_here' : this.tutorialWantsBuild() ? 'dock.build_tutorial' : 'dock.hint'));
    for (const [m, pane] of Object.entries(this.dock.panes)) pane.setVisible(m === mode);
    // Build button highlights while the catalog is open.
    if (this.hud?.buildBtnBg) {
      this.hud.buildBtnBg.clear();
      chip(this.hud.buildBtnBg, HUD.x + HUD.w - BUILD_BTN.right, HUD.y + HUD.h / 2 - BUILD_BTN.h / 2, BUILD_BTN.w, BUILD_BTN.h, mode === 'build' ? C.cobalt : C.graphite, 1, 12);
    }
  }

  private tutorialWantsBuild(): boolean {
    return (this.guide?.step?.highlightBuild ?? []).length > 0;
  }

  private openCatalog(): void {
    const meta = loadMeta();
    const allies = this.start.allies ?? meta.allyChoice;
    const opts = buildOptions(this.world, meta, this.me, allies);
    const energy = this.world.player(this.me).energy;
    const selected = this.buildType ?? null;
    this.drawer.open(opts, energy, this.guide?.step?.highlightBuild ?? [], selected);
    // Highlight the build button while catalog is open.
    if (this.hud?.buildBtnBg) {
      this.hud.buildBtnBg.clear();
      chip(this.hud.buildBtnBg, HUD.x + HUD.w - 156, HUD.y + HUD.h / 2 - 40, 78, 80, C.cobalt, 1, 12);
    }
  }

  private closeCatalog(): void {
    this.drawer.close();
    if (this.hud?.buildBtnBg) {
      this.hud.buildBtnBg.clear();
      chip(this.hud.buildBtnBg, HUD.x + HUD.w - 156, HUD.y + HUD.h / 2 - 40, 78, 80, C.graphite, 1, 12);
    }
  }

  /** Called when the player picks a building from the catalog drawer. */
  private pickBuilding(o: BuildOption): void {
    this.buildType = o.id;
    this.closeCatalog();
    if (o.state !== 'ok' && o.state !== 'energy') return; // locked buildings can't be ghost-placed
    this.setMode('build');
    if (!this.guide && !this.coachedBuild) this.coachedBuild = learning().coach('build');
  }

  /** Tap on liberated land: show the ghost of the selected building there and the building cards. */
  private openBuild(x: number, y: number): void {
    const why = this.world.canBuild(this.me, this.buildType, x, y);
    // Not enough Energy still opens the cards (another building may fit the budget); other refusals explain themselves.
    if (why !== null && why !== 'build.not_enough_energy') {
      this.setGhost(null);
      this.say(t(why === 'invalid' ? 'build.invalid_cell' : why), 2800, true);
      return;
    }
    this.setGhost({ x, y });
  }

  /** Closest open, empty cell of our own land (for the arrow after a refused tap). */
  private nearestFreeLand(fx: number, fy: number): { x: number; y: number } | null {
    const w = this.world;
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (let y = 0; y < w.s.height; y++) {
      for (let x = 0; x < w.s.width; x++) {
        const c = w.cell(x, y);
        if (!c.revealed || c.content !== 'ground' || c.building !== undefined || !w.inTerritory(this.me, x, y)) continue;
        const d = (x - fx) ** 2 + (y - fy) ** 2;
        if (d < bestD) {
          bestD = d;
          best = { x, y };
        }
      }
    }
    return best;
  }

  private updateDock(): void {
    const w = this.world;
    const p = w.player(this.me);
    // Live-refresh the catalog drawer energy and states while it's open.
    if (this.drawer?.isOpen) {
      const meta = loadMeta();
      const allies = this.start.allies ?? meta.allyChoice;
      this.drawer.refresh(buildOptions(w, meta, this.me, allies), p.energy, this.guide?.step?.highlightBuild ?? []);
    }
    if (this.mode === 'dig') {
      this.dock.queue.setText(t('hud.queue', { count: p.queue.length + p.autoQueue.length }));
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
    // Tutorial: the context line blinks amber when the step asks for a building.
    if (this.mode === 'dig' && this.tutorialWantsBuild()) this.dock.head.text.setColor(Math.sin(this.time.now / 180) > 0 ? INK.amber : INK.graphite);
    else this.dock.head.text.setColor(INK.graphite);
  }

  // ------------------------------------------------------------ build ghost

  private setGhost(at: { x: number; y: number } | null): void {
    this.ghost = at;
    this.ghostButtons?.destroy();
    this.ghostButtons = null;
    this.setMode(at ? 'build' : 'dig');
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
          const r = this.world.apply({ type: 'build', building: this.buildType, x: at.x, y: at.y }, this.me);
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
    if (this.online) return this.onlineMenu(on);
    if (on !== this.paused) sound.play(on ? 'pause' : 'resume');
    this.paused = on;
    sound.duck(on);
    if (on) this.voice?.onPause();
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
            openGuide();
          },
        },
        { label: t('pause.account'), act: () => openAccountPanel() },
        { label: t('pause.restart'), act: () => this.confirmRestart() },
        { label: t('menu.quit_to_menu'), act: () => this.toMenu() },
      ],
      animate: false,
    });
  }

  /** «Начать смену заново» asks first: the current shift is lost (UI step 18, writer strings). */
  private confirmRestart(): void {
    this.overlay?.destroy();
    this.overlay = this.sheet({
      title: t('pause.restart'),
      lines: [t('pause.restart_confirm')],
      actions: [
        { label: t('common.no'), act: () => this.setPaused(true), primary: true },
        { label: t('common.yes'), act: () => this.restart() },
      ],
      animate: false,
    });
  }

  // ------------------------------------------------------------------ online

  private watchOnline(online: OnlineSession): void {
    const name = (id: number) => this.world.s.match?.names[id] ?? String(id + 1);
    online.on({
      presence: (connected) => {
        const was = this.onlinePresence;
        connected.forEach((c, id) => {
          if (id !== this.me && was[id] !== undefined && was[id] !== c) this.say(t(c ? 'online.player_back' : 'online.player_dropped', { name: name(id) }), 2800, !c);
        });
        this.onlinePresence = [...connected];
      },
      refused: (reason) => this.say(t(reason === 'invalid' ? 'build.invalid_cell' : reason), 2800, true),
      closed: () => {
        if (this.world.s.outcome !== 'playing') return;
        this.overlay?.destroy();
        this.overlay = this.sheet({
          title: t('online.error.closed'),
          lines: [],
          actions: [{ label: t('menu.quit_to_menu'), act: () => this.toMenu(), primary: true }],
        });
      },
    });
    this.onlinePresence = [...online.connected];
    this.events.once('shutdown', () => online.leave());
  }

  private onlinePresence: boolean[] = [];

  /** Online "pause": the same sheet, but the match keeps running behind it. */
  private onlineMenu(on: boolean): void {
    this.paused = on;
    this.overlay?.destroy();
    this.overlay = null;
    if (!on) return;
    const onOff = (v: boolean) => t(v ? 'settings.on' : 'settings.off');
    this.overlay = this.sheet({
      title: t('online.menu_title'),
      lines: [t('online.pause.hint')],
      actions: [
        { label: t('pause.resume'), act: () => this.setPaused(false), primary: true },
        {
          label: `${t('settings.sfx')}: ${onOff(sound.prefs.effects > 0)}`,
          act: () => {
            sound.setPrefs({ effects: sound.prefs.effects > 0 ? 0 : 0.8 });
            this.setPaused(true);
          },
        },
        {
          label: `${t('settings.music')}: ${onOff(sound.prefs.music > 0)}`,
          act: () => {
            sound.setPrefs({ music: sound.prefs.music > 0 ? 0 : 0.6 });
            this.setPaused(true);
          },
        },
        {
          label: t('menu.guide'),
          act: () => {
            this.setPaused(false);
            openGuide();
          },
        },
        { label: t('online.pause.leave'), act: () => this.toMenu() },
      ],
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

  /** Our center fell while others play on: FFA shows the loss at once, coop lets us watch the team. */
  private centerLost(): void {
    if (this.watching) return;
    this.watching = true;
    if (this.world.s.match?.mode === 'ffa') this.showOnlineEnd(false, false);
    else this.say(t('online.center_lost'), 6000, true);
  }

  private endOnline(): void {
    const s = this.world.s;
    const ffa = s.match?.mode === 'ffa';
    const won = s.outcome === 'victory' && (!ffa || s.match?.winner === this.me);
    sound.playEnd(won);
    this.showOnlineEnd(won, this.watching);
  }

  private showEnd(victory: boolean): void {
    if (this.ended) return;
    this.ended = true;
    this.trackEnd(victory ? 'victory' : 'defeat');
    if (!this.guide) clearSlot(this.slot);
    const w = this.world;
    const me = w.player(this.me);
    const lines = [victory ? t('win.text') : t('lose.text'), t('win.time', { time: this.fmt(w.s.time) }), t('win.threat', { level: w.threatLevel }), t('win.nests', { count: me.stats.nests }), t('win.caches', { count: me.stats.caches })];
    let badge: string | undefined = victory ? undefined : t('lose.badge');
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
    // Free play: "Итоги смены" with the meta progress (design/META.md §5); the tutorial keeps the plain sheet.
    if (this.tally) {
      const { view } = this.tally.commit(w, victory ? 'win' : 'lose');
      this.tally = null;
      this.overlay?.destroy();
      this.overlay = showResults(this, view, {
        again: () => this.restart(),
        dossier: () => {
          this.scene.start('dossier');
        },
        menu: () => this.toMenu(),
        takeNext: (id) => pickAllies(loadMeta(), [id]),
        extra: [
          ...(rec ? [{ label: t('end.share'), act: () => void this.shareShot() }, { label: t('end.board'), act: () => openBoard({ tab: this.start.daily ? 'day' : 'week' }) }] : []),
          { label: t('end.coffee'), act: () => openDonate(victory ? 'win' : 'lose') },
        ],
      });
      return;
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
      // Comic illustration when the artist's screen is in (style per layer); until then the Command Center sprite, grey on a loss.
      art: victory ? 'screen.screen_win' : 'screen.screen_lose',
      portrait: 'portrait.bld_command',
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

  private showOnlineEnd(victory: boolean, watch: boolean): void {
    const s = this.world.s;
    const ffa = s.match?.mode === 'ffa';
    const winner = s.match?.winner;
    const text = ffa ? (victory ? t('online.win.ffa') : winner != null ? t('online.lose.ffa', { name: s.match!.names[winner] }) : t('lose.text')) : victory ? t('win.text') : t('lose.text');
    this.overlay?.destroy();
    this.overlay = this.sheet({
      portrait: victory ? 'portrait.demon' : 'portrait.bld_command',
      grey: !victory,
      title: victory ? t('win.title') : t('lose.title'),
      lines: [watch ? t('online.center_lost') : text, t('win.time', { time: this.fmt(s.time) }), t('win.nests', { count: s.players[this.me].stats.nests })],
      actions: [
        ...(watch
          ? [
              {
                label: t('online.watch'),
                act: () => {
                  this.overlay?.destroy();
                  this.overlay = null;
                },
                primary: true,
              },
            ]
          : []),
        { label: t('menu.quit_to_menu'), act: () => this.toMenu(), primary: !watch },
      ],
    });
  }

  /**
   * Screenshot of the board as a vertical card (stories, Shorts) and the share sheet.
   * After a run the link challenges friends to beat the score on the same map.
   */
  private async shareShot(): Promise<void> {
    const w = this.world;
    const me = w.player(this.me);
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
    const p = w.player(this.me);
    return {
      mode: this.guide ? 'tutorial' : 'free',
      seconds: w.s.time,
      started: w.started ? 1 : 0,
      threat: w.threatLevel,
      nests: p.stats.nests,
      caches: p.stats.caches,
      buildings: w.s.buildings.filter((b) => b.owner === this.me).length,
      residents: w.s.units.filter((u) => u.owner === this.me && (u.kind === 'resident' || u.kind === 'ally')).length,
      heroes: p.stats.heroes.length,
      boss: w.s.boss.hero,
      ...(this.guide ? { step: this.guide.stepIndex } : {}),
    };
  }

  private trackStart(continued: boolean): void {
    analytics.where(this.guide ? 'tutorial' : 'match', () => this.matchParams());
    if (this.guide) analytics.track('tutorial_begin');
    else analytics.track('match_start', { slot: this.slot, continued, assist: this.world.player(this.me).assist.mode, seconds: this.world.s.time });
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
  private sheet(o: { title: string; lines: string[]; actions: { label: string; act: () => void; primary?: boolean; gold?: boolean; half?: boolean; ref?: (tx: Phaser.GameObjects.Text) => void }[]; badge?: string; art?: string; portrait?: string; grey?: boolean; animate?: boolean; extra?: { h: number; make: (x: number, y: number, w: number) => Phaser.GameObjects.GameObject[] } }): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0).setDepth(30);
    const shade = this.add.rectangle(0, 0, VIEW.width, VIEW.height, 0x0a1218, 0.55).setOrigin(0).setInteractive();
    shade.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => ev.stopPropagation());
    c.add(shade);
    // PC: a comic picture gets the left half and the sheet sits on the right, both centred (AR-12).
    const side = LANDSCAPE && !!o.art && this.textures.exists(o.art);
    const w = side ? Math.min(VIEW.width / 2 - 80, 640) : Math.min(VIEW.width - 56, 724);
    const x = side ? VIEW.width / 2 + (VIEW.width / 2 - w) / 2 - 20 : (VIEW.width - w) / 2;
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
    const top = side ? Math.max(30, (VIEW.height - h) / 2) : VIEW.height - h - 40;
    const bg = this.add.graphics();
    plate(bg, 0, 0, w, h, 30);
    const body = this.add.container(x, top, [bg, ...content]);
    // Picture above the sheet, never under its edge (ART_REVIEW AR-12).
    const room = Math.min(380, top - 40);
    if (o.art && this.textures.exists(o.art) && (side || room > 120)) {
      // Comic illustration: a framed panel with an ink border, like the intro comic.
      const cx = side ? VIEW.width / 4 + 20 : VIEW.width / 2;
      const bottom = side ? VIEW.height / 2 : top - 14;
      const img = this.add.image(cx, bottom, o.art).setOrigin(0.5, side ? 0.5 : 1);
      img.setScale(side ? Math.min((VIEW.width / 2 - 100) / img.width, (VIEW.height - 120) / img.height) : Math.min((w - 24) / img.width, room / img.height));
      const fw = img.displayWidth;
      const fh = img.displayHeight;
      const fx = cx - fw / 2;
      const fy = side ? bottom - fh / 2 : bottom - fh;
      const shadow = this.add.graphics();
      shadow.fillStyle(0x0b1117, 0.35);
      shadow.fillRect(fx + 6, fy + 8, fw, fh);
      const frame = this.add.graphics();
      frame.lineStyle(6, 0x10171c, 1);
      frame.strokeRect(fx, fy, fw, fh);
      c.add([shadow, img, frame]);
    } else if (o.portrait && this.textures.exists(o.portrait) && room > 80) {
      // Pixel sprite: whole-number scale only and no rotation, so pixels stay square.
      const img = this.add.image(VIEW.width / 2, top - 10, o.portrait).setOrigin(0.5, 1);
      img.setScale(Math.max(1, Math.min(3, Math.floor(Math.min(room - 20, 300) / img.height))));
      img.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      const shadow = this.add.ellipse(VIEW.width / 2, top - 12, img.displayWidth * 0.9, 22, 0x0b1117, 0.3);
      if (o.grey) {
        // Lost: drained of colour (WebGL), dimmed on canvas.
        img.preFX?.addColorMatrix().grayscale(0.85);
        img.setTint(0xa9b1b6);
      }
      c.add([shadow, img]);
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
    // One line in the sensor's words (§3.1а): «Рядом: 2 гнезда, убежище цели вызова, 1 находка».
    const list: string[] = [];
    if (cl.threat) list.push(t(`cell.sensor.nest.${plural(cl.threat)}`, { count: cl.threat }));
    if (cl.demon) list.push(t('cell.sensor.boss'));
    if (cl.finds) list.push(t(`cell.sensor.find.${plural(cl.finds)}`, { count: cl.finds }));
    return list.length ? t('cell.sensor', { list: list.join(', ') }) : t('cell.sensor.clear');
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.overlay || this.overlayPaused || !this.cams.inBoardView(p) || this.cams.busy) return;
    const wp = this.cams.worldAt(p);
    const at = this.board.cellAt(wp.x, wp.y);
    if (!at) return;
    const w = this.world;
    const { x, y } = at;
    if (!w.started) {
      if (w.apply({ type: 'placeCommand', x, y }, this.me).ok && !this.guide) this.say(t('tutorial.dig'), 5000);
      return;
    }
    if (this.mode === 'build') {
      const why = w.canBuild(this.me, this.buildType, x, y);
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
      if (w.apply({ type: 'attack', target: `u:${foe.id}` }, this.me).ok) this.orderSaid();
      return;
    }
    const site = c.revealed ? w.site(x, y) : undefined;
    if (site && !site.destroyed) {
      if (w.apply({ type: 'attack', target: `s:${x},${y}` }, this.me).ok) this.orderSaid();
      return;
    }
    // A tap that just missed a running enemy must not drop the order (QA-037): only a tap well away
    // from the target and from any enemy lifts it, and the player is told so.
    const order = w.player(this.me).order;
    if (c.revealed && order && c.content === 'ground') {
      const tp = w.targetPos(order) as { x: number; y: number } | undefined;
      const enemyNear = w.s.units.some((u) => u.owner < 0 && u.hp > 0 && Math.hypot(u.x - x, u.y - y) <= 2);
      if ((!tp || Math.hypot(tp.x - x, tp.y - y) > 2.5) && !enemyNear && w.apply({ type: 'cancelOrder' }, this.me).ok) {
        this.say(t('order.cancelled'));
        return;
      }
    }
    // Long press on an existing building: show name + desc (QA-009, UI_SPEC §4.4).
    if (c.revealed && c.building !== undefined) {
      const bid = c.building;
      this.pressTimer = this.time.delayedCall(LONG_PRESS_MS, () => {
        const b = this.world.s.buildings.find((bld) => bld.id === bid);
        if (!b) return;
        const nameKey = `building.${b.type}.name`;
        const descKey = b.complete ? `building.${b.type}.desc` : 'building.under_construction';
        this.say(`${t(nameKey)}\n${t(descKey)}`, 3500);
        this.selected = { id: b.id, until: this.time.now + 3500 };
        this.pressTimer = null;
      });
      return;
    }
    // Open land: liberated → build here; not liberated → say why and light the land that is.
    if (c.revealed && c.content === 'ground' && c.building === undefined && w.inTerritory(this.me, x, y) && !(this.guide && !this.tutorialWantsBuild())) {
      // A number first shows the eight cells it counts; the second tap on it builds (config.input.tapNumberCell).
      const cl = w.clues(x, y);
      const sp = this.spotlight;
      if ((cl.threat || cl.demon) && !this.ghost && !(sp && sp.x === x && sp.y === y)) {
        this.spotlight = { x, y, until: this.time.now + 3500 };
        this.say(`${this.nearText(x, y)}\n${t('build.tap_again')}`, 3500);
        if (cl.threat) this.guide?.notify('clue_touched');
        return;
      }
      this.spotlight = null;
      this.openBuild(x, y);
      return;
    }
    // Touching an opened clue shows the eight cells it counts.
    if (c.revealed && c.building === undefined && (c.content === 'ground' || c.resolved)) {
      this.spotlight = { x, y, until: this.time.now + 2500 };
      if (this.guide || c.content !== 'ground') this.say(this.nearText(x, y));
      else {
        this.setGhost(null);
        this.territoryFlash = this.time.now + 2600;
        const to = this.nearestFreeLand(x, y);
        this.pointTo = to ? { ...to, until: this.time.now + 3600 } : null;
        this.say(t('build.refuse.not_liberated'), 3600);
      }
      if (w.clues(x, y).threat > 0) this.guide?.notify('clue_touched');
    }
    // A tap on a closed block while placing: drop the building and dig instead.
    if (!c.revealed && this.ghost) this.setGhost(null);
    // Second tap on a cell the scanner knows is dangerous: dig it anyway.
    const k = cellKey(x, y);
    // Own mark (MVP_RULES §3.1а): the first tap asks, the second removes the mark and digs.
    if (!c.revealed && c.marked) {
      if (this.confirmCell === k) {
        this.confirmCell = null;
        // The core lifts the mark itself: under «Опасно» the heroes dig carefully and defuse a mine (MVP_RULES §5.2).
        if (w.apply({ type: 'queueDig', x, y, force: true }, this.me).ok) this.guide?.notify('queued');
        return;
      }
      this.confirmCell = k;
      this.say(t('cell.mark.confirm', { mark: t(`cell.mark.${c.markKind ?? 'danger'}`) }), 4000, true);
      return;
    }
    if (this.confirmCell === k) {
      this.confirmCell = null;
      if (w.apply({ type: 'queueDig', x, y, force: true }, this.me).ok) this.guide?.notify('queued');
      return;
    }
    this.confirmCell = null;
    // Swiping over auto-queued cells promotes them to the player's own queue; only own orders get cancelled.
    const own = w.player(this.me).queue.includes(k);
    const r = !c.revealed && !own ? w.apply({ type: 'queueDig', x, y }, this.me) : null;
    if (r?.ok) this.guide?.notify('queued');
    if (r && !r.ok && r.reason === 'assist.known_danger') {
      this.confirmCell = k;
      this.say(t(w.visibleKnowledge(this.me).get(k) === 'demon' ? 'cell.confirm_demon.hint' : 'cell.confirm_nest.hint'), 4000, true);
      return;
    }
    this.dragMode = r?.ok ? 'queue' : own ? 'cancel' : 'queue';
    this.lastDragCell = -1;
    this.applyDrag(x, y);
    const idx = y * w.s.width + x;
    this.pressTimer = this.time.delayedCall(LONG_PRESS_MS, () => {
      if (this.lastDragCell !== idx || !this.dragMode) return;
      if (this.dragMode === 'queue') w.apply({ type: 'cancelDig', x, y }, this.me);
      w.apply({ type: 'toggleMark', x, y }, this.me);
      const kind = w.cell(x, y).markKind;
      this.say(kind ? t(`cell.mark.${kind}`) : t('cell.mark.hint'), 1800);
      buzz(20);
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
      if (w.isQueued(this.me, rc.x, rc.y)) w.apply({ type: 'cancelDig', x: rc.x, y: rc.y }, this.me);
      else w.apply({ type: 'toggleMark', x: rc.x, y: rc.y }, this.me);
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
    if (this.dragMode === 'queue' && this.world.apply({ type: 'queueDig', x, y }, this.me).ok) this.guide?.notify('queued');
    else if (this.dragMode === 'cancel') this.world.apply({ type: 'cancelDig', x, y }, this.me);
  }
}
