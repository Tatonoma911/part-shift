import Phaser from 'phaser';
import { account } from '../account/cloud';
import { openAccountPanel } from '../account/panel';
import { config } from '../core/data';
import { lang, setLang, t } from '../i18n';
import { introSeen, playIntro } from '../intro';
import { analytics, askAnalyticsConsent, closeConsent } from '../analytics';
import { canVibrate, comfort, PALETTES, setComfort, TEXT_SCALES } from './comfort';
import { learning, learningLang, openGuide, setLearningHooks } from './learn';
import { volumeHeight, volumeSliders } from './volume';
import { createArt, preloadArt } from './assets';
import { preloadComm } from './Comm';
import { sound } from './audio';
import type { GameStart } from './GameScene';
import { C, INK, LANDSCAPE, VIEW } from './layout';
import { menuIcon, type MenuIconId } from './menuIcons';
import { preloadMetaArt } from './meta/art';
import { bestStars, modeIcon, type ModeId } from './meta/Awards';
import { loadMeta, pickAllies, rollDistrict } from './meta/store';
import { shiftBrief } from './meta/ShiftBrief';
import { metaPreview } from './meta/preview';
import { clearSlot, lastSlot, loadSettings, loadSlot, saveSettings, SLOTS } from './saves';
import { tutorialDone } from './Tutorial';
import { getFirstUncleared } from './campaign';
import { setBackHandler } from '../platform/native';
import { closeOnlineScreen, openOnlineScreen, onlineScreenOpen } from '../net/lobby';
// P2P is always available (no server required)
const onlineAvailable = () => true;
import { chip, plate, TXT } from './ui';
import { drawMenuBackdrop, drawMenuHeroes } from './MenuBackdrop';
import { resetDialog } from './ResetProgress';
import { universeButton } from './UniverseScene';
import { dailySeed, dayId, heroOfWeek, invite, openBoard, openDonate, openFeedback, readChallenge } from '../social';

type Ev = Phaser.Types.Input.EventData;
type Page = 'main' | 'slots' | 'settings' | 'comfort';

/** HeroOut heroes, all of them infected villains now (lore/VILLAINS.md); the menu shows three at random. */

/**
 * Title screen: continue, new shift into one of three slots, the tutorial,
 * settings (sound, music, language, scout hints). Story comic and accounts
 * are placeholders until their threads deliver.
 */
export class MenuScene extends Phaser.Scene {
  private page: Phaser.GameObjects.Container | null = null;
  private armed: number | null = null;
  private current: Page = 'main';
  private storyPlaying = false;
  /** The ally picker before a new shift, while it is open. */
  private allyUi: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('menu');
  }

  preload(): void {
    // The loading screen (LoadingScene) has loaded everything already; these only catch what it missed.
    preloadArt(this);
    preloadMetaArt(this);
    preloadComm(this);
  }

  create(): void {
    this.input.enabled = true;
    this.allyUi = null;
    if (!this.anims.exists('resident.idle')) createArt(this);
    // QA-018: disable Phaser input while the guide/coach overlay is open, so touches
    // don't fall through to menu buttons behind the DOM layer.
    setLearningHooks({
      pause: () => { this.input.enabled = false; },
      resume: () => { this.input.enabled = true; },
    });
    this.events.once('shutdown', () => setLearningHooks(null));

    // Links for tests and sharing: ?seed=…, ?tutorial=1 go straight to the board.
    const params = new URLSearchParams(location.search);
    if (!this.registry.get('deepLinked') && (params.has('seed') || params.get('tutorial') === '1')) {
      this.registry.set('deepLinked', true);
      // Seed links (a friend's "beat my score" challenge) play in slot 0, outside the three menu slots.
      const ch = readChallenge(params);
      const start: GameStart = params.get('tutorial') === '1' ? { tutorial: true } : { slot: 0, fresh: true, seed: Number(params.get('seed')) || undefined, challenge: ch ? { score: ch.score, name: ch.name } : undefined };
      this.scene.start('game', start);
      return;
    }
    // Friend invite link: ?room=CODE — open the online screen and join the room.
    const roomCode = params.get('room');
    if (!this.registry.get('deepLinked') && roomCode && onlineAvailable()) {
      this.registry.set('deepLinked', true);
    }
    this.drawBackdrop();
    this.show('main');
    if (roomCode && onlineAvailable()) this.online(roomCode);
    metaPreview(this);
    analytics.where('menu');
    analytics.track('menu_view', { tutorial_done: tutorialDone(), has_run: lastSlot() !== null });
    // Android back: skips the intro comic, sub-pages return to the main page; on the main page the app goes to the background.
    setBackHandler(() => {
      if (learning().isOpen) return true;
      if (onlineScreenOpen()) {
        closeOnlineScreen();
        return true;
      }
      if (this.storyPlaying) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        return true;
      }
      if (this.current === 'main') return false;
      this.show('main');
      return true;
    });
    // First launch: the intro comic plays over the menu (its own tap gate unlocks sound).
    if (!introSeen() && !this.registry.get('introShown')) {
      this.registry.set('introShown', true);
      this.story(false);
    } else {
      // Statistics are asked about once a shift has been played, not over the first menu (AR-09),
      // and only in a calm main menu: never over the ally choice or carried into the shift (QA-043).
      if (loadMeta().stats.runs_played) {
        this.time.delayedCall(1200, () => {
          if (this.sys.isActive() && this.current === 'main' && !this.allyUi) askAnalyticsConsent();
        });
      }
      this.events.once('shutdown', closeConsent);
      sound.playMusic('menu');
    }
  }

  private story(skipGate: boolean): void {
    this.input.enabled = false;
    this.storyPlaying = true;
    const startedAt = Date.now();
    analytics.where('intro', () => ({ seconds: (Date.now() - startedAt) / 1000, auto: !skipGate }));
    analytics.track('intro_start', { auto: !skipGate });
    playIntro({ skipGate })
      .then((r) => analytics.track('intro_end', { auto: !skipGate, skipped: r.skipped, seconds: (Date.now() - startedAt) / 1000 }))
      .catch(() => undefined)
      .finally(() => {
        analytics.where('menu');
        this.storyPlaying = false;
        if (this.scene.isActive()) {
          this.input.enabled = true;
          sound.playMusic('menu');
        }
      });
  }

  private drawBackdrop(): void {
    // Landscape: the art sits in the left half, the menu panel on the right.
    const ax = LANDSCAPE ? (VIEW.width / 2 - 780) / 2 + 40 : 0;
    const ay = LANDSCAPE ? 60 : 0;
    // One comic layer: painted city and comic hero portraits (AR-00, AR-07, AR-08).
    drawMenuBackdrop(this);
    // Logo: PART graphite, SHIFT teal (BRAND_UI "Шрифты").
    const part = this.add.text(0, 150, 'PART', TXT.num(96, INK.graphite)).setOrigin(0, 0.5);
    const shift = this.add.text(0, 150, 'SHIFT', TXT.num(96, INK.teal)).setOrigin(0, 0.5);
    part.setStyle({ fontStyle: '900' });
    shift.setStyle({ fontStyle: '900' });
    const total = part.width + shift.width;
    part.x = ax + (780 - total) / 2;
    part.y = shift.y = 150 + ay;
    shift.x = part.x + part.width;
    this.add.text(ax + 390, 236 + ay, t('game.subtitle').toUpperCase(), TXT.caps()).setOrigin(0.5);
    // The week's leader gets their name on everyone's title screen.
    void heroOfWeek().then((h) => {
      if (!h || !this.scene.isActive()) return;
      const tx = this.add.text(ax + 390, 276 + ay, `${t('social.hero_week', { name: h.name, score: h.score.toLocaleString('ru-RU') })}`, TXT.body(22, INK.amber, '700')).setOrigin(0.5);
      if (tx.width > 740) tx.setScale(740 / tx.width);
    });

    drawMenuHeroes(this, ax, ay);
    // The door into the universe sits at the heroes' feet (Антон 11:22); the intro comic moved in there.
    universeButton(this, ax + 390, LANDSCAPE ? ay + 736 : 606, LANDSCAPE ? 600 : 620, () => this.scene.start('universe'));
  }

  private show(page: Page): void {
    this.current = page;
    this.page?.destroy();
    this.armed = null;
    const c = this.add.container(0, 0);
    this.page = c;
    const top = LANDSCAPE ? 60 : 690;
    // Panel spans x0..x0+w; buttons are inset 32 inside it.
    const x0 = LANDSCAPE ? VIEW.width / 2 + 40 : 32;
    const w = LANDSCAPE ? 680 : VIEW.width - 64;
    const cx = x0 + w / 2;
    const bg = this.add.graphics();
    c.add(bg);
    let y = top + 40;
    // `mode`: the art 173 icon on the left (Срочный вызов = flag, Общий = swords, Обучение = brain); `stars`: best rating on the right.
    const button = (label: string, act: (() => void) | null, primary = false, sub?: string, mode?: ModeId, stars?: number) => {
      // Landscape is short: slimmer rows so settings fit without scrolling.
      const h = sub ? 110 : LANDSCAPE ? 76 : 92;
      const g = this.add.graphics();
      chip(g, x0 + 32, y, w - 64, h, primary ? C.teal : C.graphite, act ? (primary ? 1 : 0.08) : 0.04, 18);
      if (primary) {
        g.fillStyle(C.graphite, 0.35);
        g.fillRect(x0 + 50, y + h - 6, w - 100, 6);
      }
      const color = primary ? INK.white : act ? INK.graphite : INK.dim;
      const tx = this.add.text(cx, y + (sub ? 38 : h / 2), label, TXT.body(29, color, '700')).setOrigin(0.5);
      // A label never touches the button edges (ART_REVIEW AR-10): shrink it to fit, larger text sizes included.
      // With an icon or stars at the sides, the label keeps clear of both.
      const side = mode || stars !== undefined ? 2 * (stars !== undefined ? 110 : 76) : 0;
      const room = w - 64 - 56 - side;
      if (tx.width > room) tx.setScale(room / tx.width);
      c.add([g, tx]);
      if (mode) c.add(modeIcon(this, x0 + 32 + 46, y + h / 2, Math.min(64, h - 24), mode).setAlpha(act ? 1 : 0.5));
      if (stars !== undefined) bestStars(this, c, x0 + w - 32 - 20 - 3 * 28 - 4, y + h / 2, 28, stars);
      if (sub) {
        const st = this.add.text(cx, y + 78, sub, TXT.body(21, primary ? '#D9F3F8' : INK.dim, '500')).setOrigin(0.5);
        if (st.width > room) st.setScale(room / st.width);
        c.add(st);
      }
      if (act) {
        const hit = this.add.zone(x0 + 32, y, w - 64, h).setOrigin(0).setInteractive({ useHandCursor: true });
        hit.on('pointerover', () => {
          this.tweens.add({ targets: g, alpha: primary ? 0.85 : 1, scaleX: 1.012, scaleY: 1.012, duration: 100, ease: 'Sine.Out' });
        });
        hit.on('pointerout', () => {
          this.tweens.add({ targets: g, alpha: 1, scaleX: 1, scaleY: 1, duration: 120, ease: 'Sine.Out' });
        });
        hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => {
          ev.stopPropagation();
          this.tweens.add({ targets: g, scaleX: 0.97, scaleY: 0.97, duration: 60, yoyo: true, ease: 'Sine.InOut' });
          sound.play('ui_tap');
          act();
        });
        c.add(hit);
      }
      y += h + 16;
    };

    if (page === 'main') {
      const last = lastSlot();
      if (last) {
        const s = loadSlot(last)!;
        button(t('menu.continue'), () => this.play({ slot: last }), true, `${t('menu.slot', { n: last })} · ${this.fmt(s.time)}`);
      }
      // F-06: until the tutorial is done, «Новая смена» is the tutorial (it has its own «Пропустить»).
      // Otherwise it is the urgent call, with its best rating over the difficulties (ACHIEVEMENTS.md §6).
      const callStars = Math.max(0, ...Object.entries(loadMeta().records).filter(([k]) => k.startsWith('call.')).map(([, r]) => r.bestStars ?? 0));
      if (!tutorialDone()) button(t('menu.new_run'), () => this.play({ tutorial: true }), !last, undefined, 'call');
      else button(t('menu.new_run'), () => this.play({ slot: 0, fresh: true, shiftN: getFirstUncleared() }), !last, undefined, 'call', callStars);
      button(t('online.menu'), onlineAvailable() ? () => this.online() : null, false, onlineAvailable() ? t('online.menu_sub') : t('menu.soon'), 'coop');
      // Meta progress: returned heroes, stats, records, rank (design/META.md §6).
      button(t('dossier.title'), () => this.scene.start('dossier'));
      if (last || tutorialDone()) button(t('menu.tutorial'), () => this.play({ tutorial: true }), false, undefined, 'tutorial');
      button(t('menu.guide'), () => openGuide());
      button(t('menu.settings'), () => this.show('settings'));
      const acc = account.view;
      const accSub = acc.status === 'disabled' ? t('menu.soon') : acc.status === 'signed' ? acc.name || acc.email : undefined;
      button(t('menu.account'), () => openAccountPanel(), false, accSub);
      y += this.socialRow(c, x0 + 32, y, w - 64) + 16;
    } else if (page === 'slots') {
      c.add(this.add.text(cx, y + 6, t('menu.slots').toUpperCase(), TXT.caps()).setOrigin(0.5));
      y += 44;
      for (const slot of SLOTS) {
        const s = loadSlot(slot);
        const sub = s ? t('menu.slot_run', { time: this.fmt(s.time), level: Math.floor(s.time / config.threat.secondsPerLevel) }) : t('menu.slot_empty');
        const rowY = y;
        button(t('menu.slot', { n: slot }), () => this.play({ slot, fresh: !s }), false, sub);
        if (s) {
          // Erase needs a second tap.
          const g = this.add.graphics();
          chip(g, x0 + w - 152, rowY + 22, 140, 66, C.coralInk, 0.12, 12);
          const tx = this.add.text(x0 + w - 82, rowY + 55, t('menu.slot_restart'), TXT.body(20, INK.coral, '700')).setOrigin(0.5);
          const hit = this.add.zone(x0 + w - 152, rowY + 22, 140, 66).setOrigin(0).setInteractive({ useHandCursor: true });
          hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => {
            ev.stopPropagation();
            sound.play('ui_tap');
            if (this.armed === slot) {
              clearSlot(slot);
              this.play({ slot, fresh: true });
            } else {
              this.armed = slot;
              tx.setText(t('menu.slot_restart_confirm')).setFontSize(15);
            }
          });
          c.add([g, tx, hit]);
        }
      }
      button(t('menu.back'), () => this.show('main'));
    } else if (page === 'comfort') {
      // «Удобство» (UI_SPEC §4.7): each row cycles its value on tap.
      const cf = comfort();
      const onOff = (v: boolean) => t(v ? 'comfort.on' : 'comfort.off');
      c.add(this.add.text(cx, y + 6, t('settings.comfort').toUpperCase(), TXT.caps()).setOrigin(0.5));
      y += 40;
      button(`${t('comfort.palette')}: ${t(`comfort.palette.${cf.palette}`)}`, () => {
        setComfort({ palette: PALETTES[(PALETTES.indexOf(cf.palette) + 1) % PALETTES.length] });
        this.show('comfort');
      }, false, t(`comfort.palette.${cf.palette}.hint`));
      // Swatch: what "safe" and "danger" look like in this palette.
      const sw = this.add.graphics();
      const sy = y - 16 - 110 + 78;
      sw.fillStyle(C.green, 1);
      sw.fillCircle(x0 + 80, sy, 10);
      sw.fillStyle(C.coral, 1);
      sw.fillTriangle(x0 + w - 92, sy + 9, x0 + w - 68, sy + 9, x0 + w - 80, sy - 11);
      c.add(sw);
      button(`${t('comfort.calm')}: ${onOff(cf.calm)}`, () => {
        setComfort({ calm: !cf.calm });
        this.show('comfort');
      }, false, t('comfort.calm.hint'));
      button(`${t('comfort.shake')}: ${onOff(cf.shake)}`, () => {
        setComfort({ shake: !cf.shake });
        this.show('comfort');
      });
      button(`${t('comfort.text')}: ${Math.round(cf.textScale * 100)}%`, () => {
        const i = TEXT_SCALES.indexOf(cf.textScale);
        setComfort({ textScale: TEXT_SCALES[(i + 1) % TEXT_SCALES.length] });
        this.show('comfort');
      });
      button(
        `${t('comfort.vibrate')}: ${canVibrate() ? onOff(cf.vibrate) : t('comfort.vibrate.none')}`,
        canVibrate()
          ? () => {
              setComfort({ vibrate: !cf.vibrate });
              if (!cf.vibrate) navigator.vibrate?.(40);
              this.show('comfort');
            }
          : null,
      );
      button(t('menu.back'), () => this.show('settings'), true);
    } else {
      const st = loadSettings();
      c.add(this.add.text(cx, y + 6, t('settings.volume').toUpperCase(), TXT.caps()).setOrigin(0.5));
      y += 40;
      c.add(volumeSliders(this, x0 + 64, y, w - 128));
      y += volumeHeight() + 8;
      button(`${t('settings.language')}: ${t(`settings.language.${lang}`)}`, () => {
        const next = lang === 'ru' ? 'en' : 'ru';
        setLang(next);
        learningLang(next);
        saveSettings({ ...st, lang: next });
        this.scene.restart();
      });
      // v0.7 (MVP_RULES §3.1а): no assist modes, the board is read by sensors only.
      button(t('settings.comfort'), () => this.show('comfort'));
      button(`${t('analytics.setting')}: ${t(analytics.consent === 'granted' ? 'settings.on' : 'settings.off')}`, () => {
        analytics.setConsent(analytics.consent !== 'granted');
        this.show('settings');
      });
      button(t('settings.feedback'), () => openFeedback('settings'));
      button(t('settings.reset_hints'), () => {
        learning().resetProgress();
        this.show('settings');
      });
      button(t('menu.back'), () => this.show('main'), true);
      // Start over completely (META §1а): small and red at the very bottom, three steps inside (ResetProgress.ts).
      const wipe = this.add.text(cx, y + 8, t('settings.reset_all'), TXT.body(20, INK.coral, '700')).setOrigin(0.5, 0);
      const ul = this.add.graphics();
      ul.fillStyle(C.coralInk, 0.6);
      ul.fillRect(cx - wipe.width / 2, y + 10 + wipe.height, wipe.width, 2);
      const wz = this.add.zone(cx - wipe.width / 2 - 20, y - 4, wipe.width + 40, wipe.height + 28).setOrigin(0).setInteractive({ useHandCursor: true });
      wz.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => {
        ev.stopPropagation();
        sound.play('ui_tap');
        const d = resetDialog(
          this,
          60,
          () => location.reload(),
          () => d.destroy(),
        );
      });
      c.add([wipe, ul, wz]);
      y += wipe.height + 30;
    }
    const h = y - top + 24;
    plate(bg, x0, top, w, h, 28);
    // A panel taller than the screen shrinks to fit below its top edge (landscape is only 900 high), never scrolls off.
    const room = VIEW.height - 24 - top;
    if (h > room) {
      const s = room / h;
      c.setScale(s);
      c.setPosition(cx * (1 - s), top * (1 - s));
    }
  }

  /** Online screen over the menu (src/net/lobby.ts); the match opens the board. */
  private online(initialCode?: string): void {
    this.input.enabled = false;
    openOnlineScreen({
      assist: loadSettings().assist,
      initialCode,
      onStart: (online) => this.play({ online }),
      onClose: () => {
        if (this.scene.isActive()) this.input.enabled = true;
      },
    });
  }

  /**
   * «Купить разработчику кофе» as one big gold button (Антон 10.10: four equal chips made its long label unreadable),
   * then Ranking · Invite · Feedback as a slim row of quiet chips under it. Returns the height it took.
   */
  private socialRow(c: Phaser.GameObjects.Container, x: number, y: number, w: number): number {
    const tap = (bx: number, by: number, bw: number, bh: number, act: () => void, gfx?: Phaser.GameObjects.Graphics) => {
      const hit = this.add.zone(bx, by, bw, bh).setOrigin(0).setInteractive({ useHandCursor: true });
      if (gfx) {
        hit.on('pointerover', () => this.tweens.add({ targets: gfx, alpha: 0.82, scaleX: 1.02, scaleY: 1.02, duration: 100, ease: 'Sine.Out' }));
        hit.on('pointerout', () => this.tweens.add({ targets: gfx, alpha: 1, scaleX: 1, scaleY: 1, duration: 120, ease: 'Sine.Out' }));
      }
      hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => {
        ev.stopPropagation();
        if (gfx) this.tweens.add({ targets: gfx, scaleX: 0.96, scaleY: 0.96, duration: 60, yoyo: true, ease: 'Sine.InOut' });
        sound.play('ui_tap');
        act();
      });
      return hit;
    };
    // The coffee button: full width, gold, icon and the whole phrase on one line.
    const ch = LANDSCAPE ? 80 : 96;
    const g = this.add.graphics();
    chip(g, x, y, w, ch, C.amber, 1, 16);
    const size = LANDSCAPE ? 40 : 48;
    const label = t('social.menu.coffee').replace(/\n/g, ' ');
    const tx = this.add.text(x + w / 2 + size / 2 + 6, y + ch / 2, label, TXT.body(LANDSCAPE ? 28 : 32, INK.graphite, '800')).setOrigin(0.5);
    const room = w - size - 64;
    if (tx.width > room) tx.setScale(room / tx.width);
    const ic = menuIcon(this, tx.x - (tx.width * tx.scaleX) / 2 - 14 - size / 2, y + ch / 2, size, 'coffee');
    c.add([g, ...ic, tx, tap(x, y, w, ch, () => openDonate('menu'), g)]);
    // The other three: quieter outline chips, icon beside a short label.
    const items: [MenuIconId, string, () => void][] = [
      ['leaderboard', t('social.menu.board'), () => openBoard({ playDaily: () => this.playDaily() })],
      ['invite', t('social.menu.invite'), () => invite('menu')],
      ['feedback', t('social.menu.feedback'), () => openFeedback('menu')],
    ];
    const gap = 10;
    const sy = y + ch + 12;
    const sh = LANDSCAPE ? 60 : 72;
    const bw = (w - gap * (items.length - 1)) / items.length;
    items.forEach(([icon, text, act], k) => {
      const bx = x + k * (bw + gap);
      const sg = this.add.graphics();
      chip(sg, bx, sy, bw, sh, C.graphite, 0.08, 12);
      const isz = LANDSCAPE ? 28 : 34;
      const st = this.add.text(bx + bw / 2 + isz / 2 + 4, sy + sh / 2, text, TXT.body(LANDSCAPE ? 21 : 25, INK.graphite, '800')).setOrigin(0.5);
      const r = bw - isz - 28;
      if (st.width > r) st.setScale(r / st.width);
      const sic = menuIcon(this, st.x - (st.width * st.scaleX) / 2 - 8 - isz / 2, sy + sh / 2, isz, icon);
      c.add([sg, ...sic, st, tap(bx, sy, bw, sh, act, sg)]);
    });
    return ch + 12 + sh;
  }

  /** City of the day: one map for everybody; slot 4 keeps today's run, a new day starts fresh. */
  private playDaily(): void {
    const day = dayId();
    const seed = dailySeed(day);
    const s = loadSlot(4);
    this.play({ slot: 4, fresh: !s || s.seed !== seed, seed, daily: day });
  }

  private play(start: GameStart): void {
    closeConsent();
    // Before each shift: show «Сводка смены» (MVP_RULES §4.5) to pick the squad.
    const meta = loadMeta();
    if (start.fresh && !start.tutorial && !this.allyUi) {
      const enemies = rollDistrict(meta);
      this.allyUi = shiftBrief(
        this,
        meta,
        enemies,
        (squad) => {
          pickAllies(meta, squad);
          this.allyUi = null;
          this.scene.start('game', { ...start, allies: squad });
        },
        () => {
          this.allyUi?.destroy();
          this.allyUi = null;
        },
      );
      return;
    }
    this.scene.start('game', start);
  }

  private fmt(seconds: number): string {
    const s = Math.floor(seconds);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
}
